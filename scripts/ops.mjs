#!/usr/bin/env node
// The one CLI for Flight Ops for Claude Code. Human tables by default, --json for machines.
//   npm run ops -- help
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { table } from './lib/format.mjs';
import { parseCsv, pick } from './lib/csv.mjs';

// Every read the ops desk, the chief pilot and the accounts office ask for, by name.
export const reads = {
  bases: 'select code,name,country,certificate_ref from bases order by code',
  aircraft: 'select a.code,a.type,a.kind,b.code base,a.seats,a.payload_kg,a.hourly_rate,a.status from aircraft a left join bases b on b.id=a.base_id order by a.code',
  crew: "select c.code,c.name,c.role,b.code base,c.licence_ref,c.weight_kg,(select string_agg(aircraft_type,', ' order by aircraft_type) from ratings r where r.crew_id=c.id) types,c.active from crew c left join bases b on b.id=c.base_id order by c.code",
  clients: 'select code,name,email,phone from clients order by code',
  limits: 'select key,value,unit,note from limits order by key',
  quotes: 'select q.code,q.flight_date,q.status,cl.name client,a.code aircraft,q.route,q.pax,q.est_hours,q.rate,q.extras,q.price,q.sent_on,q.valid_until from quotes q join clients cl on cl.id=q.client_id join aircraft a on a.id=q.aircraft_id order by q.flight_date,q.code',
  trips: 'select code,flight_date,status,purpose,client,aircraft,pic,route,pax,manifest,air_hours,charge,invoice_ref from v_trips order by flight_date desc,code',
  schedule: 'select code,flight_date,first_std,status,purpose,client,aircraft,pic,route,pax,manifest,problems from v_schedule order by flight_date,first_std,code',
  tomorrow: 'select code,first_std,status,client,aircraft,pic,route,pax,manifest,problems from v_schedule where flight_date=current_date+1 order by first_std,code',
  'journey-log': 'select trip,seq,flight_date,aircraft,pic,dep,arr,off_utc,on_utc,block_hours,air_hours,landings,pax,fuel_l from v_legs where logged order by flight_date desc,trip,seq',
  'to-log': "select trip,seq,flight_date,aircraft,pic,dep,arr,std,pax from v_legs where not logged and flight_date<=current_date and trip_status in ('planned','confirmed') order by flight_date,trip,seq",
  'crew-hours': 'select crew,name,flight_7d,limit_7d,flight_28d,limit_28d,flight_365d,limit_365d,duty_7d,duty_limit_7d from v_crew_hours order by crew',
  duties: 'select crew,name,kind,starts,ends,duty_hours,rest_before_hours from v_duties order by start_at desc,crew',
  currency: 'select crew,name,medical_class,medical_expiry,medical_days,review_due,check_due,landings_90d,pax_current,types from v_currency order by crew',
  'crew-check': "select rule,record,issue from v_compliance where rule in ('FTL-DUTY-LENGTH','FTL-REST','FTL-FLIGHT-HOURS','MEDICAL','FLIGHT-REVIEW','OPERATOR-CHECK','PAX-RECENCY','TYPE-RATING') order by rule,record",
  fleet: 'select code,type,base,status,hours,next_check_name,next_check_hours,hours_to_check,arc_expiry,days_to_arc,open_defects,deferred_defects from v_fleet order by code',
  defects: "select d.code,a.code aircraft,d.raised_on,d.description,d.deferred,d.due_on,d.cleared_on,d.cleared_ref,case when d.cleared_on is not null then 'cleared' when d.deferred and d.due_on<current_date then 'deferral expired' when d.deferred then 'deferred' else 'open' end state from defects d join aircraft a on a.id=d.aircraft_id order by d.cleared_on nulls first,d.due_on nulls first,d.code",
  utilisation: "select a.code aircraft,a.type,count(distinct l.trip) filter (where l.flight_date>=current_date-30) trips_30d,coalesce(sum(l.air_hours) filter (where l.flight_date>=current_date-30),0) hours_30d,coalesce(sum(l.air_hours) filter (where l.flight_date>=current_date-90),0) hours_90d,coalesce(sum(l.fuel_l) filter (where l.flight_date>=current_date-90),0) fuel_l_90d from aircraft a left join v_legs l on l.aircraft=a.code and l.logged group by a.code,a.type order by hours_90d desc,a.code",
  uninvoiced: "select code,flight_date,client,aircraft,purpose,air_hours,charge,current_date-flight_date days_since from v_trips where status='flown' and invoice_ref is null and client is not null order by flight_date,code",
  'client-flying': "select client,count(*) trips,sum(air_hours) air_hours,sum(charge) charged,sum(charge) filter (where invoice_ref is null) not_invoiced,max(flight_date) last_flight from v_trips where status='flown' and client is not null and flight_date>=current_date-90 group by client order by charged desc",
  'quote-conversion': "select status,count(*) quotes,sum(price) value,round(avg(est_hours),1) avg_hours from quotes group by status order by status",
  compliance: 'select rule,record,issue from v_compliance order by rule,record',
  attention: 'select kind,record,due,detail from v_attention order by due,kind,record',
};

const named = {
  bases: { by: 'code', names: true }, aircraft: { by: 'code', names: 'type' }, crew: { by: 'code', names: true },
  clients: { by: 'code', names: true }, quotes: { by: 'code' }, trips: { by: 'code' }, defects: { by: 'code', names: 'description' },
};

// Exact code or id first, then a unique prefix or name match. Ambiguity lists candidates.
export async function resolve(db, entity, value) {
  const label = entity === 'aircraft' || entity === 'crew' ? entity : entity.replace(/s$/, '');
  if (!value || value === true) throw Error(`Supply a ${label} code, name or id prefix`);
  const { by, names } = named[entity];
  const exact = await db.query(`select * from ${entity} where lower(${by})=lower($1) or id::text=$1`, [String(value)]);
  if (exact.length === 1) return exact[0];
  const nameCol = names === true ? 'name' : names;
  const found = await db.query(`select * from ${entity} where starts_with(lower(${by}),lower($1)) or starts_with(id::text,$1)${nameCol ? ` or position(lower($1) in lower(${nameCol}))>0` : ''} order by ${by}`, [String(value)]);
  if (found.length === 1) return found[0];
  const list = found.map((r) => `${r[by]}${nameCol ? ' ' + r[nameCol] : ''}`).join('; ') || '(none)';
  throw Error(`${found.length ? 'Ambiguous' : 'No matching'} ${label}: ${value}. Candidates: ${list}`);
}

const required = (v, n) => { if (v === undefined || v === null || v === true || String(v).trim() === '') throw Error(`Required: ${n}`); return String(v).trim(); };
const number = (v, n, { positive = false, min } = {}) => {
  const x = Number(required(v, n));
  if (!Number.isFinite(x) || (positive && x <= 0) || (min !== undefined && x < min)) throw Error(`Invalid ${n}: ${v}`);
  return x;
};
const date = (v, n = 'date') => {
  required(v, n);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) !== v) throw Error(`Invalid ${n}: use a real YYYY-MM-DD date`);
  return v;
};
// HH:MM is UTC on the given day; a full YYYY-MM-DDTHH:MM is taken as UTC as given.
const when = (v, day, n = 'time') => {
  const s = required(v, `${n} (HH:MM UTC)`);
  if (/^\d{2}:\d{2}$/.test(s) && Number(s.slice(0, 2)) < 24 && Number(s.slice(3)) < 60) return `${day}T${s}:00Z`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + ':00Z'))) return `${s}:00Z`;
  throw Error(`Invalid ${n}: ${s}. Use HH:MM or YYYY-MM-DDTHH:MM, in UTC`);
};
const today = () => new Date().toISOString().slice(0, 10);
const ymd = (d) => (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10);

async function transaction(db, fn, dry = false) {
  await db.exec('begin');
  try { const out = await fn(); await db.exec(dry ? 'rollback' : 'commit'); return out; }
  catch (e) { await db.exec('rollback'); throw e; }
}

const entities = ['limits', 'bases', 'aircraft', 'crew', 'ratings', 'clients', 'quotes', 'trips', 'legs', 'passengers', 'duties', 'defects', 'notes'];

export const help = [
  ...Object.keys(reads),
  'trip <code>', 'pilot <code>',
  'add base <code> <name> --country=NZ|AU [--certificate=ref]',
  'add aircraft <rego> --type=AS350 --seats=6 [--kind=helicopter|aeroplane] [--base=..] [--payload=kg] [--rate=..] [--hours=..] [--next-check=hours] [--check-name=..] [--arc=YYYY-MM-DD]',
  'add crew <code> <name> [--base=..] [--licence=..] [--weight=kg] [--medical-class=1|2] [--medical=YYYY-MM-DD] [--review=YYYY-MM-DD] [--check=YYYY-MM-DD]',
  'add client <code> <name> [--email=..] [--phone=..]',
  'rate <crew> <aircraft type> [--date=YYYY-MM-DD]',
  'quote <code> --client=.. --aircraft=.. --date=YYYY-MM-DD --route=".." --hours=.. [--pax=n] [--rate=..] [--extras=..] [--valid=YYYY-MM-DD]',
  'send <quote>', 'decline <quote>', 'book <quote> <trip code> [--pilot=..]',
  'add trip <code> --aircraft=.. --date=YYYY-MM-DD [--client=..] [--pilot=..] [--purpose=charter|scenic|positioning|training|survey|other]',
  'leg <trip> --from=.. --to=.. [--std=HH:MM] [--pax=n]',
  'assign <trip> --pilot=.. [--force]', 'confirm <trip>', 'cancel <trip>',
  'pax <trip> <name> --weight=kg [--bags=kg]',
  'fly <trip> <leg> --off=HH:MM --on=HH:MM [--takeoff=HH:MM --landing=HH:MM] [--landings=n] [--fuel=litres]',
  'complete <trip>', 'duty <crew> --start=YYYY-MM-DDTHH:MM --end=YYYY-MM-DDTHH:MM [--kind=flying|standby|ground|training]',
  'renew <crew> medical|review|check --date=YYYY-MM-DD',
  'defect <aircraft> <description> [--defer --due=YYYY-MM-DD]', 'clear <defect> --ref=work order',
  'serviceable <aircraft> on|off', 'check-done <aircraft> --next=hours [--name=..] [--arc=YYYY-MM-DD]',
  'limit <key> <value>', 'invoice <trip> --ref=..', 'log <trip> <note>',
  'import leon <folder> [--dry-run] [--map=file.json]', 'export <folder>',
  'draft-quote <quote>', 'draft-confirmation <trip>',
];

export async function run(db, args) {
  const flags = {}; const pos = [];
  for (const a of args) {
    if (a.startsWith('--')) { const i = a.indexOf('='); flags[a.slice(2, i < 0 ? undefined : i)] = i < 0 ? true : a.slice(i + 1); }
    else pos.push(a);
  }
  const [cmd = 'help', ...a] = pos;
  if (cmd === 'help') return help.map((command) => ({ command }));
  if (reads[cmd]) return db.query(reads[cmd]);

  if (cmd === 'trip') {
    const t = await resolve(db, 'trips', a[0]);
    return {
      trip: await db.query('select code,flight_date,status,purpose,client,aircraft,aircraft_type,pic_name,quote,pax,manifest,payload_kg,max_payload_kg,air_hours,charge,invoice_ref from v_trips where trip_id=$1', [t.id]),
      legs: await db.query('select seq,dep,arr,std,pax,off_utc,on_utc,block_hours,air_hours,landings,fuel_l from v_legs l join trips t on t.code=l.trip where t.id=$1 order by seq', [t.id]),
      manifest: await db.query('select name,weight_kg,bags_kg from passengers where trip_id=$1 order by name', [t.id]),
      problems: await db.query('select problems from v_schedule where code=$1', [t.code]),
      notes: await db.query('select created_at,body from notes where trip_id=$1 order by created_at', [t.id]),
    };
  }
  if (cmd === 'pilot') {
    const c = await resolve(db, 'crew', a[0]);
    return {
      currency: await db.query('select * from v_currency where crew_id=$1', [c.id]),
      hours: await db.query('select * from v_crew_hours where crew=$1', [c.code]),
      duties: await db.query('select kind,starts,ends,duty_hours,rest_before_hours from v_duties where crew=$1 order by start_at desc limit 10', [c.code]),
      upcoming: await db.query("select code,flight_date,aircraft,route,problems from v_schedule where pic=$1 order by flight_date", [c.code]),
    };
  }

  if (cmd === 'export') {
    const dir = path.resolve(required(a[0], 'export folder'));
    fs.mkdirSync(dir, { recursive: true });
    return transaction(db, async () => {
      await db.exec('set transaction isolation level repeatable read');
      const counts = [];
      for (const t of entities) {
        const rows = await db.query(`select * from ${t} order by ${t === 'limits' ? 'key' : 'id'}`);
        fs.writeFileSync(path.join(dir, `${t}.json`), JSON.stringify(rows, null, 2) + '\n');
        counts.push({ entity: t, rows: rows.length });
      }
      fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ version: 1, at: new Date().toISOString(), counts }, null, 2) + '\n');
      return counts;
    });
  }

  if (cmd === 'import') return importLeon(db, a, flags);
  if (cmd === 'add') return transaction(db, () => add(db, a, flags));

  if (cmd === 'rate') return transaction(db, async () => {
    const c = await resolve(db, 'crew', a[0]);
    const type = required(a.slice(1).join(' '), 'aircraft type');
    return db.query('insert into ratings(crew_id,aircraft_type,rated_on) values($1,$2,$3) on conflict (crew_id,aircraft_type) do update set rated_on=excluded.rated_on returning aircraft_type,rated_on',
      [c.id, type, flags.date ? date(flags.date) : today()]);
  });

  if (cmd === 'quote') return transaction(db, async () => {
    const cl = await resolve(db, 'clients', flags.client);
    const ac = await resolve(db, 'aircraft', flags.aircraft);
    const pax = flags.pax ? number(flags.pax, 'pax', { min: 0 }) : 0;
    if (pax > ac.seats - 1) throw Error(`${ac.code} has ${ac.seats} seats including the pilot: ${pax} passengers will not fit`);
    const rate = flags.rate !== undefined ? number(flags.rate, 'rate', { min: 0 }) : ac.hourly_rate;
    if (rate === null || rate === undefined) throw Error(`${ac.code} has no hourly rate: give --rate`);
    return db.query('insert into quotes(code,client_id,aircraft_id,flight_date,route,pax,est_hours,rate,extras,valid_until) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning code,route,est_hours,rate,extras,price',
      [required(a[0], 'quote code'), cl.id, ac.id, date(flags.date), required(flags.route, 'route (--route)'), pax, number(flags.hours, 'estimated hours (--hours)', { positive: true }),
        rate, flags.extras ? number(flags.extras, 'extras', { min: 0 }) : 0, flags.valid ? date(flags.valid, 'valid until') : null]);
  });

  if (cmd === 'send' || cmd === 'decline') return transaction(db, async () => {
    const q = await resolve(db, 'quotes', a[0]);
    const from = cmd === 'send' ? ['draft'] : ['draft', 'sent'];
    if (!from.includes(q.status)) throw Error(`Quote ${q.code} is ${q.status}: cannot ${cmd}`);
    if (cmd === 'send') return db.query("update quotes set status='sent',sent_on=current_date,valid_until=coalesce(valid_until,current_date+14) where id=$1 returning code,status,sent_on,valid_until", [q.id]);
    return db.query("update quotes set status='declined' where id=$1 returning code,status", [q.id]);
  });

  if (cmd === 'book') return transaction(db, async () => {
    const q = await resolve(db, 'quotes', a[0]);
    if (q.status !== 'sent') throw Error(`Quote ${q.code} is ${q.status}: only a sent quote can be booked`);
    if (q.valid_until && ymd(q.valid_until) < today()) throw Error(`Quote ${q.code} expired on ${ymd(q.valid_until)}: requote or extend it first`);
    const pilot = flags.pilot ? await resolve(db, 'crew', flags.pilot) : null;
    await db.query("update quotes set status='accepted' where id=$1", [q.id]);
    return db.query('insert into trips(code,client_id,quote_id,aircraft_id,pic_id,flight_date,purpose) values($1,$2,$3,$4,$5,$6,$7) returning code,flight_date,status',
      [required(a[1], 'trip code'), q.client_id, q.id, q.aircraft_id, pilot?.id || null, ymd(q.flight_date), flags.purpose || 'charter']);
  });

  if (cmd === 'leg') return transaction(db, async () => {
    const t = await resolve(db, 'trips', a[0]);
    if (!['planned', 'confirmed'].includes(t.status)) throw Error(`Trip ${t.code} is ${t.status}: legs can only be added before it flies`);
    const ac = (await db.query('select * from aircraft where id=$1', [t.aircraft_id]))[0];
    const pax = flags.pax ? number(flags.pax, 'pax', { min: 0 }) : 0;
    if (pax > ac.seats - 1) throw Error(`${ac.code} has ${ac.seats} seats including the pilot: ${pax} passengers will not fit`);
    const n = (await db.query('select coalesce(max(seq),0)+1 n from legs where trip_id=$1', [t.id]))[0].n;
    return db.query('insert into legs(trip_id,seq,dep,arr,std,pax) values($1,$2,$3,$4,$5,$6) returning seq,dep,arr,std,pax',
      [t.id, n, required(flags.from, 'from (--from)').toUpperCase(), required(flags.to, 'to (--to)').toUpperCase(), flags.std ? when(flags.std, ymd(t.flight_date), 'std') : null, pax]);
  });

  if (cmd === 'assign') return transaction(db, async () => {
    const t = await resolve(db, 'trips', a[0]);
    if (!['planned', 'confirmed'].includes(t.status)) throw Error(`Trip ${t.code} is ${t.status}: cannot change the pilot`);
    const c = await resolve(db, 'crew', flags.pilot);
    if (!c.active || c.role !== 'pilot') throw Error(`${c.code} is not an active pilot`);
    await db.query('update trips set pic_id=$2 where id=$1', [t.id, c.id]);
    const problems = (await db.query('select problems from v_schedule where code=$1', [t.code]))[0]?.problems || '';
    const pilotProblems = problems.split('; ').filter((p) => /pilot|flight review|operator check/.test(p) && p !== 'no pilot');
    if (pilotProblems.length && !flags.force) throw Error(`${c.code} cannot take ${t.code}: ${pilotProblems.join('; ')}. Fix the record, pick another pilot, or the chief pilot adds --force`);
    return [{ trip: t.code, pilot: c.code, problems: problems || 'none' }];
  });

  if (['confirm', 'cancel', 'complete'].includes(cmd)) return transaction(db, async () => {
    const t = await resolve(db, 'trips', a[0]);
    const from = { confirm: ['planned'], cancel: ['planned', 'confirmed'], complete: ['confirmed'] }[cmd];
    if (!from.includes(t.status)) throw Error(`Trip ${t.code} is ${t.status}: cannot ${cmd}`);
    const v = (await db.query('select legs,logged_legs from v_trips where trip_id=$1', [t.id]))[0];
    if (cmd === 'cancel' && v.logged_legs) throw Error(`Trip ${t.code} has logged legs: complete it instead`);
    if (cmd === 'confirm' && !v.legs) throw Error(`Trip ${t.code} has no legs: add them before confirming`);
    if (cmd === 'complete' && (!v.legs || v.logged_legs < v.legs)) throw Error(`Trip ${t.code} has ${v.legs - v.logged_legs} of ${v.legs} legs without block times: log them first`);
    const status = { confirm: 'confirmed', cancel: 'cancelled', complete: 'flown' }[cmd];
    return db.query('update trips set status=$2 where id=$1 returning code,status', [t.id, status]);
  });

  if (cmd === 'pax') return transaction(db, async () => {
    const t = await resolve(db, 'trips', a[0]);
    const ac = (await db.query('select * from aircraft where id=$1', [t.aircraft_id]))[0];
    const n = (await db.query('select count(*)::int n from passengers where trip_id=$1', [t.id]))[0].n;
    if (n + 1 > ac.seats - 1) throw Error(`${ac.code} has ${ac.seats} seats including the pilot: the manifest is full`);
    return db.query('insert into passengers(trip_id,name,weight_kg,bags_kg) values($1,$2,$3,$4) returning name,weight_kg,bags_kg',
      [t.id, required(a.slice(1).join(' '), 'passenger name'), number(flags.weight, 'weight kg (--weight)', { positive: true }), flags.bags ? number(flags.bags, 'bags kg', { min: 0 }) : 0]);
  });

  if (cmd === 'fly') return transaction(db, async () => {
    const t = await resolve(db, 'trips', a[0]);
    if (t.status !== 'confirmed') throw Error(`Trip ${t.code} is ${t.status}: only a confirmed trip can be logged`);
    if (!t.pic_id) throw Error(`Trip ${t.code} has no pilot recorded`);
    const seq = number(a[1], 'leg number', { positive: true });
    const leg = (await db.query('select * from legs where trip_id=$1 and seq=$2', [t.id, seq]))[0];
    if (!leg) throw Error(`Trip ${t.code} has no leg ${seq}`);
    if (leg.block_on) throw Error(`Leg ${seq} of ${t.code} is already logged`);
    const day = ymd(t.flight_date);
    const off = when(flags.off, day, 'block off'); let on = when(flags.on, day, 'block on');
    if (Date.parse(on) <= Date.parse(off)) on = new Date(Date.parse(on) + 86400000).toISOString();
    if (Date.parse(on) > Date.now()) throw Error(`Block on ${on.slice(0, 16)} is in the future: log the leg once it has flown`);
    const to = flags.takeoff ? when(flags.takeoff, day, 'take-off') : null; const ld = flags.landing ? when(flags.landing, day, 'landing') : null;
    if ((to && !ld) || (!to && ld)) throw Error('Give both --takeoff and --landing, or neither');
    if (to && (Date.parse(to) < Date.parse(off) || Date.parse(ld) > Date.parse(on) || Date.parse(ld) <= Date.parse(to))) throw Error('Take-off and landing must fall between block off and block on');
    return db.query('update legs set block_off=$2,block_on=$3,takeoff=$4,landing=$5,landings=$6,fuel_l=$7 where id=$1 returning seq,dep,arr,block_off,block_on,landings',
      [leg.id, off, on, to, ld, flags.landings !== undefined ? number(flags.landings, 'landings', { min: 0 }) : 1, flags.fuel ? number(flags.fuel, 'fuel litres', { min: 0 }) : null]);
  });

  if (cmd === 'duty') return transaction(db, async () => {
    const c = await resolve(db, 'crew', a[0]);
    const start = when(flags.start, today(), 'start'); const end = when(flags.end, start.slice(0, 10), 'end');
    if (Date.parse(end) <= Date.parse(start)) throw Error('A duty must end after it starts');
    const overlap = await db.query('select 1 from duties where crew_id=$1 and start_at<$3 and end_at>$2', [c.id, start, end]);
    if (overlap.length) throw Error(`${c.code} already has a duty overlapping ${start.slice(0, 16)} to ${end.slice(0, 16)}`);
    await db.query('insert into duties(crew_id,start_at,end_at,kind) values($1,$2,$3,$4)', [c.id, start, end, flags.kind || 'flying']);
    return db.query('select crew,kind,starts,ends,duty_hours,rest_before_hours from v_duties where crew=$1 and start_at=$2', [c.code, start]);
  });

  if (cmd === 'renew') return transaction(db, async () => {
    const c = await resolve(db, 'crew', a[0]);
    const col = { medical: 'medical_expiry', review: 'flight_review_on', check: 'competency_on' }[a[1]];
    if (!col) throw Error('Use renew <crew> medical|review|check --date=YYYY-MM-DD (medical takes the new expiry date)');
    const d = date(flags.date);
    if (col !== 'medical_expiry' && d > today()) throw Error(`A ${a[1]} date is the day it was passed, not a future date`);
    return db.query(`update crew set ${col}=$2 where id=$1 returning code,${col}`, [c.id, d]);
  });

  if (cmd === 'defect') return transaction(db, async () => {
    const ac = await resolve(db, 'aircraft', a[0]);
    const description = required(a.slice(1).join(' '), 'defect description');
    const n = (await db.query('select count(*)::int n from defects', []))[0].n + 1;
    const code = `DEF-${String(n).padStart(2, '0')}`;
    if (flags.defer) {
      const due = date(flags.due, 'deferral due date (--due)');
      return db.query('insert into defects(code,aircraft_id,raised_on,description,deferred,due_on) values($1,$2,current_date,$3,true,$4) returning code,description,deferred,due_on', [code, ac.id, description, due]);
    }
    await db.query("update aircraft set status='unserviceable' where id=$1 and status='serviceable'", [ac.id]);
    return db.query('insert into defects(code,aircraft_id,raised_on,description) values($1,$2,current_date,$3) returning code,description,deferred', [code, ac.id, description]);
  });

  if (cmd === 'clear') return transaction(db, async () => {
    const d = await resolve(db, 'defects', a[0]);
    if (d.cleared_on) throw Error(`${d.code} was cleared on ${ymd(d.cleared_on)}`);
    return db.query('update defects set cleared_on=current_date,cleared_ref=$2 where id=$1 returning code,cleared_on,cleared_ref', [d.id, required(flags.ref, 'work order or certificate reference (--ref)')]);
  });

  if (cmd === 'serviceable') return transaction(db, async () => {
    const ac = await resolve(db, 'aircraft', a[0]);
    if (!['on', 'off'].includes(a[1])) throw Error('Use serviceable <aircraft> on|off');
    if (a[1] === 'on') {
      const open = await db.query('select code from defects where aircraft_id=$1 and cleared_on is null and not deferred', [ac.id]);
      if (open.length) throw Error(`${ac.code} has open defects not deferred: ${open.map((r) => r.code).join(', ')}. Clear or defer them first`);
    }
    return db.query('update aircraft set status=$2 where id=$1 returning code,status', [ac.id, a[1] === 'on' ? 'serviceable' : 'unserviceable']);
  });

  if (cmd === 'check-done') return transaction(db, async () => {
    const ac = await resolve(db, 'aircraft', a[0]);
    const now = (await db.query('select hours from v_fleet where aircraft_id=$1', [ac.id]))[0].hours;
    const next = number(flags.next, 'next check due at airframe hours (--next)', { positive: true });
    if (next <= Number(now)) throw Error(`Next check at ${next} hours is not after the airframe's ${now} hours`);
    return db.query('update aircraft set next_check_hours=$2,next_check_name=coalesce($3,next_check_name),arc_expiry=coalesce($4,arc_expiry) where id=$1 returning code,next_check_name,next_check_hours,arc_expiry',
      [ac.id, next, flags.name || null, flags.arc ? date(flags.arc, 'airworthiness review expiry') : null]);
  });

  if (cmd === 'limit') return transaction(db, async () => {
    const rows = await db.query('update limits set value=$2 where key=$1 returning key,value,unit', [required(a[0], 'limit key'), number(a[1], 'limit value', { positive: true })]);
    if (!rows.length) throw Error(`No limit ${a[0]}. Known: ${(await db.query('select key from limits order by key')).map((r) => r.key).join(', ')}`);
    return rows;
  });

  if (cmd === 'invoice') return transaction(db, async () => {
    const t = await resolve(db, 'trips', a[0]);
    if (t.status !== 'flown') throw Error(`Trip ${t.code} is ${t.status}: only a flown trip is invoiced`);
    if (t.invoice_ref) throw Error(`Trip ${t.code} is already on ${t.invoice_ref}`);
    return db.query('update trips set invoice_ref=$2 where id=$1 returning code,invoice_ref', [t.id, required(flags.ref, 'invoice reference (--ref)')]);
  });

  if (cmd === 'log') return transaction(db, async () => {
    const t = await resolve(db, 'trips', a[0]);
    return db.query('insert into notes(trip_id,body) values($1,$2) returning body', [t.id, required(a.slice(1).join(' '), 'note')]);
  });

  if (cmd === 'draft-quote' || cmd === 'draft-confirmation') return draft(db, cmd, a[0]);

  throw Error(`Unknown command: ${cmd}. Run help.`);
}

async function add(db, a, flags) {
  const [type, code, ...rest] = a;
  const name = rest.join(' ');
  const base = async () => (flags.base ? (await resolve(db, 'bases', flags.base)).id : null);
  if (type === 'base') return db.query('insert into bases(code,name,country,certificate_ref) values($1,$2,$3,$4) returning code,name',
    [required(code, 'code'), required(name, 'name'), required(flags.country, 'country (--country=NZ|AU)').toUpperCase(), flags.certificate || null]);
  if (type === 'aircraft') return db.query('insert into aircraft(code,type,kind,base_id,seats,payload_kg,hourly_rate,hours_base,next_check_hours,next_check_name,arc_expiry) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning code,type,seats',
    [required(code, 'registration').toUpperCase(), required(flags.type, 'type (--type)'), flags.kind || 'helicopter', await base(), number(flags.seats, 'seats (--seats)', { positive: true }),
      flags.payload ? number(flags.payload, 'payload kg', { positive: true }) : null, flags.rate ? number(flags.rate, 'rate', { min: 0 }) : null, flags.hours ? number(flags.hours, 'airframe hours', { min: 0 }) : 0,
      flags['next-check'] ? number(flags['next-check'], 'next check hours', { positive: true }) : null, flags['check-name'] || null, flags.arc ? date(flags.arc, 'airworthiness review expiry') : null]);
  if (type === 'crew') return db.query('insert into crew(code,name,base_id,licence_ref,weight_kg,medical_class,medical_expiry,flight_review_on,competency_on,email,phone) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning code,name',
    [required(code, 'code'), required(name, 'name'), await base(), flags.licence || null, flags.weight ? number(flags.weight, 'weight kg', { positive: true }) : null,
      flags['medical-class'] ? number(flags['medical-class'], 'medical class', { positive: true }) : null, flags.medical ? date(flags.medical, 'medical expiry') : null,
      flags.review ? date(flags.review, 'flight review date') : null, flags.check ? date(flags.check, 'competency check date') : null, flags.email || null, flags.phone || null]);
  if (type === 'client') return db.query('insert into clients(code,name,email,phone) values($1,$2,$3,$4) returning code,name', [required(code, 'code'), required(name, 'name'), flags.email || null, flags.phone || null]);
  if (type === 'trip') {
    const ac = await resolve(db, 'aircraft', flags.aircraft);
    if (ac.status === 'inactive') throw Error(`${ac.code} is inactive`);
    const cl = flags.client ? await resolve(db, 'clients', flags.client) : null;
    const pilot = flags.pilot ? await resolve(db, 'crew', flags.pilot) : null;
    return db.query('insert into trips(code,client_id,aircraft_id,pic_id,flight_date,purpose) values($1,$2,$3,$4,$5,$6) returning code,flight_date,status',
      [required(code, 'trip code'), cl?.id || null, ac.id, pilot?.id || null, date(flags.date), flags.purpose || (cl ? 'charter' : 'positioning')]);
  }
  throw Error('Add one of: base, aircraft, crew, client, trip');
}

// Leon Report Wizard exports (CSV). Column headings follow the Leon scope; map others with --map.
const importFiles = [
  { match: /^(fleet|aircraft)/, entity: 'aircraft' },
  { match: /^(crew|users)/, entity: 'crew' },
  { match: /^(clients?|customers?)/, entity: 'clients' },
  { match: /^(flights?|journey|trips?)/, entity: 'flights' },
];

async function importLeon(db, a, flags) {
  if (a[0] !== 'leon') throw Error('Supported import: leon. See docs/replace-leon.md');
  const dir = path.resolve(required(a[1], 'folder of Leon CSV exports'));
  const mapping = flags.map ? JSON.parse(fs.readFileSync(flags.map, 'utf8')) : {};
  const files = fs.readdirSync(dir).filter((n) => /\.csv$/i.test(n));
  if (!files.length) throw Error(`No CSV files in ${dir}`);
  const rank = (f) => { const i = importFiles.findIndex((x) => x.match.test(f.toLowerCase())); return i < 0 ? 9 : i; };
  files.sort((x, y) => rank(x) - rank(y) || x.localeCompare(y));
  return transaction(db, async () => {
    const out = [];
    for (const file of files) {
      const spec = importFiles.find((x) => x.match.test(file.toLowerCase()));
      if (!spec) throw Error(`Unrecognised file ${file}: expected Fleet, Crew, Clients or Flights. See docs/replace-leon.md`);
      const rows = parseCsv(fs.readFileSync(path.join(dir, file), 'utf8'));
      if (!rows.length) throw Error(`Empty file: ${file}`);
      let added = 0;
      for (const raw of rows) {
        const row = { ...raw };
        for (const [ours, theirs] of Object.entries(mapping[spec.entity] || {})) {
          if (!(theirs in raw)) throw Error(`${file}: mapped column "${theirs}" is not in the file`);
          row[ours] = raw[theirs];
        }
        if (spec.entity === 'aircraft') {
          const rego = required(pick(row, 'Registration', 'Aircraft', 'Reg'), `${file}: Registration`).toUpperCase();
          const capacity = pick(row, 'Capacity', 'Seats', 'PAX capacity');
          await db.query('insert into aircraft(code,type,seats,hourly_rate,status) values($1,$2,$3,$4,$5) on conflict(code) do update set type=excluded.type,seats=excluded.seats,hourly_rate=coalesce(excluded.hourly_rate,aircraft.hourly_rate)',
            [rego, required(pick(row, 'Type', 'Aircraft type', 'ICAO type'), `${file} ${rego}: Type`), capacity ? number(capacity, `${file} ${rego}: Capacity`, { positive: true }) + 1 : 2,
              pick(row, 'Base price', 'Hourly rate') ? number(pick(row, 'Base price', 'Hourly rate'), `${file} ${rego}: Base price`, { min: 0 }) : null,
              /inactive|sold/i.test(pick(row, 'Status')) ? 'inactive' : 'serviceable']);
        } else if (spec.entity === 'crew') {
          const code = required(pick(row, 'Code', 'Crew code', 'Login'), `${file}: Code`).toUpperCase();
          const first = pick(row, 'Name', 'First name'); const last = pick(row, 'Surname', 'Last name');
          await db.query('insert into crew(code,name,email,phone) values($1,$2,$3,$4) on conflict(code) do update set name=excluded.name,email=coalesce(excluded.email,crew.email),phone=coalesce(excluded.phone,crew.phone)',
            [code, required([first, last].filter(Boolean).join(' '), `${file} ${code}: Name`), pick(row, 'Email', 'E-mail') || null, pick(row, 'Phone', 'Mobile') || null]);
        } else if (spec.entity === 'clients') {
          const name = required(pick(row, 'Client', 'Client name', 'Name', 'Company'), `${file}: Client name`);
          const code = (pick(row, 'Code', 'Client code') || name.replace(/[^A-Za-z0-9]+/g, '').slice(0, 12)).toUpperCase();
          await db.query('insert into clients(code,name,email,phone) values($1,$2,$3,$4) on conflict(code) do update set name=excluded.name,email=coalesce(excluded.email,clients.email),phone=coalesce(excluded.phone,clients.phone)',
            [code, name, pick(row, 'Email', 'E-mail') || null, pick(row, 'Phone') || null]);
        } else {
          await importFlight(db, file, row);
        }
        added++;
      }
      out.push({ file, entity: spec.entity, rows: added, dry_run: Boolean(flags['dry-run']) });
    }
    return out;
  }, Boolean(flags['dry-run']));
}

// One Report Wizard flight row is one leg. Rows sharing a trip number become one trip.
async function importFlight(db, file, row) {
  const day = date(required(pick(row, 'Date', 'DATE ADEP Plan UTC', 'Flight date'), `${file}: Date`).slice(0, 10), `${file}: Date`);
  const rego = required(pick(row, 'Registration', 'Aircraft'), `${file} ${day}: Registration`).toUpperCase();
  const ac = (await db.query('select id from aircraft where lower(code)=lower($1)', [rego]))[0];
  if (!ac) throw Error(`${file}: flight on ${day} names aircraft ${rego}, which is not in the database or the Fleet file`);
  const tripNo = pick(row, 'Trip number', 'Trip No', 'Trip') || `${pick(row, 'Flight number', 'Flight No') || rego}-${day}`;
  const code = `L-${tripNo}`;
  const cmdCode = pick(row, 'Commander code', 'CMD', 'PIC');
  const pic = cmdCode ? (await db.query('select id from crew where lower(code)=lower($1)', [cmdCode]))[0] : null;
  if (cmdCode && !pic) throw Error(`${file}: flight on ${day} names commander ${cmdCode}, who is not in the database or the Crew file`);
  const clientName = pick(row, 'Client', 'Client name');
  const cl = clientName ? (await db.query('select id from clients where lower(name)=lower($1) or lower(code)=lower($1)', [clientName]))[0] : null;
  const t = (await db.query("insert into trips(code,client_id,aircraft_id,pic_id,flight_date,purpose,status) values($1,$2,$3,$4,$5,$6,'confirmed') on conflict(code) do update set code=excluded.code returning id",
    [code, cl?.id || null, ac.id, pic?.id || null, day, cl ? 'charter' : 'other']))[0];
  const at = (v, n) => (v ? when(v.length > 5 ? v.replace(' ', 'T').slice(0, 16) : v, day, `${file} ${code} ${n}`) : null);
  const std = at(pick(row, 'STD UTC', 'STD'), 'STD');
  const dep = required(pick(row, 'ADEP ICAO [JL]', 'ADEP ICAO Plan', 'ADEP', 'From'), `${file} ${code}: ADEP`).toUpperCase();
  const arr = required(pick(row, 'ADES ICAO [JL]', 'ADES ICAO Plan', 'ADES', 'To'), `${file} ${code}: ADES`).toUpperCase();
  const exists = (await db.query('select 1 from legs where trip_id=$1 and dep=$2 and arr=$3 and std is not distinct from $4', [t.id, dep, arr, std])).length;
  if (exists) return;
  const seq = (await db.query('select coalesce(max(seq),0)+1 n from legs where trip_id=$1', [t.id]))[0].n;
  const off = at(pick(row, 'BLOFF [JL][UTC]', 'Block off'), 'block off'); let on = at(pick(row, 'BLON [JL][UTC]', 'Block on'), 'block on');
  if (off && on && Date.parse(on) <= Date.parse(off)) on = new Date(Date.parse(on) + 86400000).toISOString();
  const to = at(pick(row, 'T/O [JL][UTC]', 'Take off'), 'take-off'); let ld = at(pick(row, 'LDG [JL][UTC]', 'Landing'), 'landing');
  if (to && ld && Date.parse(ld) <= Date.parse(to)) ld = new Date(Date.parse(ld) + 86400000).toISOString();
  const pax = pick(row, 'PAX number', 'PAX', 'Passengers');
  const landings = pick(row, 'Landings [JL]', 'Landings', 'JL_landing_no');
  await db.query('insert into legs(trip_id,seq,dep,arr,std,pax,block_off,takeoff,landing,block_on,landings) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
    [t.id, seq, dep, arr, std, pax ? number(pax, `${file} ${code}: PAX`, { min: 0 }) : 0, off, to, ld, on, landings ? number(landings, `${file} ${code}: landings`, { min: 0 }) : 1]);
  const v = (await db.query('select legs,logged_legs from v_trips where trip_id=$1', [t.id]))[0];
  if (v.legs === v.logged_legs) await db.query("update trips set status='flown' where id=$1", [t.id]);
}

async function draft(db, cmd, ref) {
  const dir = path.resolve(process.env.OUTPUT_DIR || REPO_ROOT, 'drafts');
  fs.mkdirSync(dir, { recursive: true });
  let body; let code;
  if (cmd === 'draft-quote') {
    const q = await resolve(db, 'quotes', ref);
    const i = (await db.query('select q.*,cl.name client,cl.email,a.code aircraft,a.type,a.seats from quotes q join clients cl on cl.id=q.client_id join aircraft a on a.id=q.aircraft_id where q.id=$1', [q.id]))[0];
    code = i.code;
    body = `# DRAFT: charter quote ${i.code}\n\nTo: ${i.email || '(no email on file)'}\n\nHi ${i.client},\n\nThank you for asking. Here is our quote.\n\n- Date: ${ymd(i.flight_date)}\n- Route: ${i.route}\n- Aircraft: ${i.type} (${i.aircraft}), ${i.seats - 1} passenger seats\n- Passengers: ${i.pax}\n- Estimated flight time: ${i.est_hours} hours at ${i.rate} an hour\n${Number(i.extras) ? `- Landing fees and extras: ${i.extras}\n` : ''}- Total: ${i.price}\n- Valid until: ${i.valid_until ? ymd(i.valid_until) : 'to be set when sent'}\n\nFlight time is charged as flown. The flight goes ahead subject to weather and the pilot's decision on the day.\n\nFor review before sending. Nothing has been sent.\n`;
  } else {
    const t = await resolve(db, 'trips', ref);
    const i = (await db.query('select v.*,cl.email from v_trips v left join clients cl on cl.name=v.client where v.trip_id=$1', [t.id]))[0];
    if (!i.client) throw Error(`Trip ${i.code} has no client to confirm with`);
    const legs = await db.query('select seq,dep,arr,std,pax from v_legs where trip=$1 order by seq', [i.code]);
    const sched = (await db.query('select problems from v_schedule where code=$1', [i.code]))[0];
    code = i.code;
    body = `# DRAFT: flight confirmation for ${i.code}\n\nTo: ${i.email || '(no email on file)'}\n\nHi ${i.client},\n\nConfirming your flight on ${ymd(i.flight_date)}.\n\n| Leg | From | To | Departs (UTC) | Passengers |\n|---|---|---|---|---|\n${legs.map((l) => `| ${l.seq} | ${l.dep} | ${l.arr} | ${l.std || 'to be agreed'} | ${l.pax} |`).join('\n')}\n\n- Aircraft: ${i.aircraft_type} (${i.aircraft})\n- Pilot: ${i.pic_name || 'to be confirmed'}\n\nPlease send each passenger's name and weight, and the weight of any bags, before the day: we need them for the manifest and the load.\n\n${sched?.problems ? `REVIEW BEFORE SENDING: ${sched.problems}. Sort these out with the chief pilot first.\n\n` : ''}For review before sending. Nothing has been sent.\n`;
  }
  const file = path.join(dir, `${cmd.replace('draft-', '')}-${code}-${Date.now()}.md`);
  fs.writeFileSync(file, body);
  return [{ file, record: code }];
}

function print(value) {
  if (Array.isArray(value)) { console.log(value.length ? table(value, Object.keys(value[0]).map((key) => ({ key, label: key, format: fmt }))) : '(none)'); return; }
  for (const [key, v] of Object.entries(value)) { console.log(`\n${key}`); print(Array.isArray(v) ? v : [v]); }
}
function fmt(v) {
  if (v instanceof Date) return v.toISOString().slice(0, v.getUTCHours() || v.getUTCMinutes() ? 16 : 10).replace('T', ' ');
  if (v === true) return 'yes';
  if (v === false) return 'no';
  return v;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let db;
  try {
    db = await getDb();
    const out = await run(db, process.argv.slice(2));
    if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 2)); else print(out);
  } catch (e) { console.error(e.message); process.exitCode = 1; }
  finally { await db?.close(); }
}
