---
description: Mark a quote as sent to the client
---

Run `npm run ops -- send <quote>` once the operator has sent the quote themselves. It sets the sent date and a 14 day validity if none is set. This command records; it does not send.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
