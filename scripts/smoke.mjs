// npm test: a temp database, migrate, seed twice, then every command and every rule.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { run, reads } from './ops.mjs';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'flight-ops-test-'));
// A blank URL keeps tests off any real database named in .env.
process.env.DATABASE_URL = ''; process.env.DATA_DIR = path.join(temp, 'db'); process.env.OUTPUT_DIR = temp;
let db; let checks = 0;
const ok = (v, msg) => { assert.ok(v, msg); checks++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks++; };
const rejects = async (args, re) => { await assert.rejects(() => run(db, args), re); checks++; };
const child = (script, args = []) => {
  const p = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', script), ...args], { env: process.env, encoding: 'utf8', cwd: REPO_ROOT });
  assert.equal(p.status, 0, p.stderr || p.stdout); checks++; return p.stdout;
};
const daysFrom = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const rules = async () => (await run(db, ['compliance'])).map((r) => `${r.rule} ${r.record}`);

try {
  db = await getDb();
  eq((await migrate(db)).ran.length, 1); eq((await migrate(db)).ran.length, 0);
  const seed = fs.readFileSync(path.join(REPO_ROOT, 'supabase/seed.sql'), 'utf8');
  await db.exec(seed); await db.exec(seed);
  eq((await run(db, ['trips'])).length, 16); eq((await run(db, ['journey-log'])).length, 19);
  eq((await db.query('select count(*)::int n from passengers'))[0].n, 34);

  for (const name of Object.keys(reads)) ok(Array.isArray(await run(db, [name])), name);

  // The demo has something to say on every rule.
  const found = new Set((await run(db, ['compliance'])).map((r) => r.rule));
  for (const r of ['FTL-DUTY-LENGTH', 'FTL-REST', 'MEDICAL', 'FLIGHT-REVIEW', 'OPERATOR-CHECK', 'PAX-RECENCY', 'TYPE-RATING', 'ARC-EXPIRED', 'DEFERRAL-EXPIRED', 'MANIFEST', 'JOURNEY-LOG', 'PAYLOAD']) ok(found.has(r), r);
  ok(!found.has('FTL-FLIGHT-HOURS'), 'nobody over flight hours in the demo');
  eq((await run(db, ['tomorrow'])).map((r) => r.code), ['T102', 'T101', 'T103']);
  ok((await run(db, ['tomorrow'])).find((r) => r.code === 'T101').problems.includes('pilot medical expired'));
  eq((await run(db, ['schedule'])).find((r) => r.code === 'T106').problems, '');
  eq((await run(db, ['uninvoiced'])).map((r) => r.code), ['T093', 'T094', 'T095']);
  eq(Number((await run(db, ['uninvoiced']))[0].charge), 9300);
  eq((await run(db, ['to-log'])).map((r) => `${r.trip}/${r.seq}`), ['T096/1', 'T096/2']);
  eq(Number((await run(db, ['fleet'])).find((r) => r.code === 'ZK-HQA').hours_to_check), 8);
  eq((await run(db, ['currency'])).find((r) => r.crew === 'MT').landings_90d, 1);
  eq(Number((await run(db, ['duties'])).find((r) => r.crew === 'ST' && Number(r.rest_before_hours) === 8).duty_hours), 5);
  eq((await run(db, ['quote-conversion'])).map((r) => r.status), ['accepted', 'declined', 'draft', 'sent']);
  const attention = await run(db, ['attention']);
  for (const k of ['trip tomorrow not confirmed', 'trip with a problem', 'quote waiting on client', 'past trip not logged', 'flown trip not invoiced', 'medical due', 'check due soon', 'deferred defect due']) ok(attention.some((r) => r.kind === k), k);
  const trip = await run(db, ['trip', 't101']);
  eq(trip.legs.length, 2); eq(trip.manifest.length, 4); eq(trip.notes.length, 1);
  eq((await run(db, ['pilot', 'ST'])).duties.length, 3);

  // Matching: partial codes and names, ambiguity lists candidates.
  await rejects(['trip', 'T10'], /Ambiguous trip.*T101.*T106/);
  await rejects(['pilot', 'ZZ'], /No matching crew/);
  await rejects(['add', 'trip', 'X1', '--aircraft=ZK-HQ', `--date=${daysFrom(2)}`], /Ambiguous aircraft.*ZK-HQA.*ZK-HQB/);
  eq((await run(db, ['pilot', 'sophie'])).currency[0].crew, 'ST');

  // Assigning a pilot checks rating, medical, review, operator check and recency.
  await rejects(['assign', 'T103', '--pilot=AN'], /not rated on C208/);
  await rejects(['assign', 'T103', '--pilot=BC'], /medical expired/);
  await rejects(['assign', 'T103', '--pilot=MT'], /flight review overdue/);
  await run(db, ['assign', 'T103', '--pilot=ST']);
  ok(!(await run(db, ['schedule'])).find((r) => r.code === 'T103').problems.includes('no pilot'));
  await run(db, ['assign', 'T101', '--pilot=AN']);
  eq((await run(db, ['schedule'])).find((r) => r.code === 'T101').problems, '');
  await run(db, ['assign', 'T105', '--pilot=MT', '--force']);
  await rejects(['assign', 'T090', '--pilot=AN'], /flown: cannot change/);

  // Quotes: draft, send, book, decline, expiry and seats.
  await rejects(['quote', 'Q200', '--client=REEF', '--aircraft=VH-RXC', `--date=${daysFrom(10)}`, '--route=Reef', '--hours=1', '--pax=3'], /will not fit/);
  const q = await run(db, ['quote', 'Q200', '--client=REEF', '--aircraft=VH-RXC', `--date=${daysFrom(10)}`, '--route=Reef and islands', '--hours=1.5', '--pax=2', '--extras=50']);
  eq(Number(q[0].price), 1475);
  await rejects(['book', 'Q200', 'T200'], /draft: only a sent quote/);
  await run(db, ['send', 'Q200']); await rejects(['send', 'Q200'], /sent: cannot send/);
  await run(db, ['book', 'Q200', 'T200', '--pilot=JW']);
  eq((await db.query("select status from quotes where code='Q200'"))[0].status, 'accepted');
  eq(Number((await run(db, ['trip', 'T200'])).trip[0].charge), 1475);
  await rejects(['book', 'Q102', 'T201'], /expired on/);
  await run(db, ['decline', 'Q102']); await rejects(['decline', 'Q102'], /declined: cannot decline/);
  await rejects(['quote', 'Q201', '--client=REEF', '--aircraft=VH-RXC', '--date=2026-02-30', '--route=x', '--hours=1'], /real YYYY-MM-DD/);

  // Trips and legs.
  await rejects(['confirm', 'T200'], /no legs/);
  await run(db, ['leg', 'T200', '--from=cns', '--to=reef', '--std=09:00', '--pax=2']);
  await rejects(['leg', 'T200', '--from=REEF', '--to=CNS', '--pax=4'], /will not fit/);
  await run(db, ['leg', 'T200', '--from=REEF', '--to=CNS', '--std=10:30', '--pax=2']);
  eq((await run(db, ['trip', 'T200'])).legs.map((l) => `${l.dep}-${l.arr}`), ['CNS-REEF', 'REEF-CNS']);
  await run(db, ['confirm', 'T200']); await rejects(['confirm', 'T200'], /confirmed: cannot confirm/);
  await run(db, ['pax', 'T200', 'A. Guest', '--weight=70']); await run(db, ['pax', 'T200', 'B. Guest', '--weight=65', '--bags=5']);
  await rejects(['pax', 'T200', 'C. Guest', '--weight=60'], /manifest is full/);
  await rejects(['pax', 'T105', 'D. Guest'], /weight/);
  await rejects(['fly', 'T200', '1', '--off=09:00', '--on=09:40'], /in the future/);
  await run(db, ['cancel', 'T106']); eq((await db.query("select status from trips where code='T106'"))[0].status, 'cancelled');

  // The journey log: logging, overnight legs, locking and completing.
  await rejects(['fly', 'T096', '1', '--off=14:00'], /block on/);
  await rejects(['fly', 'T096', '1', '--off=14:00', '--on=14:40', '--takeoff=13:50', '--landing=14:30'], /between block off and block on/);
  await rejects(['fly', 'T096', '1', '--off=14:00', '--on=14:40', '--takeoff=14:03'], /both/);
  await run(db, ['fly', 'T096', '1', '--off=14:00', '--on=14:40', '--takeoff=14:03', '--landing=14:37', '--fuel=210']);
  await rejects(['fly', 'T096', '1', '--off=14:00', '--on=14:40'], /already logged/);
  await rejects(['fly', 'T096', '3', '--off=14:00', '--on=14:40'], /no leg 3/);
  await rejects(['complete', 'T096'], /1 of 2 legs without block times/);
  await run(db, ['fly', 'T096', '2', '--off=15:10', '--on=15:52', '--landings=2']);
  await run(db, ['complete', 'T096']);
  eq((await run(db, ['trip', 'T096'])).trip[0].status, 'flown');
  eq(Number((await run(db, ['trip', 'T096'])).legs[0].air_hours), 0.57);
  ok(!(await rules()).includes('JOURNEY-LOG T096'));
  ok((await rules()).includes('MANIFEST T096'));
  await assert.rejects(() => db.query("update legs set block_on=block_on+interval '5 minutes' where trip_id=(select id from trips where code='T096') and seq=1"), /stay as written/); checks++;
  await assert.rejects(() => db.query("delete from legs where trip_id=(select id from trips where code='T096')"), /kept/); checks++;
  await db.query("update legs set fuel_l=215 where trip_id=(select id from trips where code='T096') and seq=1"); checks++;
  await rejects(['cancel', 'T096'], /flown: cannot cancel/);
  await run(db, ['log', 'T096', 'Fuel', 'figure', 'corrected', 'from', 'the', 'docket']);
  eq((await run(db, ['trip', 'T096'])).notes.length, 1);

  // Duties and flight and duty limits.
  await rejects(['duty', 'ST', `--start=${daysFrom(-5)}T03:00`, `--end=${daysFrom(-5)}T04:00`], /overlapping/);
  await rejects(['duty', 'ST', `--start=${daysFrom(-3)}T10:00`, `--end=${daysFrom(-3)}T09:00`], /end after/);
  const d = await run(db, ['duty', 'AN', `--start=${daysFrom(-3)}T06:00`, `--end=${daysFrom(-3)}T16:00`]);
  eq(Number(d[0].duty_hours), 10);
  await run(db, ['limit', 'flight_hours_7d', '2']);
  ok((await rules()).includes('FTL-FLIGHT-HOURS AN'));
  await run(db, ['limit', 'flight_hours_7d', '30']);
  ok(!(await rules()).some((r) => r.startsWith('FTL-FLIGHT-HOURS')));
  await rejects(['limit', 'nonsense', '3'], /No limit nonsense/);
  await rejects(['limit', 'max_duty_hours', '-1'], /Invalid/);
  await assert.rejects(() => db.query("delete from duties"), /kept/); checks++;

  // Currency renewals clear their rule.
  await run(db, ['renew', 'BC', 'medical', `--date=${daysFrom(365)}`]);
  ok(!(await rules()).includes('MEDICAL BC'));
  await run(db, ['renew', 'MT', 'review', `--date=${daysFrom(-1)}`]);
  ok(!(await rules()).includes('FLIGHT-REVIEW MT'));
  await rejects(['renew', 'JW', 'check', `--date=${daysFrom(5)}`], /not a future date/);
  await run(db, ['renew', 'JW', 'check', `--date=${daysFrom(0)}`]);
  ok(!(await rules()).includes('OPERATOR-CHECK JW'));
  await rejects(['renew', 'JW', 'licence', '--date=2026-01-01'], /medical\|review\|check/);
  await run(db, ['rate', 'MT', 'AS350']);
  ok(!(await rules()).includes('TYPE-RATING T105'));

  // Defects and maintenance.
  await rejects(['serviceable', 'VH-RXC', 'on'], /DEF-01/);
  await rejects(['clear', 'DEF-01'], /reference/);
  await run(db, ['clear', 'DEF-01', '--ref=WO-5001']); await rejects(['clear', 'DEF-01', '--ref=again'], /was cleared/);
  await run(db, ['serviceable', 'VH-RXC', 'on']);
  ok(!(await run(db, ['schedule'])).find((r) => r.code === 'T104').problems.includes('unserviceable'));
  const def = await run(db, ['defect', 'ZK-HQB', 'Cargo', 'hook', 'release', 'stiff']);
  eq(def[0].code, 'DEF-05'); eq((await db.query("select status from aircraft where code='ZK-HQB'"))[0].status, 'unserviceable');
  await rejects(['defect', 'ZK-HQA', 'Placard', 'missing', '--defer'], /due/);
  await run(db, ['defect', 'ZK-HQA', 'Placard', 'missing', '--defer', `--due=${daysFrom(3)}`]);
  eq((await db.query("select status from aircraft where code='ZK-HQA'"))[0].status, 'serviceable');
  await assert.rejects(() => db.query("delete from defects where code='DEF-05'"), /kept/); checks++;
  await rejects(['check-done', 'ZK-HQA', '--next=8000'], /not after/);
  await run(db, ['check-done', 'ZK-HQA', '--next=8520', `--arc=${daysFrom(365)}`]);
  ok(!(await run(db, ['attention'])).some((r) => r.kind === 'check due soon'));
  await run(db, ['check-done', 'ZK-PLA', '--next=6300', `--arc=${daysFrom(365)}`]);
  ok(!(await rules()).includes('ARC-EXPIRED ZK-PLA'));

  // Invoicing.
  await rejects(['invoice', 'T101', '--ref=INV-1'], /confirmed: only a flown trip/);
  await rejects(['invoice', 'T090', '--ref=INV-1'], /already on INV-5101/);
  await rejects(['invoice', 'T094'], /invoice reference/);
  await run(db, ['invoice', 'T094', '--ref=INV-5200']);
  ok(!(await run(db, ['uninvoiced'])).some((r) => r.code === 'T094'));

  // Adding records.
  await run(db, ['add', 'base', 'WKA', 'Wanaka', '--country=nz']);
  await rejects(['add', 'base', 'BAD', 'Bad base', '--country=US'], /check|violates/);
  await run(db, ['add', 'aircraft', 'zk-new', '--type=AS350', '--seats=6', '--base=WKA', '--payload=900', '--rate=2600', '--hours=5000', '--next-check=5080', '--arc=2027-06-01']);
  eq((await run(db, ['fleet'])).find((r) => r.code === 'ZK-NEW').hours, '5000.0');
  await run(db, ['add', 'crew', 'NP', 'New Pilot', '--base=WKA', '--weight=75', '--medical-class=1', `--medical=${daysFrom(300)}`, `--review=${daysFrom(-10)}`, `--check=${daysFrom(-10)}`]);
  await run(db, ['add', 'client', 'NEWC', 'New Client Ltd', '--email=new@example.com']);
  await run(db, ['add', 'trip', 'T300', '--aircraft=ZK-NEW', `--date=${daysFrom(4)}`, '--client=NEWC', '--purpose=scenic']);
  await run(db, ['leg', 'T300', '--from=WKA', '--to=GLA', '--std=08:00', '--pax=2']);
  await rejects(['assign', 'T300', '--pilot=NP'], /not current for passengers; pilot not rated on AS350/);
  await run(db, ['rate', 'NP', 'AS350']);
  await rejects(['assign', 'T300', '--pilot=NP'], /not current for passengers/);
  await rejects(['add', 'aircraft', 'ZK-BAD', '--type=AS350'], /seats/);
  await rejects(['add', 'widget', 'X'], /Add one of/);

  // Import from Leon Report Wizard CSV exports: dry run, real run, repeat, rollback, mapping.
  const fixtures = path.join(REPO_ROOT, 'tests/fixtures/leon');
  await run(db, ['import', 'leon', fixtures, '--dry-run']);
  eq((await db.query("select * from aircraft where code='ZK-IMP'")).length, 0);
  const imported = await run(db, ['import', 'leon', fixtures]); await run(db, ['import', 'leon', fixtures]);
  eq(imported.map((r) => r.entity), ['aircraft', 'crew', 'clients', 'flights']);
  eq((await db.query("select seats from aircraft where code='ZK-IMP'"))[0].seats, 6);
  const imp = await run(db, ['trip', 'L-9001']);
  eq(imp.trip[0].status, 'flown'); eq(imp.legs.length, 2); eq(imp.trip[0].client, 'Imported Heli Tours');
  eq(Number(imp.legs[1].air_hours), 0.68);
  eq((await run(db, ['trip', 'L-9002'])).legs[0].landings, 3);
  const bad = path.join(temp, 'bad'); fs.mkdirSync(bad);
  fs.writeFileSync(path.join(bad, 'Fleet.csv'), 'Registration,Type,Capacity\nZK-RBK,AS350,5\nZK-RBL,,5\n');
  await rejects(['import', 'leon', bad], /Type/);
  eq((await db.query("select * from aircraft where code='ZK-RBK'")).length, 0);
  fs.writeFileSync(path.join(bad, 'Fleet.csv'), 'Reg mark,Model,Pax seats\nZK-MAP,B206,4\n');
  const map = path.join(temp, 'map.json'); fs.writeFileSync(map, JSON.stringify({ aircraft: { Registration: 'Reg mark', Type: 'Model', Capacity: 'Pax seats' } }));
  await run(db, ['import', 'leon', bad, `--map=${map}`]);
  eq((await db.query("select seats from aircraft where code='ZK-MAP'"))[0].seats, 5);
  fs.writeFileSync(path.join(bad, 'Flights.csv'), 'Date,Registration,ADEP,ADES,Commander code\n2026-09-01,ZK-MAP,NZQN,NZQN,NOBODY\n');
  await rejects(['import', 'leon', bad, `--map=${map}`], /commander NOBODY/);
  fs.writeFileSync(path.join(bad, 'Flights.csv'), 'x\ny\n');
  fs.renameSync(path.join(bad, 'Flights.csv'), path.join(bad, 'Invoices.csv'));
  await rejects(['import', 'leon', bad, `--map=${map}`], /Unrecognised/);
  await rejects(['import', 'other', bad], /Supported import/);

  // Export and drafts.
  const exported = await run(db, ['export', path.join(temp, 'export')]);
  eq(exported.length, 13); ok(fs.existsSync(path.join(temp, 'export', 'manifest.json')));
  const dq = await run(db, ['draft-quote', 'Q105']);
  ok(fs.readFileSync(dq[0].file, 'utf8').includes('Reef scenic, four 30 minute flights'));
  const dc = await run(db, ['draft-confirmation', 'T102']);
  ok(fs.readFileSync(dc[0].file, 'utf8').includes('payload 881 kg over 850. Sort these out'));
  await rejects(['draft-confirmation', 'T089'], /no client/);
  await db.close(); db = null;

  // The CLI as a process: --json, help, ambiguity exits 1.
  ok(JSON.parse(child('ops.mjs', ['schedule', '--json'])).length > 0);
  ok(child('ops.mjs', ['help']).includes('fly <trip> <leg>'));
  const amb = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts/ops.mjs'), 'trip', 'T10'], { env: process.env, encoding: 'utf8' });
  eq(amb.status, 1); ok(amb.stderr.includes('Candidates:'));
  child('view.mjs'); child('docs.mjs');
  for (const v of JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'views.json'), 'utf8'))) ok(fs.existsSync(path.join(temp, 'views', `${v.name}.html`)), v.name);
  for (const doc of ['flight-brief', 'passenger-manifest', 'journey-log', 'charter-quote', 'crew-record']) ok(fs.readdirSync(path.join(temp, 'docs-out', doc)).length >= 1, doc);
  ok(fs.readdirSync(path.join(temp, 'docs-out', 'journey-log')).length >= 10);

  const commands = fs.readdirSync(path.join(REPO_ROOT, '.claude/commands')).filter((f) => f.endsWith('.md') && f !== 'README.md');
  for (const f of commands) ok(/^---\ndescription: .+\n---/m.test(fs.readFileSync(path.join(REPO_ROOT, '.claude/commands', f), 'utf8')), `${f} has a description`);
  console.log(`PASS: ${checks} assertions; ${Object.keys(reads).length} read commands; ${commands.length} slash commands; quotes, trips, journey log, duties, currency, defects, invoices, import rollback, export, drafts and HTML.`);
} finally {
  await db?.close();
  fs.rmSync(temp, { recursive: true, force: true });
}
