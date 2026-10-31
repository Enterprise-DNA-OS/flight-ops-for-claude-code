---
description: Add a sector to a trip: from, to, departure time and passengers
---

Run `npm run ops -- leg <trip> --from=.. --to=.. [--std=HH:MM] [--pax=n]`. Times are UTC. Passengers cannot exceed the aircraft's seats less the pilot.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
