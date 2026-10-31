---
description: Add a base, aircraft, crew member, client or trip
---

Run `npm run ops -- add base|aircraft|crew|client|trip ...` (see `npm run ops -- help` for the flags). Ask for anything required that the operator did not give. Read the new record back.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
