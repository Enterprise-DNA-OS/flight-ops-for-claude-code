---
description: Record a crew duty period, with the rest before it shown
---

Run `npm run ops -- duty <crew> --start=YYYY-MM-DDTHH:MM --end=YYYY-MM-DDTHH:MM [--kind=flying|standby|ground|training]`. Times are UTC. Show the duty length and rest before it, and run `crew-check` if either is near a limit.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
