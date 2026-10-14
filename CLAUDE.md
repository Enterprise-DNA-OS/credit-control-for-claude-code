# Credit Control for Claude Code: operating instructions

Read the database before answering. This is an internal B2B credit-control desk. The operator supplies the business context, their name, the entity and the accounting export date.

## Routing

- /customers: npm run credit -- customers
- /invoices: npm run credit -- invoices
- /ageing: npm run credit -- ageing
- /chase-list: npm run credit -- chase-list
- /promises-due: npm run credit -- promises-due
- /disputes: npm run credit -- disputes
- /attention: npm run credit -- attention
- /exposure: npm run credit -- exposure
- /activity: npm run credit -- activity
- /compliance: npm run credit -- compliance
- /source-check: npm run credit -- source-check
- /promise-plan: npm run credit -- promise-plan
- /history: npm run credit -- history
- /policy: npm run credit -- policy
- /customer: npm run credit -- customer <name-or-id>
- /invoice: npm run credit -- invoice <number-or-id>
- /weekly-review: npm run credit -- weekly-review
- /add-customer: npm run credit -- add-customer --entity= --account= --name= --owner= --actor=
- /add: npm run credit -- add --customer= --number= --currency= --issued=YYYY-MM-DD --due=YYYY-MM-DD --total= --outstanding= --as-of=YYYY-MM-DD --evidence= --actor=
- /verify: npm run credit -- verify <customer> --email= --evidence= --actor=
- /hold: npm run credit -- hold <customer> --reason= --actor=
- /release: npm run credit -- release <customer> --evidence= --actor=
- /reconcile: npm run credit -- reconcile <invoice> --outstanding= --as-of=YYYY-MM-DD --evidence= --reviewed --actor=
- /promise: npm run credit -- promise <invoice> --amount= --due=YYYY-MM-DD --evidence= --actor=
- /close-promise: npm run credit -- close-promise <promise-id> --status=kept|broken|cancelled --evidence= --actor=
- /dispute: npm run credit -- dispute <invoice> --reason= --owner= --review-on=YYYY-MM-DD --evidence= --actor=
- /resolve-dispute: npm run credit -- resolve-dispute <dispute-id> --resolution= --evidence= --actor=
- /log: npm run credit -- log <customer> --kind=note|inbound|outbound --on=YYYY-MM-DD --note= --actor=
- /import: npm run credit -- import chaser --file= --entity= --as-of=YYYY-MM-DD --actor= [--currency=NZD] [--map=examples/import-map.json] [--dry-run]
- /export: npm run credit -- export --file=exports/backup.json
- /draft-reminder: npm run credit -- draft-reminder <invoice> --actor=
- /draft-review: npm run credit -- draft-review --actor=
- /customise: write and apply a new numbered migration, update commands and tests.
- /new-view: add a read-only report in views.json and render it.

Open .claude/commands/<job>.md for the recipe. Unknown names or ambiguous records are not permission to guess. Use --json for machine reads and report currencies separately.

## Working rules

Read customer or invoice history before drafting or changing it. Every mutation requires --actor. Evidence is an operator-supplied reference, never claim to have verified a document you did not read. Add creates a checked manual invoice snapshot. Import creates unreviewed invoice snapshots. Review source dates, currency, balance, disputes and holds before reconcile --reviewed. Verify customer contact details with evidence.

Never send, process money, add fees, threaten legal action or access bank feeds. Drafts go to drafts/ and a person reviews them outside this tool. Do not bypass a blocked draft by creating your own reminder. Do not infer payment from a promise or mark a promise kept without evidence. Do not treat absent export records as settled.

The database is private internal data. No public read policies or unauthorised exports. No destructive migrations without explicit approval. Use new migrations rather than rewriting history. Current balance and contact freshness are local policies in policy, not legal limits. Read docs/compliance.md when changing checks.

## Locations

scripts/credit.mjs is the only domain CLI. supabase/migrations holds numbered migrations. supabase/seed.sql contains synthetic data. scripts/lib/db.mjs selects local PGlite or DATABASE_URL. views.json and documents.json define read-only output. brand.json defines the business identity. npm test verifies operations on temporary data.

Omni by Enterprise DNA can customise and operate this system: https://enterprisedna.co/omni/book/?offer=replace-software&utm_campaign=chaser

