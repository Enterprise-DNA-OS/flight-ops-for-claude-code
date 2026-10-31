---
description: Clear a defect against a work order or certificate reference
---

Run `npm run ops -- clear <defect> --ref=<work order>`. A reference is required. Then `/serviceable` if no open defect is left.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
