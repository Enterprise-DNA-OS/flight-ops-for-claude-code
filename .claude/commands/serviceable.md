---
description: Mark an aircraft serviceable or unserviceable
---

Run `npm run ops -- serviceable <aircraft> on|off`. It refuses to go serviceable while a defect is open and not deferred.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
