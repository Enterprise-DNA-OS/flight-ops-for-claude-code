<h1 align="center">Flight Ops for Claude Code</h1>

<p align="center">
  <strong>The open-source charter and helicopter flight operations system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Leon Software data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=leon">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/leon?utm_source=github&utm_medium=readme&utm_campaign=leon">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-leon">Instead of Leon Software</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Flight Ops for Claude Code does the job you pay Leon Software for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions the Leon Software dashboard cannot.

Leon bills per active aircraft per month. Its published PRO price is EUR 350 per aircraft per month under 50,000 lb take-off weight ([leonsoftware.com/pricing](https://www.leonsoftware.com/pricing.html)), so a ten-aircraft charter or helicopter operator pays EUR 3,500 a month, EUR 42,000 a year, and the bill grows with every tail you add.

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=leon).

It is for charter, scenic, helicopter and survey operators with a handful to a few dozen aircraft in New Zealand and Australia. It holds quotes, trips and legs, the journey log, passenger manifests and payload, crew duty periods against your flight and duty scheme, medicals, flight reviews, operator checks, passenger recency and type ratings, airframe hours to the next check, airworthiness reviews and the defect list, in one database. It does not file flight plans, track aircraft live or talk to a booking marketplace.

The fictional Southern Lakes Air demo has two Queenstown and Milford Sound bases and one in Cairns, four aircraft and five pilots. Tomorrow one trip has a pilot whose medical expired five days ago, one is 31 kg over payload with the film crew's gear, and one has no pilot on an aeroplane whose airworthiness review lapsed. A pilot did a 13 hour duty and then had 8 hours rest before the next one, a scenic trip flew four passengers with two on the manifest, the AS350 is 8 hours from its 100 hourly and a deferred defect ran past its date.

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No seats, no tiers, no add-ons. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/flight-ops-for-claude-code.git
cd flight-ops-for-claude-code
npm install
npm run demo
```

Then open the folder in Claude Code and type `/flying-tomorrow` for tomorrow's go or no-go list, or `/attention` for everything that needs chasing. `npm run view` writes the week, crew and fleet views to `views/`; `npm run docs` writes flight briefs, passenger manifests, journey logs, charter quotes and pilot records to `docs-out/`, in the brand set in `brand.json`.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## The commands

The working week, in the ops desk's and the chief pilot's words: `/flying-tomorrow` the afternoon before, `/assign` and `/pax` as trips fill, `/end-of-day` when the aircraft are back, `/chief-pilot` and `/fleet-check` for the people who sign for crew and aircraft, `/weekly-review` on Monday.

| Command | What it does |
|---|---|
| `/add` | Add a base, aircraft, crew member, client or trip |
| `/aircraft` | The fleet list: registration, type, base, seats, payload, hourly rate and status |
| `/assign` | Put a pilot on a trip, checking rating, medical, flight review, operator check and passenger recency |
| `/attention` | What needs chasing today: unconfirmed trips, trips with problems, quotes waiting, flying not logged or invoiced, medicals, checks and deferrals due |
| `/bases` | Bases, their country and the operator certificate each flies under |
| `/book` | Turn an accepted quote into a trip |
| `/cancel` | Cancel a trip that has not flown |
| `/check-done` | Record a maintenance check done: when the next is due and the new airworthiness review expiry |
| `/chief-pilot` | The chief pilot review: hours against limits, duty and rest, currency and ratings |
| `/clear` | Clear a defect against a work order or certificate reference |
| `/client-flying` | Trips, hours and charges per client over the last 90 days, with what is not invoiced |
| `/clients` | Charter clients and their contacts |
| `/complete` | Close a trip once every leg is logged |
| `/compliance` | Check the records against the rules this industry lives under (the ones listed in docs/compliance.md) and report what is missing, late, or about to breach, with the rule cited. |
| `/confirm` | Confirm a trip with legs once the client has said yes |
| `/crew-check` | Every flight and duty, medical, review, operator check, recency and rating finding for the crew |
| `/crew-hours` | Flight hours in 7, 28 and 365 days and duty hours in 7 days, against the scheme limits |
| `/crew` | Pilots and crew, their base, licence, weight and the types each is rated on |
| `/currency` | Each pilot's medical expiry, flight review and operator check due dates, landings in 90 days and types |
| `/customise` | Make this system yours in plain language. Add a field, rename stages, change a rule, add a column to a document. Writes the migration, applies it, updates the commands that touch it. |
| `/decline` | Mark a quote as declined |
| `/defect` | Raise a defect on an aircraft, or record a deferred one with its due date |
| `/defects` | Open, deferred and cleared defects, with deferrals past their due date flagged |
| `/draft-confirmation` | Draft the flight confirmation for a client, asking for passenger names and weights |
| `/draft-quote` | Draft a charter quote email for a client |
| `/duties` | Duty periods with their length and the rest before each one |
| `/duty` | Record a crew duty period, with the rest before it shown |
| `/end-of-day` | Close the day: log every leg flown, record duties and complete the trips |
| `/export` | Export every record to JSON files |
| `/fleet-check` | The maintenance controller review: hours to checks, airworthiness reviews and defects |
| `/fleet` | Each aircraft's airframe hours, hours to the next check, airworthiness review expiry and open defects |
| `/fly` | Log a flown leg in the journey log: block times, air times, landings and fuel |
| `/flying-tomorrow` | The ops desk check the afternoon before: every trip tomorrow and what would stop it |
| `/import` | Bring the fleet, crew, clients and flight history across from Leon Report Wizard exports |
| `/invoice` | Record the invoice reference for a flown trip |
| `/journey-log` | Every logged sector: block off and on, block and air hours, landings, passengers and fuel |
| `/leg` | Add a sector to a trip: from, to, departure time and passengers |
| `/limit` | Change a flight and duty limit or currency setting |
| `/limits` | The flight and duty limits and currency settings every check uses |
| `/log` | Add a note to a trip, including a journey log correction |
| `/new-view` | Add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the operator's brand by `npm run view`. |
| `/pax` | Add a passenger to the manifest with weight and bags |
| `/pilot` | One pilot's currency, hours against the limits, recent duties and upcoming trips |
| `/quote-conversion` | Quotes by status with their value: how many get accepted |
| `/quote` | Price a charter: aircraft, route, estimated hours, rate and extras |
| `/quotes` | Every quote with route, hours, rate, price and whether it is draft, sent, accepted, declined or expired |
| `/rate` | Record that a pilot is rated and checked on an aircraft type |
| `/renew` | Record a new medical expiry, flight review or operator competency check |
| `/schedule` | Every trip from today on, in date and departure order, with what would stop it going |
| `/send` | Mark a quote as sent to the client |
| `/serviceable` | Mark an aircraft serviceable or unserviceable |
| `/to-log` | Legs that should have flown but have no block times yet |
| `/tomorrow` | Tomorrow's flying in departure order, with every reason a trip should not go as planned |
| `/trip` | One trip with its legs, manifest, payload, problems and notes |
| `/trips` | Every trip with client, aircraft, pilot, route, passengers, hours flown, charge and invoice |
| `/uninvoiced` | Flown trips with no invoice reference, oldest first, with the charge |
| `/utilisation` | Trips, hours and fuel for each aircraft over 30 and 90 days |
| `/weekly-review` | The Monday review written from the schedule, the crew, the fleet and the books |

Every command runs `npm run ops -- <command>`; add `--json` for machine output. Codes and names match without case; a prefix works when it is unique. An ambiguous name lists the candidates and exits with status 1. Every time is UTC, as a journey log is. Once a leg is back on blocks its times stay as written, and logged legs, duties and defects cannot be deleted.

## Ten questions to ask

Each one runs against the demo today.

1. Which trips tomorrow should not go as planned, and why? `tomorrow`
2. Which pilots are short of the take-offs and landings to carry passengers this week? `crew-check`
3. Who had less rest than the scheme allows before a duty in the last 90 days? `crew-check`
4. Which medicals, flight reviews and operator checks fall due in the next 45 days? `currency`
5. Which aircraft will reach its next check before the end of the week at its current rate? `fleet` and `utilisation`
6. Which deferred defects are past their date, and is anything booked on that aircraft? `defects` and `schedule`
7. Which flights carried more passengers than the manifest lists? `compliance`
8. Which trips tomorrow are over payload with the manifest weights? `tomorrow`
9. Which flown trips have no invoice yet, and what are they worth? `uninvoiced`
10. Which quotes are waiting on the client, and how many of our quotes get accepted? `attention` and `quote-conversion`

## Your first hour: ten things to ask for

1. Put our business name, logo and colours in brand.json.
2. Import our fleet, crew, clients and flight history from Leon and compare the counts.
3. Set every flight and duty limit to the ones in our approved scheme.
4. Set the operator check interval to six months for our IFR pilots.
5. Add night take-offs and landings to the recency check.
6. Add a fuel weight to the payload check on each leg.
7. Add landing fees per location to quotes.
8. Add a daily flight record document in the layout our exposition uses.
9. Put our cancellation and weather terms on the charter quote.
10. Move the database to a hosted Postgres with backups.

## Instead of Leon Software

Export your fleet, crew, clients and flights from Leon's Report Wizard as CSV and run `/import`, dry run first. [docs/replace-leon.md](docs/replace-leon.md) covers the headings, mapping files and what does not carry over in the free version (quotes and invoices, FTL configuration, documents, integrations and the crew app).

The record checks and their sources are in [docs/compliance.md](docs/compliance.md). They check your records against the limits you set; they do not approve a flight, replace your flight and duty scheme or your chief pilot.

Not affiliated with or endorsed by Leon Software.

## Architecture

```
flight-ops-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/                  the CLI the commands drive
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data
  docs/                     the thesis and the migration guide
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Flight Ops for Claude Code for your business, migrates your Leon Software data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=leon)
- Read more: [enterprisedna.co/omni/instead-of/leon](https://enterprisedna.co/omni/instead-of/leon?utm_source=github&utm_medium=readme&utm_campaign=leon)

## License

MIT. Copyright (c) 2026 Enterprise DNA.
