---
"@marcfargas/odoo-client": minor
---

Add accounting service with client accessor (`client.accounting.*`)

New service providing battle-tested helpers for Odoo accounting operations:

- `discoverCashAccounts()` / `getCashAccountIds()` — find cash/bank accounts from journal configuration (not hardcoded account codes)
- `resolvePartnerFromMove(moveId, cashAccountIds)` — resolve partners from bank statement counterpart lines, with batch payment detection
- `traceReconciliation(fullReconcileId)` — follow `full_reconcile_id` chains through transient accounts
- `isClosingEntry(moveId)` / `isClosingEntryFromLines(lines)` — detect year-end closing entries (129x accounts)
- `calculateDaysToPay(invoiceId)` — compute days between invoice and payment via reconciliation
- `getCashBalance(cashAccountIds, asOfDate)` — cash balance from general ledger (includes opening balances)
- `getPostedMoveLines(domain, options)` — query journal items with `parent_state='posted'` auto-applied and `limit=0` default

All functions available as standalone imports or via the `client.accounting.*` service accessor.
