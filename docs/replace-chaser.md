# Move invoice records from Chaser

Sources checked 14 October 2026: [Generating reports](https://help.chaserhq.com/generating-xlsx-reports-in-chaser), [Invoices](https://help.chaserhq.com/invoice-page), [CSV data model](https://help.chaserhq.com/chase-import-csv-uploader).

Chaser offers Excel report downloads. In Reports, choose Generate report and an invoice-level report. Select the dates, statuses and extra fields you need. The workbook's Source Database sheet contains invoice rows. Save that sheet as UTF-8 CSV; the importer reads CSV, not XLSX. Chaser also exposes exports in invoice history, which this balance importer does not consume.

## Map once, import in one command

The example CSV is synthetic. Headers vary with selected report fields, so map your actual headings with examples/import-map.json. Use one invoice row per customer account per file, no subtotal or summary rows.

| Field | Meaning |
|---|---|
| account | Stable customer ID, preferred. Falls back to customer name if absent. |
| customer | Customer display name. |
| number | Invoice number, unique within customer and entity. |
| currency | Currency of both imported amounts, uppercase code. |
| issued | Invoice date, YYYY-MM-DD. |
| due | Due date, YYYY-MM-DD. |
| total | Invoice face value in decimal units, not cents. |
| outstanding | Current outstanding value in the same currency. |

Use original-currency amounts together, or base-currency amounts with the base currency. Never attach the original currency code to a base-currency amount. Normalise dates and decimal separators before import. This build supports two-decimal currencies only. Keep every source file privately. Include paid invoices if their settled balances should carry over.

Run npm run credit -- import chaser --file=imports/invoices.csv --entity="Your company" --as-of=2026-10-14 --map=examples/import-map.json --actor="Your name" --dry-run. The date is the source snapshot date, not automatically today's date. Review the preview, then run the same command without --dry-run. Supply --currency only for a file with one verified amount currency.

## Reconcile before switching

Compare invoice counts and currency totals with Chaser and your accounting ledger. Missing files and omitted invoices do not imply payment. Imported rows require review. Recreate open disputes, contact restrictions and promises from the source evidence, verify customer emails, and run reconcile with --reviewed on each invoice after checking its balance. The importer deliberately does not translate arbitrary dispute labels into permissions to contact anyone.

A changed snapshot preserves raw source fields in audit. Repeating the same dated balance skips it. A later snapshot updates the balance and restores the review requirement. Changing a face value, currency or date requires a reviewed correction, not a silent overwrite. Conflicting snapshots on the same date are rejected. A bad row rolls the whole file back.

## Scope of the move

Customers, invoice dates, face values, outstanding balances, currency and raw source fields transfer. Email conversations, invoice PDFs, payment allocations, unallocated credits, promises, disputes, chasing schedules, forecasts and automations do not transfer as working records through this importer. Preserve these exports separately and map needed history as part of a customised migration. Until reconciled, all imported invoices remain blocked from reminder drafting.

The accounting ledger remains the source for payments and credits. The free version never pays, debits, reconciles bank transactions or sends correspondence. Enterprise DNA can build agreed accounting and mail connections into your version. Complete one dry run and reconcile totals in a day; a full history migration depends on the files and mappings you bring.

