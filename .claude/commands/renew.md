---
description: Record a new medical expiry, flight review or operator competency check
---

Run `npm run ops -- renew <crew> medical|review|check --date=YYYY-MM-DD`. For a medical the date is the new expiry on the certificate; for a review or check it is the day it was passed. Ask to see the certificate or record first.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
