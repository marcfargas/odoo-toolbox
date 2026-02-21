# Multi-Company

Odoo supports running multiple companies in a single database. Context controls which
company is "active" for a session. Getting it wrong causes access errors or silently
returns wrong data.

## Key Concept: `allowed_company_ids`

`allowed_company_ids` in the RPC context is **not** a permission filter — it declares
which companies are "active" for the current request. Odoo uses this to:

- Filter records with `company_id` fields
- Enforce multi-company access rules (`ir.rule`)
- Set the default `company_id` on newly created records

**The current user still needs access rights to each listed company.**

## CLI Examples

### List Available Companies

```bash
odoo records search res.company --fields id,name
```

### Search with Company Context

```bash
# Restrict to company 1 only
odoo records search sale.order \
  --context '{"allowed_company_ids": [1]}' \
  --fields name,partner_id,amount_total \
  --limit 10

# Two active companies simultaneously
odoo records search sale.order \
  --context '{"allowed_company_ids": [1, 2]}' \
  --fields name,company_id,amount_total \
  --limit 20
```

### Create a Record in a Specific Company

```bash
# Both context AND company_id must agree
odoo records create res.partner \
  --data '{"name":"Acme EMEA","company_id":2}' \
  --context '{"allowed_company_ids": [2]}' \
  --confirm
```

### Verify Which Company a Record Belongs To

```bash
odoo records get sale.order 88 --fields name,company_id
```

## Library Examples

```typescript
import { createClient } from '@marcfargas/odoo-client';
const client = await createClient();

// Query in a specific company context
const orders = await client.searchRead('sale.order', [], ['name', 'amount_total'], 10, 0, 'name asc', {
  allowed_company_ids: [1],
});

// Create a record in company 2
const partnerId = await client.create(
  'res.partner',
  { name: 'Acme EMEA', company_id: 2 },
  { allowed_company_ids: [2] }
);
```

> For full TypeScript patterns, context helpers, and multi-company rule internals, see
> [docs/advanced/multi-company.md](../../../docs/advanced/multi-company.md).

## Common Gotchas

| Gotcha | Explanation |
|--------|-------------|
| `allowed_company_ids` ≠ "permitted companies" | It declares active companies, not grants access |
| "Access error" on read/write | Usually wrong or missing `allowed_company_ids` in context |
| Record not found after create | Context didn't include the target company — record is there, just invisible |
| `company_id` vs `company_ids` | Single-company models use `company_id` (Many2One); some shared models use `company_ids` (Many2Many) |
| Default company on create | Without context, Odoo uses the user's `company_id`; set `allowed_company_ids` to override |

## Check a Record's Company

```bash
# Inspect company_id on any model that has it
odoo records get res.partner 42 --fields name,company_id

# Find records without a company (shared / public)
odoo records search res.partner --domain '[["company_id","=",false]]' --fields name --limit 5
```
