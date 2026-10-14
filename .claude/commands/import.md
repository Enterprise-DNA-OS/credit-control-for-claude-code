---
description: import for the credit-control desk.
---

Run: npm run credit -- import chaser --file= --entity= --as-of=YYYY-MM-DD --actor= [--currency=NZD] [--map=examples/import-map.json] [--dry-run]

Read docs/replace-chaser.md. Confirm entity, snapshot date, original or base currency and column map. Run the command with --dry-run first. Review row counts, then run without --dry-run for the requested import. Record disputes and holds from the source and verify contacts before reconcile --reviewed. Never claim unmapped history transferred.

Options use --name=value. Add --json for structured output. Use only synthetic records for a demo. All correspondence stays in drafts/.
