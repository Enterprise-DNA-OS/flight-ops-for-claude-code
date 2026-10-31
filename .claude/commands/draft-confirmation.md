---
description: Draft the flight confirmation for a client, asking for passenger names and weights
---

Run `npm run ops -- draft-confirmation <trip>`. If the draft has a REVIEW BEFORE SENDING line, say so first: the problem goes to the chief pilot before the client hears anything.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
