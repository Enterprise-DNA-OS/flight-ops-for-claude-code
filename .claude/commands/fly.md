---
description: Log a flown leg in the journey log: block times, air times, landings and fuel
---

Run `npm run ops -- fly <trip> <leg> --off=HH:MM --on=HH:MM [--takeoff=HH:MM --landing=HH:MM] [--landings=n] [--fuel=litres]`. Times are UTC from the pilot's journey log. Once logged a leg cannot be edited: read the figures back before running it.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
