---
description: Raise a defect on an aircraft, or record a deferred one with its due date
---

Run `npm run ops -- defect <aircraft> <description>`; this makes the aircraft unserviceable. A deferral the engineer has approved under your exposition uses `--defer --due=YYYY-MM-DD`. Never defer a defect on your own judgement.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
