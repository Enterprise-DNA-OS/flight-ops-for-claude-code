---
description: Price a charter: aircraft, route, estimated hours, rate and extras
---

Run `npm run ops -- quote <code> --client=.. --aircraft=.. --date=YYYY-MM-DD --route=".." --hours=.. [--pax=n] [--rate=..] [--extras=..] [--valid=YYYY-MM-DD]`. The rate defaults to the aircraft's hourly rate. Read the price back, then offer `/draft-quote`.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
