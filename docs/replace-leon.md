# Moving off Leon Software

Leon exports any scope from its Report Wizard to CSV or Excel ([wiki.leonsoftware.com/wiki/report-wizard](https://wiki.leonsoftware.com/wiki/report-wizard)). Save four reports as CSV into one folder, run a dry run, check the counts, then run it for real.

```bash
npm run ops -- import leon ./leon-export --dry-run
npm run ops -- import leon ./leon-export
```

The import runs in one transaction: if any row fails, nothing is written. Running it twice changes nothing.

## The files

| File name starts with | Becomes | Columns read |
|---|---|---|
| `Fleet` or `Aircraft` | aircraft | Registration, Type (or Aircraft type), Capacity (passenger seats; the pilot seat is added), Status, Base price |
| `Crew` or `Users` | crew | Code (the crew code Leon uses as Commander code), Name, Surname, Email, Phone |
| `Clients` | clients | Client name (or Client, Name, Company), Code, Email, Phone |
| `Flights` or `Journey` | trips and legs | Trip number, Date, Flight number, Registration, ADEP ICAO [JL] or ADEP ICAO Plan, ADES ICAO [JL] or ADES ICAO Plan, STD UTC, BLOFF [JL][UTC], T/O [JL][UTC], LDG [JL][UTC], BLON [JL][UTC], Commander code, PAX number, Landings [JL], Client |

In the Flight scope, add the journey log columns (the ones marked [JL]) so block and air times come across. Rows that share a trip number become one trip, in departure order. A trip whose every leg has a block on time comes in as flown; the rest come in as confirmed. Times are read as UTC. A landing or block on earlier than take-off or block off is read as the next day.

## Different headings

If your layout names a column differently, write a mapping file from our heading to yours and pass it with `--map`:

```json
{ "aircraft": { "Registration": "Reg mark", "Type": "Model", "Capacity": "Pax seats" },
  "flights": { "Commander code": "PIC" } }
```

## What to set after the import

- Base, payload, airframe hours, next check and airworthiness review expiry for each aircraft (`/add` fields, or ask for them in plain language).
- Each pilot's medical expiry, flight review date, operator check date, weight and type ratings (`/renew`, `/rate`).
- Your flight and duty scheme in the limits table (`/limit`).

## What does not carry over in the free version

- Quotes, invoices and pricing rules. Bring open quotes across by hand; the history stays in your Leon export.
- Leon's FTL configuration. The limits here are the numbers you set, not your Leon rules.
- Duty rosters. Import them as duty periods with `/customise`, or record them from now on.
- Documents, passenger documents, checklists, handling requests, the crew app, the owner app and integrations such as Avinode.

Enterprise DNA maps a full Leon history, including rosters and quotes, as part of an install.
