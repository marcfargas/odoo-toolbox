# Accounting Service — `client.accounting.*`

Domain-specific helpers for Odoo accounting: cash account discovery, general ledger queries, partner resolution, reconciliation tracing, and invoice payment analysis.

**Requires:** `account` module (Invoicing/Accounting). Optional: `account_loan` for loan-specific patterns.

**Safety:** All `client.accounting.*` methods are **READ** — they query accounting data without modifying it.

## Quick Reference

```typescript
import { createClient } from '@marcfargas/odoo-client';
const client = await createClient();

// Cash account IDs via journal configuration
const cashIds = await client.accounting.getCashAccountIds();

// Cash balance from GL
const balance = await client.accounting.getCashBalance(cashIds, '2025-06-30');
console.log(`Cash: €${balance.toFixed(2)}`);

// Query posted move lines (parent_state='posted' automatically applied)
const pnlLines = await client.accounting.getPostedMoveLines(
  [['account_id.code', '=like', '7%'], ['date', '>=', '2025-01-01']],
  { fields: ['account_id', 'debit', 'credit', 'balance'] }
);
```

## Critical API Gotchas

### `searchRead` default limit is 100

In accounting queries, silently returning only 100 of 10,000 records destroys accuracy:

```typescript
// ❌ WRONG — silently returns only 100 rows
const lines = await client.searchRead('account.move.line',
  [['date', '>=', '2025-01-01']],
  { fields: ['date', 'debit', 'credit'] }
);

// ✅ CORRECT — explicit limit
const lines = await client.searchRead('account.move.line',
  [['date', '>=', '2025-01-01']],
  { fields: ['date', 'debit', 'credit'], limit: 0 }
);

// ✅ BETTER — use the service method (auto-applies limit: 0 and parent_state='posted')
const lines = await client.accounting.getPostedMoveLines(
  [['date', '>=', '2025-01-01']],
  { fields: ['date', 'debit', 'credit'] }
);
```

### Always filter posted state

Draft and cancelled entries must be excluded from all financial analysis:

```typescript
// On account.move
const moves = await client.searchRead('account.move',
  [['state', '=', 'posted'], ['date', '>=', '2025-01-01']],
  { fields: ['name', 'date', 'amount_total'], limit: 0 }
);

// On account.move.line — use parent_state
const lines = await client.searchRead('account.move.line',
  [['parent_state', '=', 'posted'], ['date', '>=', '2025-01-01']],
  { fields: ['account_id', 'debit', 'credit'], limit: 0 }
);

// With service method — parent_state='posted' is auto-applied
const lines = await client.accounting.getPostedMoveLines(
  [['date', '>=', '2025-01-01']],
  { fields: ['account_id', 'debit', 'credit'] }
);
```

## `discoverCashAccounts()`

Discover cash and bank accounts via journal configuration — more robust than matching by account code prefix:

```typescript testable id="acc-discover-cash" needs="client" expect="result.count >= 0"
const accounts = await client.accounting.discoverCashAccounts();

for (const acc of accounts) {
  console.log(`${acc.accountName} (${acc.journalName} — ${acc.journalType})`);
}

return { count: accounts.length };
```

Returns `CashAccount[]`:

| Field | Type | Description |
|-------|------|-------------|
| `accountId` | `number` | `account.account` ID |
| `accountName` | `string` | Account display name |
| `journalId` | `number` | `account.journal` ID |
| `journalName` | `string` | Journal name |
| `journalType` | `'bank' \| 'cash'` | Journal type |

## `getCashAccountIds()`

Get just the account IDs — useful for building domain filters:

```typescript testable id="acc-cash-ids" needs="client" expect="result.ids.length >= 0"
const cashIds = await client.accounting.getCashAccountIds();
// Use in domains: ['account_id', 'in', cashIds]
return { ids: cashIds };
```

## `getCashBalance(cashAccountIds, asOfDate, options?)`

Calculate the cumulative cash balance from the general ledger through a given date. This is the correct approach — summing movements within a period misses opening balances:

```typescript testable id="acc-cash-balance" needs="client" expect="typeof result.balance === 'number'"
const cashIds = await client.accounting.getCashAccountIds();
const today = new Date().toISOString().split('T')[0];
const balance = await client.accounting.getCashBalance(cashIds, today);

console.log(`Total cash balance: €${balance.toFixed(2)}`);
return { balance };
```

Pass `options.companyIds` for multi-company queries:

```typescript
const balance = await client.accounting.getCashBalance(cashIds, '2025-06-30', {
  companyIds: [1, 5],  // allowed_company_ids context
});
```

## `getPostedMoveLines(domain?, options?)`

Query `account.move.line` with `parent_state='posted'` automatically applied and `limit` defaulting to 0 (all records). Prevents the two most common accounting query mistakes:

```typescript testable id="acc-posted-lines" needs="client" expect="result.count >= 0"
// PnL income lines for a period
const incomeLines = await client.accounting.getPostedMoveLines(
  [
    ['account_id.code', '=like', '7%'],  // Revenue accounts
    ['date', '>=', '2025-01-01'],
    ['date', '<=', '2025-12-31'],
  ],
  {
    fields: ['account_id', 'debit', 'credit', 'balance', 'partner_id', 'date'],
    order: 'date asc',
  }
);

const totalRevenue = incomeLines.reduce((sum, l) => sum - l.balance, 0); // Invert sign for PnL
return { count: incomeLines.length, totalRevenue };
```

> **Sign convention:** `balance = debit - credit`. Income accounts (7xx) have credit balances, so `balance` is negative for revenue. Invert with `-(debit - credit)` for PnL analysis where income should be positive.

## `isClosingEntry(moveId)` / `isClosingEntryFromLines(lines)`

Detect year-end closing entries (which would distort operational PnL if included):

```typescript testable id="acc-closing-entry" needs="client" expect="typeof result.isClosing === 'boolean'"
const moves = await client.searchRead('account.move',
  [['state', '=', 'posted'], ['move_type', '=', 'entry']],
  { fields: ['id', 'name'], limit: 5 }
);

if (moves.length > 0) {
  const isClosing = await client.accounting.isClosingEntry(moves[0].id);
  return { isClosing };
}

return { isClosing: false };
```

The faster `isClosingEntryFromLines` works on already-loaded lines (no RPC call):

```typescript
// When you already have the lines from a previous query
const lines = await client.accounting.getPostedMoveLines(
  [['move_id', '=', moveId]],
  { fields: ['account_id'] }
);

if (client.accounting.isClosingEntryFromLines(lines)) {
  continue; // Skip this move in PnL analysis
}
```

## `resolvePartnerFromMove(moveId, cashAccountIds)`

Resolve the partner for a bank/cash journal entry. The partner is often on the counterpart lines (410, 411, 430), not on the bank line itself:

```typescript testable id="acc-resolve-partner" needs="client" expect="result.success === true"
const cashIds = await client.accounting.getCashAccountIds();

// Find a recent bank move
const moves = await client.searchRead('account.move',
  [['state', '=', 'posted'], ['move_type', '=', 'entry']],
  { fields: ['id'], limit: 1 }
);

if (moves.length > 0) {
  const partner = await client.accounting.resolvePartnerFromMove(moves[0].id, cashIds);
  console.log(`Partner ID: ${partner.partnerId}`);
  console.log(`Is batch payment: ${partner.isBatchPayment}`);
  return { success: true, partnerId: partner.partnerId };
}

return { success: true, partnerId: null };
```

`ResolvedPartner`:

| Field | Type | Description |
|-------|------|-------------|
| `partnerId` | `number \| null` | Primary partner (null if unresolved) |
| `partnerName` | `string \| null` | Display name |
| `isBatchPayment` | `boolean` | True when multiple partners share one bank line |
| `allPartnerIds` | `number[]` | All partners in a batch payment |

## `traceReconciliation(fullReconcileId)`

Follow `full_reconcile_id` to find all journal lines in a reconciliation group — useful for tracing payments through transient accounts:

```typescript
const trace = await client.accounting.traceReconciliation(42);
console.log(`${trace.lines.length} lines across ${trace.moveIds.length} journal entries`);
```

## `calculateDaysToPay(invoiceId)`

Calculate the days between invoice date and payment date using reconciliation:

```typescript testable id="acc-days-to-pay" needs="client" expect="result.success === true"
const invoices = await client.searchRead('account.move',
  [['state', '=', 'posted'], ['move_type', '=', 'out_invoice']],
  { fields: ['id', 'name'], limit: 1 }
);

if (invoices.length > 0) {
  const result = await client.accounting.calculateDaysToPay(invoices[0].id);
  if (result) {
    console.log(`Invoice paid in ${result.days} days`);
  } else {
    console.log('Invoice not yet paid');
  }
}

return { success: true };
```

Returns `DaysToPayResult | null`:

| Field | Type | Description |
|-------|------|-------------|
| `days` | `number` | Days from invoice date to payment date |
| `invoiceDate` | `string` | Invoice date |
| `paymentDate` | `string` | Payment date (latest reconciliation date) |
| `fullReconcileId` | `number` | The reconciliation group ID |

## Account Move Types

`account.move` uses `move_type` to distinguish document types:

| `move_type` | Description |
|-------------|-------------|
| `out_invoice` | Customer invoice |
| `out_refund` | Customer credit note |
| `in_invoice` | Supplier invoice |
| `in_refund` | Supplier credit note |
| `entry` | General journal entry (payroll, depreciation, bank statements, closing) |

Always filter by `state = 'posted'` to exclude drafts.

---

See also:
- [Search](../client/search.md) — domain basics, limit gotcha
- [Advanced Domains](../advanced/domains.md) — dot notation for `account_id.code`
- [Multi-Company](../advanced/multi-company.md) — `allowed_company_ids` context

For agent-optimized CLI examples, see the [odoo skill](../skills/odoo/).
