---
description: Every flight and duty, medical, review, operator check, recency and rating finding for the crew
---

Run `npm run ops -- crew-check --json`. Present it as a short table in the operator's words, with the rule each one comes from in docs/compliance.md. Say plainly if it is empty. Times are UTC. Never change a record from this command.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
