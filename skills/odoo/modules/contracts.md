# OCA Contracts — Recurring Invoicing

Patterns for working with the OCA `contract` module for recurring billing, revenue projection, and subscription-style invoicing.

**Required modules**: `contract` (from [OCA/contract](https://github.com/OCA/contract))

## Key Models

| Model | Description |
|-------|-------------|
| `contract.contract` | Contract header — partner, journal, billing schedule |
| `contract.line` | Individual contract lines — product, price, recurrence |

## Reading Contracts

### Include Archived/Ended Contracts

Ended and cancelled contracts are archived (`active=False`). Use `active_test: false` to see them:

```typescript
// ✅ All contracts, including ended/cancelled
const contracts = await client.searchRead('contract.contract',
  [],
  {
    fields: [
      'name', 'partner_id', 'active', 'recurring_next_date',
      'date_start', 'date_end', 'contract_line_ids',
    ],
    context: { active_test: false },
    limit: 0,
  }
);
```

### Reading Contract Lines

```typescript
const lines = await client.searchRead('contract.line',
  [['contract_id', '=', contractId]],
  {
    fields: [
      'name', 'product_id', 'quantity', 'price_unit', 'price_subtotal',
      'recurring_rule_type', 'recurring_interval', 'recurring_next_date',
      'date_start', 'date_end', 'is_canceled',
    ],
    limit: 0,
  }
);
```

## Billing Schedule

### Recurrence Fields

| Field | Values | Description |
|-------|--------|-------------|
| `recurring_rule_type` | `daily`, `weekly`, `monthly`, `monthlylastday`, `quarterly`, `semesterly`, `yearly` | Billing frequency unit |
| `recurring_interval` | integer | How many units between billings |
| `recurring_next_date` | date | Next scheduled billing date |

### Price Is Per Billing Cycle, NOT Monthly

**Critical**: `contract.line.price_subtotal` is the amount per billing event. A yearly contract billed annually has ONE payment for the full amount — not twelve monthly portions.

```typescript
// ❌ WRONG — dividing yearly price by 12 gives wrong monthly amount
//    if the contract actually bills once a year
const monthlyRevenue = line.price_subtotal / 12;

// ✅ CORRECT — respect the billing schedule
const billingCycleDays = {
  daily: 1 * line.recurring_interval,
  weekly: 7 * line.recurring_interval,
  monthly: 30 * line.recurring_interval,
  quarterly: 90 * line.recurring_interval,
  semesterly: 180 * line.recurring_interval,
  yearly: 365 * line.recurring_interval,
};

const cycleDays = billingCycleDays[line.recurring_rule_type] ?? 30;
const dailyRate = line.price_subtotal / cycleDays;
```

## Revenue Projection

### Event-Based Projection

Generate one billing event per contract line per billing date. This matches how Odoo actually generates invoices:

```typescript
interface BillingEvent {
  contractId: number;
  lineId: number;
  date: string;
  amount: number;
  partnerId: number;
}

function projectBillingEvents(
  line: any,
  contract: any,
  fromDate: string,
  toDate: string,
): BillingEvent[] {
  const events: BillingEvent[] = [];
  let nextDate = new Date(line.recurring_next_date || fromDate);
  const end = new Date(toDate);
  const contractEnd = line.date_end ? new Date(line.date_end) : null;

  while (nextDate <= end) {
    if (contractEnd && nextDate > contractEnd) break;
    if (nextDate >= new Date(fromDate)) {
      events.push({
        contractId: Array.isArray(contract.id) ? contract.id[0] : contract.id,
        lineId: line.id,
        date: nextDate.toISOString().slice(0, 10),
        amount: line.price_subtotal,
        partnerId: Array.isArray(contract.partner_id)
          ? contract.partner_id[0] : contract.partner_id,
      });
    }

    // Advance by recurring_interval × recurring_rule_type
    switch (line.recurring_rule_type) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + line.recurring_interval);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7 * line.recurring_interval);
        break;
      case 'monthly':
      case 'monthlylastday':
        nextDate.setMonth(nextDate.getMonth() + line.recurring_interval);
        break;
      case 'quarterly':
        nextDate.setMonth(nextDate.getMonth() + 3 * line.recurring_interval);
        break;
      case 'semesterly':
        nextDate.setMonth(nextDate.getMonth() + 6 * line.recurring_interval);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + line.recurring_interval);
        break;
      default:
        nextDate.setMonth(nextDate.getMonth() + line.recurring_interval);
    }
  }

  return events;
}
```

### `recurring_next_date` Can Be Far in the Future

The contract module can pre-generate invoices ahead of schedule. When computing reference dates or filtering, don't use `MAX(recurring_next_date)` without a reasonable cap:

```typescript
// ❌ Dangerous — could be years ahead
const maxDate = contracts.reduce((max, c) =>
  c.recurring_next_date > max ? c.recurring_next_date : max, '');

// ✅ Cap to a reasonable horizon
const horizon = new Date();
horizon.setFullYear(horizon.getFullYear() + 1);
const maxDate = horizon.toISOString().slice(0, 10);
```

## Common Account Patterns

| Account Range | Typical Contract Use |
|---------------|---------------------|
| 700 | Sales of goods (product contracts) |
| 705 | Service revenue (service contracts) |
| 759 | Other operating income |

## Related Documents

- [accounting.md](./accounting.md) - Accounting patterns, cashflow, reconciliation
- [../base/domains.md](../base/domains.md) - Query filter syntax
- [../base/search.md](../base/search.md) - Search patterns
