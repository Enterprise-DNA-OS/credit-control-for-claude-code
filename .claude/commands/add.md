---
description: add for the credit-control desk.
---

Run: npm run credit -- add --customer= --number= --currency= --issued=YYYY-MM-DD --due=YYYY-MM-DD --total= --outstanding= --as-of=YYYY-MM-DD --evidence= --actor=

Read the relevant customer or invoice first. Use the operator name in --actor and the supplied evidence. Refuse ambiguous records or missing facts. Report exactly what was recorded.

Options use --name=value. Add --json for structured output. Use only synthetic records for a demo. All correspondence stays in drafts/.
