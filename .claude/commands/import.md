---
description: Bring the fleet, crew, clients and flight history across from Leon Report Wizard exports
---

Read docs/replace-leon.md. Run `npm run ops -- import leon <folder> --dry-run` first and show the counts. Map different headings with `--map=file.json`. Only run without `--dry-run` once the operator says yes. Compare counts afterwards and run `crew-hours` and `fleet`.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
