---
description: Each aircraft's airframe hours, hours to the next check, airworthiness review expiry and open defects
---

Run `npm run ops -- fleet --json`. Present it as a short table in the operator's words, anything overdue or within 10 hours first. Say plainly if it is empty. Times are UTC. Never change a record from this command.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
