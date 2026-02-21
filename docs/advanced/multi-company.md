# Multi-Company

How to work with Odoo instances that have multiple companies configured.

## How Multi-Company Works

Odoo's multi-company model is session-based: each user session has a set of *active companies* stored in `allowed_company_ids`. Records from companies not in that set are invisible to the session — they're filtered at the ORM level.

When you connect via `createClient()`, you get the active companies configured for that user account. If your user has access to companies 1 and 5, queries automatically return records from both.

## Passing Company Context Explicitly

For full control over which companies' data is returned, pass `allowed_company_ids` in the request context:

```typescript testable id="mc-basic-context" needs="client" expect="result.success === true"
// Fetch records visible to companies 1 and 5
const moves = await client.searchRead('account.move', [
  ['state', '=', 'posted'],
  ['date', '>=', '2025-01-01'],
], {
  fields: ['name', 'company_id', 'amount_total'],
  limit: 100,
  context: { allowed_company_ids: [1, 5] },
});

return { success: true, count: moves.length };
```

> **Important:** `allowed_company_ids` must contain company IDs that the authenticated user actually has access to. Passing company IDs the user can't access doesn't grant additional access — Odoo validates against the user's configured companies.

## Discover Available Companies

Get the companies the current user can access:

```typescript testable id="mc-list-companies" needs="client" expect="result.count >= 1"
const companies = await client.searchRead('res.company', [], {
  fields: ['id', 'name', 'currency_id'],
  order: 'id asc',
  limit: 0,
});

console.log('Available companies:');
for (const co of companies) {
  console.log(`  ${co.id}: ${co.name}`);
}

return { count: companies.length };
```

Get the IDs for use in context:

```typescript testable id="mc-get-company-ids" needs="client" expect="result.ids.length >= 1"
const companies = await client.searchRead('res.company', [], {
  fields: ['id'],
  limit: 0,
});

const companyIds = companies.map(c => c.id);
console.log('Company IDs:', companyIds);

return { ids: companyIds };
```

## Cross-Company Queries

To aggregate data across all accessible companies, pass all company IDs in context:

```typescript testable id="mc-all-companies" needs="client" expect="result.success === true"
// Get all company IDs for the authenticated user
const companies = await client.searchRead('res.company', [], {
  fields: ['id', 'name'],
  limit: 0,
});
const allCompanyIds = companies.map(c => c.id);

// Accounting query across all companies
const pnlLines = await client.searchRead('account.move.line', [
  ['parent_state', '=', 'posted'],
  ['account_id.code', '=like', '7%'],
  ['date', '>=', '2025-01-01'],
], {
  fields: ['company_id', 'account_id', 'balance'],
  limit: 0,
  context: { allowed_company_ids: allCompanyIds },
});

// Group by company
const byCompany: Record<number, number> = {};
for (const line of pnlLines) {
  const coId = Array.isArray(line.company_id) ? line.company_id[0] : line.company_id;
  byCompany[coId] = (byCompany[coId] || 0) - line.balance; // invert sign for revenue
}

return { success: true, byCompany };
```

## Filtering by Specific Company

To isolate one company's data, filter by `company_id` in the domain:

```typescript testable id="mc-filter-one-company" needs="client" expect="result.success === true"
const companyId = 1; // Target company

const records = await client.searchRead('account.move', [
  ['state', '=', 'posted'],
  ['company_id', '=', companyId],
], {
  fields: ['name', 'company_id', 'amount_total'],
  context: { allowed_company_ids: [companyId] },
  limit: 50,
});

return { success: true, count: records.length };
```

## The `company_id` Field

Most multi-company-aware models have a `company_id` field:

```typescript testable id="mc-company-field" needs="client" expect="result.success === true"
const lead = await client.create('crm.lead', {
  name: 'Multi-company test',
  company_id: 1,   // Assign to company 1
});

const [record] = await client.read('crm.lead', [lead], ['company_id']);
// record.company_id = [1, 'My Company']  — Many2one tuple

await client.unlink('crm.lead', lead);
return { success: true };
```

## Common Permission Errors

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Query returns 0 records (expected > 0) | `company_id` not in `allowed_company_ids` | Add correct company IDs to context |
| `create` or `write` raises access error | User doesn't have rights in that company | Check user's company configuration |
| Archived accounts visible | `active_test: false` not applied | Add `context: { active_test: false }` |
| Cross-company `write` blocked | Odoo restricts cross-company record changes | Write records one company at a time |

## Creating Records in a Specific Company

When creating records that belong to a company, set `company_id` explicitly and include it in context:

```typescript testable id="mc-create-in-company" needs="client" creates="res.partner" expect="result.success === true"
const companyId = 1;

const partnerId = await client.call('res.partner', 'create', [{
  name: 'Company-Specific Partner',
  company_id: companyId,
}], {
  context: {
    allowed_company_ids: [companyId],
    force_company: companyId,  // Some models require this
  }
});

const [partner] = await client.read('res.partner', [partnerId], ['company_id']);
await client.unlink('res.partner', partnerId);

return { success: true };
```

## Multi-Company in Services

The accounting service supports `companyIds` option for cash balance:

```typescript testable id="mc-accounting-service" needs="client" expect="typeof result.balance === 'number'"
const companies = await client.searchRead('res.company', [], { fields: ['id'], limit: 0 });
const companyIds = companies.map(c => c.id);

const cashIds = await client.accounting.getCashAccountIds();
const today = new Date().toISOString().split('T')[0];

const balance = await client.accounting.getCashBalance(cashIds, today, { companyIds });
console.log(`Consolidated cash balance: €${balance.toFixed(2)}`);

return { balance };
```

---

See also:
- [Accounting Service](../services/accounting.md) — multi-company context in financial queries
- [Advanced Domains](./domains.md) — filtering by `company_id`

For agent-optimized CLI examples, see the [odoo skill](../skills/odoo/).
