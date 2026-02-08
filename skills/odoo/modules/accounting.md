# Odoo Accounting — Patterns & Gotchas

Hard-won knowledge from building accounting dashboards and cashflow tools against real Odoo instances. These patterns apply to `account.move`, `account.move.line`, `account.journal`, `account.account`, and related models.

**Required modules**: `account` (Invoicing/Accounting)

## Critical API Gotchas

### searchRead Default Limit is 100

```typescript
// ❌ WRONG — silently returns only 100 records
const lines = await client.searchRead('account.move.line',
  [['date', '>=', '2025-01-01']],
  { fields: ['date', 'debit', 'credit'] }
);

// ✅ CORRECT — always pass limit explicitly
const lines = await client.searchRead('account.move.line',
  [['date', '>=', '2025-01-01']],
  { fields: ['date', 'debit', 'credit'], limit: 0 }
);
```

### Archived Records Are Hidden by Default

Odoo filters out `active=False` records silently. MIS budgets, some partners, and historical accounts may be archived.

```typescript
// Include archived records
const results = await client.searchRead('account.account',
  [['code', '=like', '520%']],
  { fields: ['code', 'name', 'active'], context: { active_test: false } }
);
```

### Multi-Company Records Need Context

Records in other companies return empty without the right context.

```typescript
// Pass all company IDs the user has access to
const moves = await client.searchRead('account.move',
  [['date', '>=', '2025-01-01']],
  {
    fields: ['name', 'date', 'amount_total'],
    context: { allowed_company_ids: [1, 5, 9] },
    limit: 0,
  }
);
```

### account.loan.line: Fields Not in Default Set

`date` and `payment_amount` are not returned by default — you must request them explicitly.

```typescript
// ❌ WRONG — date and payment_amount will be undefined
const lines = await client.searchRead('account.loan.line',
  [['loan_id', '=', loanId]],
  { fields: ['loan_id', 'move_ids'] }
);

// ✅ CORRECT
const lines = await client.searchRead('account.loan.line',
  [['loan_id', '=', loanId]],
  { fields: ['loan_id', 'move_ids', 'date', 'payment_amount'], limit: 0 }
);
```

## Cash Account Discovery

### Use Journals, Not Account Code Prefixes

Matching by code prefix (57%, 520%) catches loan accounts and misses unusual bank accounts. Use Odoo's own definition instead:

```typescript
// ✅ Discover cash/bank accounts via journals
const journals = await client.searchRead('account.journal',
  [['type', 'in', ['bank', 'cash']]],
  { fields: ['name', 'default_account_id', 'type'] }
);

const cashAccountIds = journals
  .map(j => Array.isArray(j.default_account_id) ? j.default_account_id[0] : j.default_account_id)
  .filter(Boolean);
```

## Bank Statement Patterns

### Partner Is on the Counterpart Line, Not the Bank Line

Bank statement entries (`move_type='entry'`) typically have `partner_id=false` on both the `account.move` header AND the bank/cash line. The partner is on the counterpart lines (payable/receivable accounts like 410, 411, 430).

```typescript
// Read bank move lines
const lines = await client.searchRead('account.move.line',
  [['move_id', '=', bankMoveId]],
  { fields: ['account_id', 'partner_id', 'debit', 'credit', 'name'], limit: 0 }
);

// Bank/cash line — typically no partner
const cashLine = lines.find(l => cashAccountIds.includes(
  Array.isArray(l.account_id) ? l.account_id[0] : l.account_id
));

// Counterpart lines — these carry the partner
const counterparts = lines.filter(l => l !== cashLine);
const mainCounterpart = counterparts.sort((a, b) =>
  Math.abs(b.debit - b.credit) - Math.abs(a.debit - a.credit)
)[0];

// Resolve partner: cash line first, fall back to counterpart
const partnerId = cashLine?.partner_id || mainCounterpart?.partner_id;
```

### Batch Payments (Multiple Suppliers in One Bank Line)

One bank credit line, multiple 410/411 debit lines each with its own `partner_id`. Split proportionally:

```typescript
// Find 410/411 lines with partners
const payableLines = counterparts.filter(l => {
  const code = Array.isArray(l.account_id) ? l.account_id[1] : '';
  return typeof code === 'string' && (code.startsWith('410') || code.startsWith('411'));
});

// Each payable line has its own partner and amount
for (const line of payableLines) {
  // line.partner_id = individual supplier
  // line.debit = their portion of the batch
}
```

## Reconciliation Tracing

### Following full_reconcile_id

When a transient account (like 41101) is used as a pass-through, trace the reconciliation to find the real origin:

```typescript
// 1. Find the 41101 line on the bank move
const bankLine = lines.find(l => /* account 41101 */);
const reconcileId = bankLine?.full_reconcile_id;

if (reconcileId) {
  // 2. Find ALL lines with this reconciliation
  const reconLines = await client.searchRead('account.move.line',
    [['full_reconcile_id', '=', Array.isArray(reconcileId) ? reconcileId[0] : reconcileId]],
    { fields: ['move_id', 'account_id', 'debit', 'credit', 'partner_id'], limit: 0 }
  );

  // 3. The OTHER move (not our bank move) is the originating entry
  const originLines = reconLines.filter(l => {
    const moveId = Array.isArray(l.move_id) ? l.move_id[0] : l.move_id;
    return moveId !== bankMoveId;
  });

  // 4. The dominant debit account on the origin = real classification
}
```

## Loan Accounting

### Loan Moves Don't Touch Cash

`account.loan` creates Miscellaneous journal entries that reclassify balance sheet accounts (520↔170, interest accrual). These **never** touch bank/cash accounts.

- Use `account.loan` for: outstanding balances, payment schedules, projections
- Do NOT use for: cashflow classification (the actual cash movement is a separate bank entry)

### Loan Repayments Go Through Payables

Loan payments typically flow: 520/170 → 410/411 → bank. Look for patterns in the move reference:

```typescript
// Match loan repayment patterns in bank statement references
const loanPattern = /(amort|ptmo|prestamo|pres\.\d|liquidacion.*(periodica|prestamo)|cargo por amort)/i;
const isLoanRepayment = loanPattern.test(line.name || '') || loanPattern.test(line.ref || '');
```

## Common Account Patterns

| Account Range | Typical Use | Notes |
|---------------|-------------|-------|
| 410/411 | Trade payables | Pass-through for batch payments |
| 430 | Trade receivables | Customer payments |
| 475 | Tax payable | Employee WHT (475100) is payroll, not company tax |
| 520 | Short-term loans | Balance sheet, not cash |
| 170 | Long-term debt | Balance sheet, not cash |
| 555 | Transient/pending | Not the company's money |
| 57x | Bank/cash | Discover via journals, not code prefix |

## Related Documents

- [connection.md](../base/connection.md) - Authentication
- [domains.md](../base/domains.md) - Query filters (especially date ranges, dot notation)
- [search.md](../base/search.md) - Search patterns
