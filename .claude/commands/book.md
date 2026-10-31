---
description: Turn an accepted quote into a trip
---

Run `npm run ops -- book <quote> <trip code> [--pilot=..]`. Only a sent quote inside its validity can be booked. Then add legs with `/leg` and the manifest with `/pax`.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
