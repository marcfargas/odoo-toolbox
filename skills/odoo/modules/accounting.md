# Odoo Accounting — Patterns & Gotchas

Hard-won knowledge from building accounting dashboards and cashflow tools against real Odoo instances.

## CLI

All accounting commands are **READ** — no confirmation required.
Requires: `account` Odoo module (Invoicing/Accounting).

### Discover cash and bank accounts

```bash
odoo accounting cash-accounts
# journal_name   journal_type   account_id   account_name
# Bank           bank           57           Bank
# Cash           cash           571          Petty Cash

odoo accounting cash-accounts --format json
```

### Cash/bank balance as-of a date

```bash
# Balance today
odoo accounting cash-balance

# Balance at end of quarter
odoo accounting cash-balance --as-of 2024-03-31

# Specific journals only
odoo accounting cash-balance --journal-id 5,6 --as-of 2024-12-31

# Get total balance in a script
BALANCE=$(odoo accounting cash-balance --format json | jq '[.[].balance] | add')
echo "Total cash: $BALANCE"
```

### List posted journal entries

```bash
# All posted moves in a date range
odoo accounting posted-moves --from 2024-01-01 --to 2024-03-31

# Filter by journal
odoo accounting posted-moves --from 2024-01-01 --journal-id 5

# Export as CSV
odoo accounting posted-moves --from 2024-01-01 --to 2024-12-31 \
  --format csv > journal-entries.csv
```

### Trace reconciliation for a journal entry

```bash
# Show the reconciliation chain for a move
odoo accounting trace-recon 42
odoo accounting trace-recon 42 --format json
```

### Days-to-pay analysis for an invoice

```bash
# How many days did it take to pay invoice #1042?
odoo accounting days-to-pay 1042
# invoice_id   1042
# days         32
# invoice_date 2024-01-15
# payment_date 2024-02-16

odoo accounting days-to-pay 1042 --format json

# Returns null if invoice is not yet paid
```

---

## Library API (Patterns & Gotchas) These patterns apply to `account.move`, `account.move.line`, `account.journal`, `account.account`, and related models.

**Required modules**: `account` (Invoicing/Accounting)

**Optional modules**: `account_loan` (loan management), `contract` (recurring contracts — see `contracts.md`)

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

## Account Move Fundamentals

### Move Types

`account.move` uses `move_type` to distinguish document types:

| `move_type` | Description |
|-------------|-------------|
| `out_invoice` | Customer invoice |
| `out_refund` | Customer credit note |
| `in_invoice` | Supplier invoice |
| `in_refund` | Supplier credit note |
| `entry` | General journal entry (payroll, depreciation, closing, adjustments, bank statements) |

### Always Filter Posted State

Draft and cancelled entries must be excluded from all financial analysis. **This is the single most common mistake.**

```typescript
// ✅ On account.move — filter by state
const moves = await client.searchRead('account.move',
  [['state', '=', 'posted'], ['date', '>=', '2025-01-01']],
  { fields: ['name', 'date', 'amount_total'], limit: 0 }
);

// ✅ On account.move.line — filter by parent_state
const lines = await client.searchRead('account.move.line',
  [['parent_state', '=', 'posted'], ['date', '>=', '2025-01-01']],
  { fields: ['account_id', 'debit', 'credit', 'balance'], limit: 0 }
);
```

### Sign Convention for PnL Analysis

`balance = debit - credit` uses natural debit sign. For PnL analysis this is counterintuitive because income accounts (7xx, credit balances) appear negative.

```typescript
// ✅ Invert sign for PnL: income → positive, expenses → negative
// Then SUM naturally gives EBITDA / operating result
const pnlLines = lines.map(l => ({
  ...l,
  pnl_amount: -(l.debit - l.credit),  // or equivalently: l.credit - l.debit
}));

// SUM(pnl_amount) where account 7xx → positive (income)
// SUM(pnl_amount) where account 6xx → negative (expenses)
// Total SUM → operating result
```

### amount_untaxed vs balance Aggregation

Two valid approaches — pick one, never mix:

| Approach | Source | Use for |
|----------|--------|---------|
| `account.move.amount_untaxed` | Invoice header | Invoice-level analysis, quick totals |
| `SUM(account.move.line.balance)` on 6xx/7xx | Journal items | Per-line, per-partner, per-account granularity |

### Detecting Year-End Closing Entries

`move_type='entry'` includes operational entries (payroll, depreciation) AND year-end closing entries. Closing entries distort operational PnL.

```typescript
// Detect closing entries: any sibling line on account 129x (resultado del ejercicio)
async function isClosingEntry(client: OdooClient, moveId: number): Promise<boolean> {
  const lines = await client.searchRead('account.move.line',
    [['move_id', '=', moveId]],
    { fields: ['account_id'], limit: 0 }
  );
  return lines.some(l => {
    const code = Array.isArray(l.account_id) ? l.account_id[1] : String(l.account_id);
    return /^129/.test(code);
  });
}

// When querying PnL, exclude closing entries
// Option 1: Pre-filter move IDs
// Option 2: Exclude account 129x lines and check remaining moves
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

### Exclude Transit and Third-Party Accounts

Not everything in bank journals is your money:

| Account | Description | Include in cash? |
|---------|-------------|------------------|
| 57x | Bank/cash accounts | ✅ Yes |
| 5201x | Credit line drawdowns | ✅ Yes — drawn credit is liquid |
| 5200x | Short-term loan reclassifications | ❌ No — accounting reclassification, not cash |
| 555 | Transient / pending application | ❌ No — not the company's money |
| 561 | Client provisions (suplidos) | ❌ No — third-party funds held temporarily |

### Cash Balance from GL, Not from Movements

Summing cash movements within a date range misses prior history and opening balances. True cash balance = cumulative GL balance:

```typescript
// ✅ CORRECT: Cash balance at a point in time from GL
const cashBalance = await client.searchRead('account.move.line',
  [
    ['account_id', 'in', cashAccountIds],
    ['parent_state', '=', 'posted'],
    ['date', '<=', '2025-06-30'],
  ],
  { fields: ['balance'], limit: 0 }
);
const totalCash = cashBalance.reduce((sum, l) => sum + l.balance, 0);

// ❌ WRONG: Only summing movements in a period misses opening balance
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

### Days-to-Pay Calculation

Use `full_reconcile_id` to calculate how long an invoice takes to get paid:

```typescript
async function calculateDaysToPay(
  client: OdooClient, invoiceId: number
): Promise<number | null> {
  // Get receivable/payable lines from the invoice
  const invoiceLines = await client.searchRead('account.move.line',
    [
      ['move_id', '=', invoiceId],
      ['full_reconcile_id', '!=', false],
      ['account_id.account_type', 'in', ['asset_receivable', 'liability_payable']],
    ],
    { fields: ['full_reconcile_id', 'date'], limit: 0 }
  );
  if (!invoiceLines.length) return null;

  const reconcileId = Array.isArray(invoiceLines[0].full_reconcile_id)
    ? invoiceLines[0].full_reconcile_id[0]
    : invoiceLines[0].full_reconcile_id;
  const invoiceDate = invoiceLines[0].date;

  // Find all lines in the reconciliation group — the latest date is the payment
  const allReconLines = await client.searchRead('account.move.line',
    [['full_reconcile_id', '=', reconcileId]],
    { fields: ['date'], limit: 0 }
  );

  const paymentDate = allReconLines.reduce((max, l) =>
    l.date > max ? l.date : max, allReconLines[0].date
  );

  const msPerDay = 86_400_000;
  return Math.round(
    (new Date(paymentDate).getTime() - new Date(invoiceDate).getTime()) / msPerDay
  );
}
```

## Loan Accounting

### Loan Moves Don't Touch Cash

`account.loan` creates Miscellaneous journal entries that reclassify balance sheet accounts (520↔170, interest accrual). These **never** touch bank/cash accounts.

- Use `account.loan` for: outstanding balances, payment schedules, projections
- Do NOT use for: cashflow classification (the actual cash movement is a separate bank entry)

### Bank Loans vs Tax Deferrals

The `account.loan` module handles both bank loans and tax payment deferrals. Distinguish by the short-term account:

| `short_term_loan_account_id` | Type | Cashflow Category |
|-------------------------------|------|-------------------|
| 475x (Hacienda Pública) | Tax deferral (APLAZ) | Operating — tax payments |
| 520x / 170x (Deudas) | Bank loan | Financing — debt repayment |

```typescript
const loans = await client.searchRead('account.loan',
  [],
  { fields: ['name', 'short_term_loan_account_id', 'long_term_loan_account_id'], limit: 0 }
);

for (const loan of loans) {
  const stAccount = Array.isArray(loan.short_term_loan_account_id)
    ? loan.short_term_loan_account_id[1] : '';
  const isBank = /^(520|170)/.test(stAccount);
  const isTaxDeferral = /^475/.test(stAccount);
  console.log(`${loan.name}: ${isBank ? 'BANK LOAN' : isTaxDeferral ? 'TAX DEFERRAL' : 'OTHER'}`);
}
```

### Loan Lines Link to Accounting Entries

Each `account.loan.line` has a `move_ids` field linking to the journal entries it generated. Use this to tag bank movements as loan repayments:

```typescript
const loanLines = await client.searchRead('account.loan.line',
  [['loan_id', '=', loanId], ['move_ids', '!=', false]],
  { fields: ['date', 'payment_amount', 'move_ids'], limit: 0 }
);
// move_ids links to account.move records — these are the loan accounting entries
```

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

## PnL & Cash Flow Structure (Spanish GAAP / PGC)

### Account Code Ranges

Spanish Plan General Contable maps 3-digit prefixes to PnL categories:

| Range | Category | Examples |
|-------|----------|----------|
| 600-609 | Purchases / COGS | 600 Compras mercaderías, 607 Subcontratas |
| 620-629 | External services | 621 Arrendamientos, 623 Servicios profesionales |
| 630-639 | Taxes | 631 Otros tributos |
| 640-649 | Personnel costs | 640 Sueldos y salarios, 642 SS empresa |
| 650-659 | Other operating expenses | |
| 660-669 | Financial expenses | 662 Intereses deudas, 663 Pérdidas valores |
| 680-689 | Depreciation / amortization | 681 Amortización inmovilizado |
| 690-699 | Provisions | |
| 700-709 | Sales | 700 Ventas, 705 Prestaciones servicios |
| 740-749 | Subsidies / grants | |
| 760-769 | Financial income | 763 Beneficios valores |
| 790-797 | Provision reversals | |

### Non-Cash Items

These accounts represent non-cash movements — exclude from cashflow analysis:

- **680-689**: Depreciation / amortization
- **690-699**: Provisions (dotaciones)
- **790-797**: Provision reversals
- **663/763**: Fair value gains/losses on financial instruments

### Cash Flow Statement (EFE) Sections

Per PGC, the Estado de Flujos de Efectivo has three sections:

| Section | Description | Typical Accounts |
|---------|-------------|------------------|
| Explotación | Operating activities | 6xx/7xx (PnL) + working capital changes (430, 410, 475) |
| Inversión | Investing activities | 2xx (fixed assets), 25x (financial investments) |
| Financiación | Financing activities | 17x/52x (debt), 1x (equity) |

Working capital changes (movement in receivables, payables, tax accounts) go under Operating.

## Validation Patterns for Financial Data

### Total Invariance

When reclassifying, splitting, or transforming financial amounts, the total must NEVER change:

```typescript
function validateTotalInvariance(
  before: number[], after: number[], tolerance = 0.01
): void {
  const sumBefore = before.reduce((a, b) => a + b, 0);
  const sumAfter = after.reduce((a, b) => a + b, 0);
  if (Math.abs(sumBefore - sumAfter) > tolerance) {
    throw new Error(
      `Total invariance violated: before=${sumBefore.toFixed(2)}, after=${sumAfter.toFixed(2)}, ` +
      `diff=${(sumAfter - sumBefore).toFixed(2)}`
    );
  }
}
```

### Floating-Point Tolerance

Rounding differences are inevitable in accounting. Use €0.01 tolerance:

```typescript
// ✅ Accounting equality check
const isEqual = (a: number, b: number) => Math.abs(a - b) <= 0.01;

// ❌ Never use strict equality for monetary amounts
// if (total === expected) { ... }
```

### Strict Mode: Fail on Bad Data

Don't continue processing with validation errors. Log, save, and throw:

```typescript
if (!isEqual(computedTotal, expectedTotal)) {
  console.error(`Validation failed: computed=${computedTotal}, expected=${expectedTotal}`);
  // Save partial results for debugging, then throw
  throw new Error('Financial validation failed — see logs');
}
```

## Service Accessor (`client.accounting.*`)

Most patterns in this document are available as programmatic helpers via the accounting service:

```typescript
import { createClient } from '@marcfargas/odoo-client';
const client = await createClient();

// Cash account discovery
const cashAccounts = await client.accounting.discoverCashAccounts();
const cashIds = await client.accounting.getCashAccountIds();

// Cash balance from GL (not movements)
const balance = await client.accounting.getCashBalance(cashIds, '2025-06-30');

// Partner resolution from bank statement counterparts
const partner = await client.accounting.resolvePartnerFromMove(moveId, cashIds);
if (partner.isBatchPayment) {
  console.log('Batch payment to:', partner.allPartnerIds);
}

// Reconciliation tracing
const trace = await client.accounting.traceReconciliation(fullReconcileId);

// Closing entry detection
if (await client.accounting.isClosingEntry(moveId)) { /* skip */ }

// Days-to-pay calculation
const result = await client.accounting.calculateDaysToPay(invoiceId);
if (result) console.log(`Paid in ${result.days} days`);

// Query posted move lines (parent_state='posted' auto-applied, limit defaults to all)
const pnlLines = await client.accounting.getPostedMoveLines(
  [['account_id.code', '=like', '7%'], ['date', '>=', '2025-01-01']],
  { fields: ['account_id', 'debit', 'credit', 'balance'] }
);
```

Standalone functions are also exported for advanced composition:

```typescript
import { discoverCashAccounts, getPostedMoveLines } from '@marcfargas/odoo-client';
```

## Related Documents

- [connection.md](../base/connection.md) - Authentication
- [contracts.md](./contracts.md) - Recurring contracts and billing
- [domains.md](../base/domains.md) - Query filters (especially date ranges, dot notation)
- [search.md](../base/search.md) - Search patterns
