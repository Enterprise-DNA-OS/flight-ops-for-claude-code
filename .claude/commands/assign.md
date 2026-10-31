---
description: Put a pilot on a trip, checking rating, medical, flight review, operator check and passenger recency
---

Run `npm run ops -- assign <trip> --pilot=..`. If it refuses, say why in plain words and suggest a pilot who passes (run `currency` and `crew-hours`). Only the chief pilot can override with `--force`; ask before using it.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
