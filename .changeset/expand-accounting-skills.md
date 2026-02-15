---
"@marcfargas/odoo-skills": minor
"@marcfargas/create-odoo-skills": minor
---

Expand accounting skill, add contracts skill, add MIS Builder gotchas

**accounting.md** — major expansion with real-world patterns:
- Account move types and posted state filtering (`parent_state='posted'`)
- Sign convention for PnL analysis (`-(debit - credit)`)
- Year-end closing entry detection (129x accounts)
- Cash account gotchas: transit exclusion (555/561), credit lines vs reclassifications (5201x/5200x)
- Cash balance from GL (not movements), days-to-pay calculation
- Bank loans vs tax deferrals (distinguish by `short_term_loan_account_id`)
- PnL & EFE structure for Spanish GAAP / PGC (account ranges, non-cash items)
- Validation patterns: total invariance, €0.01 tolerance, strict mode
- Service accessor reference (`client.accounting.*`)

**New: contracts.md** — OCA contracts module (`contract.contract` / `contract.line`):
- Billing schedules and recurrence fields
- Price is per billing cycle, NOT monthly (critical gotcha)
- Event-based revenue projection pattern
- `recurring_next_date` future date cap

**mis-builder.md** — new Gotchas section:
- Archived budgets need `active_test: false`
- `mis.report.instance` has NO `active` field
- `mis.report.instance.period` has NO `company_id` field
- Budget account codes differ from actual accounting
