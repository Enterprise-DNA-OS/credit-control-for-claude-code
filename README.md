# Credit Control for Claude Code

Overdue invoices, payment promises and disputes in a database you own. A credit-control desk for business invoices, with reviewed drafts and an evidence trail.

## Three ways to make it yours

| Do it yourself | We customise it | We run it for you |
|---|---|---|
| Free under the MIT licence. Install the database and run the commands. | Enterprise DNA maps your Chaser exports, adds your fields and rules, and builds the screens you want. | Omni by Enterprise DNA installs, connects and operates your version. |
| Your machine, your records. | Your preferred stack and workflow. | One setup fee, then a monthly retainer. |

[Get your version built](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_campaign=chaser).

## Start with synthetic records

Requires Node 20 or newer. No account, API key or database server is needed for the local demo.

```bash
npm install
npm run demo
npm run credit -- ageing
npm run credit -- invoice NZ-1001 --json
npm run view
npm run docs
npm test
```

The default is embedded PGlite in .data/db. DATABASE_URL selects a PostgreSQL database that you own. Keep real records in a separate database from the demo. DATA_DIR changes the local path. Use a database owner role for these internal commands; public access is revoked and row-level security has no public policies. This is one organisation's internal desk, with optional reporting entities, not a customer portal or a multi-tenant service. Database owners can read all records.

Claude Code, Codex, OpenCode or Cursor can run the same instructions. Read CLAUDE.md and AGENTS.md. Every result comes from the database.

## The weekly work

| Job | Command |
|---|---|
| customers | /customers |
| invoices | /invoices |
| ageing | /ageing |
| chase list | /chase-list |
| promises due | /promises-due |
| disputes | /disputes |
| attention | /attention |
| exposure | /exposure |
| activity | /activity |
| compliance | /compliance |
| source check | /source-check |
| promise plan | /promise-plan |
| history | /history |
| policy | /policy |
| customer | /customer |
| invoice | /invoice |
| weekly review | /weekly-review |
| add customer | /add-customer |
| add | /add |
| verify | /verify |
| hold | /hold |
| release | /release |
| reconcile | /reconcile |
| promise | /promise |
| close promise | /close-promise |
| dispute | /dispute |
| resolve dispute | /resolve-dispute |
| log | /log |
| import | /import |
| export | /export |
| draft reminder | /draft-reminder |
| draft review | /draft-review |
| Add a field or change a policy | /customise |
| Add a read-only report | /new-view |

Run npm run credit -- help for exact syntax. Options take --name=value. Add --json to any command for structured results. Names match without regard to case; ambiguous names print candidates and exit 1. Use the full id to choose one.

## Ten questions your own version answers

These checks work today. Chaser also offers ageing, promises and dispute reporting; this list makes no claim that its reports cannot answer similar questions. The difference is owning the rules and being able to change them.

- Which overdue invoices are ready for a reviewed reminder today? chase-list
- Which overdue invoices have an open dispute, a contact hold or an unreviewed import? attention
- Which promised payments are due this week but have not been marked kept? promises-due
- Which balances are too old to use in a reminder? source-check
- Which customers need their contact details verified before drafting? compliance
- How much is outstanding in each entity and currency without mixing exchange rates? ageing
- Which account owners carry the oldest overdue balances and disputed amounts? exposure
- Which invoices have gone quiet since the last recorded conversation? attention
- Which future commitments remain open on eligible accounts? promise-plan
- What changed in a balance, and which source and operator support it? invoice

## Your first hour: ten things to ask for

1. Put our business name and logo on the statements.
2. Show the current and overdue balance for each currency.
3. Show the accounts with unverified contact details.
4. Separate open disputes from the reminder queue.
5. List promises due this week and the evidence behind them.
6. Preview our Chaser invoice export without saving changes.
7. Draft the Monday review from ageing, attention and promises.
8. Add a purchase-order reference through a migration.
9. Change the freshness policy to match our daily ledger export.
10. Add an account-owner report with the oldest overdue invoice.

## Bring your Chaser invoice records

Export an invoice-level report in Chaser, save its Source Database sheet as CSV, and map the headings. The included file is synthetic and illustrates the mapping contract, not a captured tenant export.

```bash
npm run credit -- import chaser --file=examples/chaser-invoices.csv --entity="Demo import" --as-of=2026-10-14 --actor="Migration operator" --dry-run
npm run credit -- import chaser --file=examples/chaser-invoices.csv --entity="Demo import" --as-of=2026-10-14 --actor="Migration operator"
```

Use --map=examples/import-map.json for different headings. Supply --currency=NZD only when all amounts in the file are in NZD. Chaser reports can contain base-currency amounts: map amounts and their actual currency together. A mismatch corrupts totals. Stable customer IDs are preferred; without one the customer name becomes the key within the entity.

An import is atomic. A repeat of the same snapshot adds nothing. A later snapshot updates the outstanding balance and requires review again. Changed currency, total, customer identity or invoice dates are rejected for mapping review. Older snapshots and conflicting values on the same date are rejected. An absent invoice is not treated as paid. Raw fields stay on the invoice and in the audit record for each changed import. Unmapped disputes and promises are not silently treated as transferred.

Before reminders, record every open dispute and contact hold, verify the customer email and reconcile each imported balance with --reviewed and evidence. [Replacement guide](docs/replace-chaser.md).

## What the balances mean

All amounts are integer cents with exact two-decimal input. This version supports two-decimal currencies. It keeps totals separate by entity and currency and does not convert exchange rates. Ageing uses UTC calendar dates. A due date of today is current; overdue starts tomorrow. The total is the invoice face value, outstanding is a checked accounting snapshot. Neither promises nor their completion reduce the balance. Reconcile payments and credits in the accounting system, then record a new snapshot here. Same-day corrections need a reviewed migration because daily history cannot be overwritten.

Promise-plan shows future open commitments on accounts that pass the draft checks. It caps each commitment at the current outstanding balance. It is not a cash forecast or proof of receipt. A promise can be marked kept only with operator-supplied evidence; the software cannot verify a bank transaction.

## Documents and read-only views

brand.json sets business name, colours, logo and footer. npm run docs writes draft invoice statements, internal dispute briefs and promise records under docs-out/. Statements do not include unallocated credits and must be reconciled before use. npm run view writes the weekly desk and exceptions view under views/. HTML escapes record text. OUTPUT_DIR moves generated files and drafts to a separate folder. /new-view adds a report from the existing records.

## Record checks and scope

/compliance checks open disputes, balance freshness, contact verification, import review and contact holds. [Compliance notes](docs/compliance.md) distinguish cited principles from our configurable policies. Seven-day balances, ninety-day contact checks and fourteen-day quiet accounts are local defaults, not legal deadlines. The system does not certify compliance.

No payment processing, debt enforcement, consumer lending, credit reporting, bank feeds or automated sending. Chaser's live accounting sync and follow-up automation are separate capabilities. Enterprise DNA scopes those connections for your installed version. The free desk is useful from reviewed exports alone. [Why no front end](docs/why-no-front-end.md).

Audit, activity and balance history reject updates and deletes through ordinary database operations. This is a record trail, not tamper-proof storage: database administrators retain control. Operator names and evidence references are supplied by users, not authenticated signatures. Protect the local disk and backups, restrict database access and store source documents separately.

Export all eight record sets with npm run credit -- export --file=exports/backup.json. It refuses to overwrite an existing export. The JSON is a data export, not a tested disaster-recovery restore. Back up the underlying database too.

## Verification

npm test creates an isolated database, applies repeatable migrations and seed, exercises every CLI command, and checks money, disputes, holds, atomic imports, repeat imports, ambiguity, draft safeguards, exports and escaped HTML. CI runs Node 20 and 22 on Linux and Windows plus PostgreSQL 17. TEST_DATABASE_URL must point only at a disposable test database.

MIT licence. Not affiliated with Chaser, Anthropic or an accounting vendor. [Book 30 minutes with Sam](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_campaign=chaser).

