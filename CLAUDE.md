# Flight Ops for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** [YOUR BUSINESS]
- **Operator:** [YOUR NAME], [your role]
- **What matters most:** [the one or two outcomes you care about]

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a record, read its full history first.
3. **Plain language.** Short sentences. No filler. Numbers in tables.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces a customer waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| tomorrow's flying, go or no-go | `/flying-tomorrow`, `/tomorrow` |
| what needs chasing | `/attention` |
| the schedule from today on | `/schedule` |
| a price for a charter | `/quote`, `/draft-quote`, `/send`, `/decline` |
| the client said yes | `/book`, `/leg`, `/confirm`, `/draft-confirmation` |
| who flies it | `/assign`, `/pilot`, `/currency` |
| passengers and weights | `/pax`, `/trip` |
| log the day's flying | `/end-of-day`, `/to-log`, `/fly`, `/duty`, `/complete` |
| a correction to a logged leg | `/log` |
| hours, duty and rest against the limits | `/crew-hours`, `/duties`, `/crew-check` |
| the chief pilot's review | `/chief-pilot` |
| new medical, review or check | `/renew` |
| a type rating | `/rate` |
| aircraft hours, checks, reviews | `/fleet`, `/fleet-check`, `/check-done` |
| a defect | `/defect`, `/clear`, `/serviceable`, `/defects` |
| hours flown per aircraft | `/utilisation` |
| invoicing | `/uninvoiced`, `/invoice`, `/client-flying` |
| how quotes are converting | `/quote-conversion`, `/quotes` |
| the Monday review | `/weekly-review` |
| records against the rules | `/compliance` |
| the flight and duty limits | `/limits`, `/limit` |
| new base, aircraft, crew, client or trip | `/add` |
| lists | `/bases`, `/aircraft`, `/crew`, `/clients`, `/trips`, `/journey-log` |
| bring data from Leon | `/import` |
| a copy of everything | `/export` |
| change a field or rule | `/customise` |
| a new dashboard | `/new-view` |

If an ask fits nothing here, run the CLI directly (`npm run ops -- help`) and then propose a new command for it.

## Hard rules

- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Prefer marking closed or archived.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so.
- Every time is UTC. Say so when you show one.
- A logged leg keeps its block times, air times and landings. Corrections are a note on the trip, never an edit.
- Never override a pilot check (`assign --force`), defer a defect or change a limit on your own judgement. The chief pilot, the engineer or the person named in the exposition says yes in this session.
- The limits table holds the operator's scheme. Never tell anyone a flight is legal or a pilot is fit to fly; say what the records show against the limits set.
- A trip with a problem goes to the chief pilot before the client hears anything.

## Where things live

- `scripts/` the CLI. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/` the thesis and the guide for moving off Leon Software.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/leon
