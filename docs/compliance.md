# Credit-control record checks

This is an internal business-invoice desk. It is not a debt enforcement service, consumer-credit product or certification of legal compliance. Sources checked 14 October 2026. Obtain advice on the rules that apply to the actual customer, jurisdiction and agreement.

| Rule | Implemented record check | Basis and limits |
|---|---|---|
| CC01 | An open dispute blocks reminder drafting for the whole invoice. | Conservative local implementation informed by the NZ Commerce Commission guidance below. A person resolves the dispute with evidence. |
| CC02 | A balance older than seven days blocks a draft. | Local accuracy policy. Seven days is not a statutory deadline. |
| CC03 | Missing or stale verified contact details block a draft. | Local control supporting accuracy and limited disclosure. Ninety days is a local review interval. |
| CC04 | Imported invoices cannot produce reminders until their balances and dispute status are reviewed. | Local migration control, not a vendor rule or law. |
| CC05 | A customer hold blocks reminder drafts. | Local record of contact restrictions or representative arrangements. |

[Commerce Commission: disputed debt and misleading tactics](https://www.comcom.govt.nz/news-and-media/news-and-events/2018/debt-collection-industry-on-notice-about-misleading-tactics/) describes pausing collection while a genuine dispute is resolved and avoiding misleading claims about court action. This build blocks drafts on any open dispute and never writes court threats or adds fees. It does not determine legal liability or enforce a debt.

[NZ Privacy Principle 8](https://www.privacy.org.nz/privacy-principles/8/) requires reasonable accuracy checks before personal information is used or disclosed. The balance and contact checks are practical local controls, not proof that every reasonable check has occurred. [Privacy Commissioner guidance on relatives and employers](https://www.privacy.org.nz/resources-and-learning/knowledge-base/view/361/) explains restrictions on disclosing a debtor's information to others. Drafts use the verified customer address only; humans must still check recipients and authority before any communication.

For Australian accounts, review the [ACCC and ASIC debt collection guideline](https://www.accc.gov.au/system/files/Debt%20collection%20guideline%20for%20collectors%20and%20creditors%20-%20April%202021.pdf). The free desk does not implement contact frequency, contact-time, limitation-period or hardship determinations. It never sends and does not replace a jurisdiction-specific collections process.

Policy defaults live in policy and are changed through a reviewed migration using /customise. UTC calendar dates determine ageing. A source balance is an operator-supplied snapshot, not a live bank balance. Evidence strings are references and do not authenticate documents. The audit trail blocks ordinary updates and deletes, but database administrators can change the system. Access controls, retention, backups and operator identity require deployment decisions.

