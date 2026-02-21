# Search

Methods for querying Odoo records. All search methods accept a **domain** (filter array) — see [Advanced Domains](../advanced/domains.md) for complex filter composition.

## Method Overview

| Method | Returns | Best for |
|--------|---------|----------|
| `searchRead(model, domain, options)` | `object[]` — records with fields | Fetching data to display or process |
| `search(model, domain, options)` | `number[]` — record IDs | Getting IDs for subsequent operations |
| `searchCount(model, domain)` | `number` — count | Checking existence or counting without fetching data |
| `read(model, ids, fields)` | `object[]` — records by ID | Fetching specific known records |

## `searchRead`

The most commonly used method — filters and fetches fields in a single RPC call:

```typescript testable id="search-searchread" needs="client" creates="res.partner" expect="result.length >= 0"
const partners = await client.searchRead('res.partner', [
  ['is_company', '=', true],
], {
  fields: ['name', 'email', 'phone'],
  limit: 20,
  offset: 0,
  order: 'name asc',
});

console.log(`Found ${partners.length} companies`);
return partners;
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `fields` | `string[]` | all fields | Field names to fetch. Always specify this. |
| `limit` | `number` | **100** | Max records. Pass `0` for all records (careful with large sets). |
| `offset` | `number` | 0 | Records to skip (for pagination). |
| `order` | `string` | model default | Sort expression: `'name asc'`, `'date desc, id asc'` |
| `context` | `object` | — | Odoo context: `{ active_test: false }` to include archived records |

> **Default limit is 100.** This is the most common source of silent data loss. Always pass an explicit `limit`.

## `search`

Returns an array of IDs. Use when you need IDs to pass to another operation, or when you only need to know which records match:

```typescript testable id="search-search" needs="client" creates="res.partner" expect="result.length >= 0"
const ids = await client.search('res.partner', [
  ['is_company', '=', true],
  ['email', '!=', false],
], {
  limit: 50,
  order: 'name asc',
});

console.log(`Found IDs: ${ids.join(', ')}`);
return ids;
```

Use `search` followed by `read` when you want a specific set of fields from a filtered result:

```typescript testable id="search-then-read" needs="client" creates="res.partner" expect="result.length >= 0"
const ids = await client.search('res.partner', [['is_company', '=', true]], { limit: 10 });
const records = await client.read('res.partner', ids, ['name', 'email']);
return records;
```

## `searchCount`

Returns the number of records matching a domain — without fetching any data:

```typescript testable id="search-count" needs="client" creates="res.partner" expect="typeof result === 'number'"
const companyCount = await client.searchCount('res.partner', [
  ['is_company', '=', true],
]);

console.log(`Total companies: ${companyCount}`);
return companyCount;
```

Use `searchCount` for:
- **Existence checks** — faster than `searchRead(...).length`
- **Dashboard counts** — no need to fetch actual data
- **Pagination** — get total before paging through results

## Pagination

For large result sets, paginate with `limit` and `offset`:

```typescript testable id="search-pagination" needs="client" expect="result.success === true"
const PAGE_SIZE = 50;
let offset = 0;
let totalFetched = 0;

while (true) {
  const page = await client.searchRead('res.partner', [], {
    fields: ['name', 'email'],
    limit: PAGE_SIZE,
    offset,
    order: 'id asc',  // stable ordering is critical for pagination
  });

  if (page.length === 0) break;

  totalFetched += page.length;
  offset += PAGE_SIZE;

  if (page.length < PAGE_SIZE) break;  // Last page
}

return { success: true, totalFetched };
```

Using an async generator makes pagination composable:

```typescript
async function* paginatedSearch(
  client: OdooClient,
  model: string,
  domain: any[],
  fields: string[],
  pageSize = 100
) {
  let offset = 0;
  while (true) {
    const records = await client.searchRead(model, domain, {
      fields,
      limit: pageSize,
      offset,
      order: 'id asc',  // always sort by ID for stable pagination
    });
    if (records.length === 0) break;
    yield records;
    offset += pageSize;
    if (records.length < pageSize) break;
  }
}

// Usage
for await (const page of paginatedSearch(client, 'res.partner', [], ['name', 'email'])) {
  for (const record of page) {
    console.log(record.name);
  }
}
```

## Sorting

Pass an `order` string using Odoo's syntax (`field direction, field direction`):

```typescript testable id="search-sorting" needs="client" creates="res.partner" expect="result.sorted === true"
const id1 = await client.create('res.partner', { name: 'Zzz Last' });
const id2 = await client.create('res.partner', { name: 'Aaa First' });

const sorted = await client.searchRead('res.partner', [['id', 'in', [id1, id2]]], {
  fields: ['name'],
  order: 'name asc',
});

const firstIsAaa = sorted[0]?.name?.includes('Aaa');
return { sorted: firstIsAaa };
```

Multi-field sorting: `order: 'date desc, name asc'`

> For pagination, always include `id asc` as the final sort key to ensure stable ordering when the primary field has duplicates.

## Common Filter Patterns

### Filter by multiple values (`in`)

```typescript testable id="search-in" needs="client" creates="res.partner" expect="result.found === 2"
const id1 = await client.create('res.partner', { name: 'Partner One' });
const id2 = await client.create('res.partner', { name: 'Partner Two' });

const results = await client.search('res.partner', [
  ['id', 'in', [id1, id2]],
]);

return { found: results.filter(id => [id1, id2].includes(id)).length };
```

### Check for set / unset fields

```typescript testable id="search-null-check" needs="client" creates="res.partner" expect="result.withEmail === true && result.withoutEmail === true"
const id1 = await client.create('res.partner', { name: 'Has Email', email: 'test@example.com' });
const id2 = await client.create('res.partner', { name: 'No Email' });

// Field is set — compare to false (Odoo's null)
const withEmail = await client.search('res.partner', [
  ['id', 'in', [id1, id2]],
  ['email', '!=', false],
]);

const withoutEmail = await client.search('res.partner', [
  ['id', 'in', [id1, id2]],
  ['email', '=', false],
]);

return {
  withEmail: withEmail.includes(id1) && !withEmail.includes(id2),
  withoutEmail: withoutEmail.includes(id2) && !withoutEmail.includes(id1),
};
```

### Date range

```typescript
const weekAgo = new Date();
weekAgo.setDate(weekAgo.getDate() - 7);
const dateStr = weekAgo.toISOString().split('T')[0]; // 'YYYY-MM-DD'

const recentLeads = await client.searchRead('crm.lead', [
  ['create_date', '>=', dateStr],
], {
  fields: ['name', 'create_date', 'stage_id'],
  limit: 100,
});
```

### Case-insensitive text search (`ilike`)

```typescript testable id="search-ilike" needs="client" creates="res.partner" expect="result.found === true"
const id = await client.create('res.partner', { name: 'Software Solutions Inc' });

// ilike auto-wraps with % — just pass the search term, not %term%
const results = await client.search('res.partner', [
  ['name', 'ilike', 'software'],
]);

return { found: results.includes(id) };
```

> `ilike 'acme'` becomes `ILIKE '%acme%'`. Do **not** pass `'%acme%'` — that becomes `ILIKE '%%acme%%'` (double-wrapped, returns nothing).

## Performance Tips

- **Always specify `fields`** — omitting fetches all 50+ fields per record
- **Use `searchCount` for existence checks** — not `searchRead(...).length`
- **Filter in domain, not in code** — Odoo's DB query is faster than Python/JS filtering
- **Use `limit: 0` only for small models** — for large models, paginate
- **Add `order: 'id asc'`** when paginating for stable results

---

See also:
- [Advanced Domains](../advanced/domains.md) — OR/NOT operators, dot notation, special values
- [Batch Operations](../advanced/batch-operations.md) — high-performance data fetching

For agent-optimized CLI examples, see the [odoo skill](../skills/odoo/).
