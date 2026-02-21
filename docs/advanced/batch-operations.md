# Batch Operations

Performance patterns for working with large datasets in Odoo.

## The Limit-100 Trap

`searchRead` silently truncates results at 100 records by default. Always pass an explicit limit:

```typescript
// ❌ Silently returns at most 100 records — data loss
const all = await client.searchRead('account.move.line',
  [['date', '>=', '2025-01-01']],
  { fields: ['debit', 'credit'] }
);

// ✅ All records
const all = await client.searchRead('account.move.line',
  [['date', '>=', '2025-01-01']],
  { fields: ['debit', 'credit'], limit: 0 }
);

// ✅ First 500 records explicitly
const first500 = await client.searchRead('account.move.line',
  [['date', '>=', '2025-01-01']],
  { fields: ['debit', 'credit'], limit: 500 }
);
```

Use `limit: 0` only when you know the result set is manageable. For large models (1M+ records), always paginate.

## Pagination

Paginate with `limit` and `offset`. Always use a stable sort to avoid skipping or duplicating records:

```typescript testable id="batch-pagination" needs="client" expect="result.success === true"
const PAGE_SIZE = 200;
let offset = 0;
let totalProcessed = 0;

while (true) {
  const page = await client.searchRead('res.partner', [], {
    fields: ['id', 'name', 'email'],
    limit: PAGE_SIZE,
    offset,
    order: 'id asc',  // ← stable sort is critical
  });

  if (page.length === 0) break;

  // Process the page
  totalProcessed += page.length;

  if (page.length < PAGE_SIZE) break;  // Last page
  offset += PAGE_SIZE;
}

return { success: true, totalProcessed };
```

### Generator-Based Pagination

Wrap pagination in an async generator for composable, lazy evaluation:

```typescript
async function* paginate<T>(
  client: OdooClient,
  model: string,
  domain: any[],
  fields: string[],
  pageSize = 200
): AsyncGenerator<T[]> {
  let offset = 0;
  while (true) {
    const records = await client.searchRead<T>(model, domain, {
      fields,
      limit: pageSize,
      offset,
      order: 'id asc',
    });
    if (records.length === 0) return;
    yield records;
    if (records.length < pageSize) return;  // Last page
    offset += pageSize;
  }
}

// Usage: process every res.partner
for await (const page of paginate(client, 'res.partner', [], ['name', 'email'])) {
  for (const partner of page) {
    // process partner
  }
}
```

### Count Before Paging

Get the total before starting, useful for progress reporting:

```typescript testable id="batch-count-first" needs="client" expect="result.success === true"
const domain = [['is_company', '=', true]];
const total = await client.searchCount('res.partner', domain);

console.log(`Processing ${total} companies...`);

const PAGE_SIZE = 100;
let processed = 0;

for (let offset = 0; offset < total; offset += PAGE_SIZE) {
  const page = await client.searchRead('res.partner', domain, {
    fields: ['name'],
    limit: PAGE_SIZE,
    offset,
    order: 'id asc',
  });
  processed += page.length;
  console.log(`Progress: ${processed}/${total}`);
}

return { success: true, processed };
```

## Bulk Create

`create` only creates one record at a time. To create many records efficiently, use a loop — but batch the `create` calls to keep memory usage predictable:

```typescript testable id="batch-bulk-create" needs="client" creates="res.partner" expect="result.created === 5"
const records = [
  { name: 'Batch Partner 1', email: 'b1@example.com' },
  { name: 'Batch Partner 2', email: 'b2@example.com' },
  { name: 'Batch Partner 3', email: 'b3@example.com' },
  { name: 'Batch Partner 4', email: 'b4@example.com' },
  { name: 'Batch Partner 5', email: 'b5@example.com' },
];

// Create records sequentially (Odoo doesn't support bulk create via RPC)
const ids: number[] = [];
for (const record of records) {
  const id = await client.create('res.partner', record);
  ids.push(id);
}

// Clean up
await client.unlink('res.partner', ids);

return { created: ids.length };
```

For large imports, consider:
- Using `client.call('res.partner', 'create', [arrayOfValues])` if the model supports batch create
- Breaking imports into chunks to avoid timeout issues
- Suppressing mail tracking for speed: `context: { tracking_disable: true, mail_create_nosubscribe: true }`

## Bulk Write

`write` natively supports multiple IDs in one call:

```typescript testable id="batch-bulk-write" needs="client" creates="res.partner" expect="result.updated === 3"
const id1 = await client.create('res.partner', { name: 'BW Partner 1' });
const id2 = await client.create('res.partner', { name: 'BW Partner 2' });
const id3 = await client.create('res.partner', { name: 'BW Partner 3' });

// Single RPC call to update all three records
await client.write('res.partner', [id1, id2, id3], {
  is_company: true,
  active: true,
});

const updated = await client.read('res.partner', [id1, id2, id3], ['is_company']);
const allUpdated = updated.filter(r => r.is_company).length;

await client.unlink('res.partner', [id1, id2, id3]);

return { updated: allUpdated };
```

## Field Selection

Always specify exactly the fields you need. Odoo models often have 50–100+ fields, and fetching all of them is slow:

```typescript
// ❌ Fetches all fields — slow, large payload
const leads = await client.searchRead('crm.lead', [], {});

// ✅ Fetches only what's needed
const leads = await client.searchRead('crm.lead', [], {
  fields: ['name', 'partner_id', 'stage_id', 'amount_total'],
  limit: 100,
});
```

## Existence Check

Use `searchCount` for existence checks — faster than fetching records:

```typescript testable id="batch-exists" needs="client" expect="result.exists === true"
// ✅ Fast — no record data transferred
const count = await client.searchCount('res.partner', [['email', '=', 'admin@example.com']]);
const exists = count > 0;

// ❌ Slower — fetches record data just to check existence
const records = await client.searchRead('res.partner', [['email', '=', 'admin@example.com']], {
  fields: ['id'], limit: 1,
});
const existsSlow = records.length > 0;

return { exists };
```

## Suppressing Mail Side-Effects at Scale

For bulk operations, suppress mail tracking to improve performance and avoid noise:

```typescript testable id="batch-suppress-mail" needs="client" creates="res.partner" expect="result.created === true"
// Create without auto-subscribing or creating log messages
const id = await client.call('res.partner', 'create', [{
  name: 'Bulk Import Record',
  email: 'bulk@example.com',
}], {
  context: {
    tracking_disable: true,        // Skip field change tracking
    mail_create_nosubscribe: true, // Don't subscribe the creator
    mail_create_nolog: true,       // Don't create 'Created' message
  }
});

await client.unlink('res.partner', id);
return { created: true };
```

## Performance Checklist

| Practice | Impact |
|----------|--------|
| Always specify `fields` | High — avoids fetching 50+ unused fields |
| Always specify `limit` | High — avoids silent truncation |
| Use `searchCount` for existence | Medium — avoids field transfer |
| Bulk write with `[id1, id2, ...]` | Medium — one RPC instead of N |
| Paginate with stable `order: 'id asc'` | Critical — prevents skips/dupes |
| Suppress mail tracking on imports | Medium — reduces server-side work |
| Filter in domain, not in JS | High — DB filtering is much faster |

---

See also:
- [Search](../client/search.md) — method overview and limit gotcha
- [Domains](./domains.md) — efficient domain-based filtering

For agent-optimized CLI examples, see the [odoo skill](../skills/odoo/).
