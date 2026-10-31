---
description: Add a passenger to the manifest with weight and bags
---

Run `npm run ops -- pax <trip> <name> --weight=kg [--bags=kg]`. The manifest cannot exceed the seats. Read the trip payload back from `/trip` after.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
