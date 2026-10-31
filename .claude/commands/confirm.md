---
description: Confirm a trip with legs once the client has said yes
---

Run `npm run ops -- confirm <trip>`. A trip needs at least one leg. Offer `/draft-confirmation` after.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
