# Search Patterns

Patterns for finding and filtering records in Odoo.

## Overview

Odoo provides several methods for searching records. Choosing the right one affects performance and code clarity.

## Search Methods Comparison

| Method | Returns | Use When |
|--------|---------|----------|
| `search()` | IDs only | You need IDs for further operations |
| `searchRead()` | Records with data | You need record data immediately |
| `searchCount()` | Count | You only need the number of matches |
| `read()` | Records by ID | You already have the IDs |

## Basic Search

### search()

Returns array of matching IDs:

```typescript testable id="search-basic" needs="client" creates="res.partner" expect="result.found === true"
// Create test company
const id = await client.create('res.partner', {
  name: uniqueTestName('Test Company'),
  is_company: true,
});
trackRecord('res.partner', id);

// search() returns IDs only
const ids = await client.search('res.partner', [
  ['is_company', '=', true],
  ['id', '=', id]
]);

return { found: ids.includes(id), count: ids.length };
```

### searchRead()

Returns records with requested fields:

```typescript testable id="search-searchread" needs="client" creates="res.partner" expect="result.hasName === true"
// Create test partner
const id = await client.create('res.partner', {
  name: uniqueTestName('SearchRead Test'),
  email: 'searchread@test.com',
  is_company: true,
});
trackRecord('res.partner', id);

// searchRead returns records with data
const partners = await client.searchRead(
  'res.partner',
  [['id', '=', id]],
  {
    fields: ['name', 'email'],
    limit: 10,
    offset: 0,
    order: 'name asc'
  }
);

const partner = partners[0];
return { hasName: !!partner?.name, hasEmail: !!partner?.email };
```

### searchCount()

Returns count without fetching records:

```typescript testable id="search-count" needs="client" creates="res.partner" expect="result.count >= 1"
// Create test partner
const id = await client.create('res.partner', {
  name: uniqueTestName('Count Test'),
  is_company: true,
});
trackRecord('res.partner', id);

// searchCount — efficient counting without fetching data
const count = await client.searchCount('res.partner', [
  ['is_company', '=', true],
  ['id', '=', id]
]);

return { count };
```

## Search Options

```typescript
const options = {
  fields: ['name', 'email'],  // Fields to return (searchRead only)
  limit: 100,                 // Max records to return
  offset: 0,                  // Skip first N records
  order: 'name asc',          // Sort order
};
```

### Pagination

```typescript
async function* paginatedSearch(model, domain, pageSize = 100) {
  let offset = 0;

  while (true) {
    const records = await client.searchRead(model, domain, {
      fields: ['id', 'name'],
      limit: pageSize,
      offset: offset,
      order: 'id asc'
    });

    if (records.length === 0) break;

    yield records;
    offset += pageSize;
  }
}

// Usage
for await (const batch of paginatedSearch('res.partner', [])) {
  console.log(`Processing ${batch.length} partners...`);
  // Process batch
}
```

### Sorting

```typescript testable id="search-sorting" needs="client" creates="res.partner" expect="result.sorted === true"
// Create test partners
const id1 = await client.create('res.partner', { name: uniqueTestName('Zzz Last Partner') });
const id2 = await client.create('res.partner', { name: uniqueTestName('Aaa First Partner') });
trackRecord('res.partner', id1);
trackRecord('res.partner', id2);

// Search with sorting
const sorted = await client.searchRead('res.partner', [
  ['id', 'in', [id1, id2]]
], {
  fields: ['name'],
  order: 'name asc'
});

// First should be the "Aaa" partner when sorted ascending
const firstIsAaa = sorted[0]?.name?.includes('Aaa');

return { sorted: firstIsAaa, count: sorted.length };
```

## Common Search Patterns

### Find by Exact Value

```typescript
// By ID
const partners = await client.searchRead('res.partner', [
  ['id', '=', 42]
]);

// By email
const partners = await client.searchRead('res.partner', [
  ['email', '=', 'john@example.com']
]);
```

### Find by Text Pattern

```typescript
// Contains (case-insensitive) — ilike auto-wraps with % on both sides
const partners = await client.searchRead('res.partner', [
  ['name', 'ilike', 'software']
]);

// Starts with — use =ilike for anchored patterns (no auto-wrapping)
const partners = await client.searchRead('res.partner', [
  ['name', '=ilike', 'acme%']
]);

// Ends with
const partners = await client.searchRead('res.partner', [
  ['email', '=ilike', '%@gmail.com']
]);
```

> **Key**: `ilike` auto-wraps with `%` — never add `%` manually. Use `=ilike` for starts-with/ends-with patterns. See [domains.md](./domains.md) for full details.

### Find by Multiple Values

```typescript testable id="search-multiple-values" needs="client" creates="res.partner" expect="result.inFound === 2 && result.notInFound === 1"
// Create test partners
const id1 = await client.create('res.partner', { name: uniqueTestName('Partner One'), is_company: true });
const id2 = await client.create('res.partner', { name: uniqueTestName('Partner Two'), is_company: true });
const id3 = await client.create('res.partner', { name: uniqueTestName('Partner Three'), is_company: false });
trackRecord('res.partner', id1);
trackRecord('res.partner', id2);
trackRecord('res.partner', id3);

// IN operator - find partners in the list
const inResults = await client.search('res.partner', [
  ['id', 'in', [id1, id2]]
]);

// NOT IN - find partners NOT in the subset
const notInResults = await client.search('res.partner', [
  ['id', 'in', [id1, id2, id3]],
  ['id', 'not in', [id1, id2]]
]);

return {
  inFound: inResults.filter(id => [id1, id2].includes(id)).length,
  notInFound: notInResults.length
};
```

### Find by Date Range

```typescript
// This month
const startOfMonth = new Date();
startOfMonth.setDate(1);
const endOfMonth = new Date(startOfMonth);
endOfMonth.setMonth(endOfMonth.getMonth() + 1);
endOfMonth.setDate(0);

const records = await client.searchRead('crm.lead', [
  ['create_date', '>=', startOfMonth.toISOString().split('T')[0]],
  ['create_date', '<=', endOfMonth.toISOString().split('T')[0]]
]);

// Last 7 days
const weekAgo = new Date();
weekAgo.setDate(weekAgo.getDate() - 7);

const recent = await client.searchRead('crm.lead', [
  ['create_date', '>=', weekAgo.toISOString().split('T')[0]]
]);
```

### Find by Status/State

```typescript
// Open leads
const openLeads = await client.searchRead('crm.lead', [
  ['probability', '>', 0],
  ['probability', '<', 100]
]);

// Draft orders
const draftOrders = await client.searchRead('sale.order', [
  ['state', '=', 'draft']
]);

// Multiple states
const activeOrders = await client.searchRead('sale.order', [
  ['state', 'in', ['draft', 'sent', 'sale']]
]);
```

### Find by Related Record

```typescript
// Leads for a specific partner
const leads = await client.searchRead('crm.lead', [
  ['partner_id', '=', partnerId]
]);

// Leads for partners in a country
const usLeads = await client.searchRead('crm.lead', [
  ['partner_id.country_id.code', '=', 'US']
]);

// Orders with specific product
const orders = await client.searchRead('sale.order', [
  ['order_line.product_id', '=', productId]
]);
```

### Find with Empty/Non-Empty

```typescript testable id="search-empty-nonempty" needs="client" creates="res.partner" expect="result.withEmailFound === true && result.withoutEmailFound === true"
// Create partner WITH email
const id1 = await client.create('res.partner', {
  name: uniqueTestName('Partner Has Email'),
  email: 'has.email@test.com',
});
trackRecord('res.partner', id1);

// Create partner WITHOUT email
const id2 = await client.create('res.partner', {
  name: uniqueTestName('Partner No Email'),
});
trackRecord('res.partner', id2);

// Has email
const withEmail = await client.search('res.partner', [
  ['id', 'in', [id1, id2]],
  ['email', '!=', false]
]);

// Missing email
const missingEmail = await client.search('res.partner', [
  ['id', 'in', [id1, id2]],
  ['email', '=', false]
]);

return {
  withEmailFound: withEmail.includes(id1) && !withEmail.includes(id2),
  withoutEmailFound: missingEmail.includes(id2) && !missingEmail.includes(id1)
};
```

### Complex OR Conditions

```typescript
// Name OR email contains search term (ilike auto-wraps with %)
const term = 'acme';
const results = await client.searchRead('res.partner', [
  '|',
  ['name', 'ilike', term],
  ['email', 'ilike', term]
]);

// Multiple OR conditions
const results = await client.searchRead('crm.lead', [
  '|', '|',
  ['name', 'ilike', term],
  ['email_from', 'ilike', term],
  ['phone', 'ilike', term]
]);
```

### Combined AND + OR

```typescript
// (state = draft OR state = sent) AND partner_id = 42
const orders = await client.searchRead('sale.order', [
  '&',
  '|',
  ['state', '=', 'draft'],
  ['state', '=', 'sent'],
  ['partner_id', '=', 42]
]);
```

## Performance Tips

### 1. Request Only Needed Fields

```typescript
// BAD - fetches all fields
const partners = await client.searchRead('res.partner', domain);

// GOOD - only needed fields
const partners = await client.searchRead('res.partner', domain, {
  fields: ['name', 'email']
});
```

### 2. Use Limits

```typescript
// BAD - could return thousands
const all = await client.searchRead('res.partner', []);

// GOOD - paginate
const page = await client.searchRead('res.partner', [], {
  limit: 100,
  offset: 0
});
```

### 3. Use searchCount for Existence Checks

```typescript
// BAD - fetches all data just to check existence
const exists = (await client.searchRead('res.partner', domain)).length > 0;

// GOOD - just count
const exists = (await client.searchCount('res.partner', domain)) > 0;
```

### 4. Filter in Domain, Not Code

```typescript
// BAD - fetch all, filter in code
const all = await client.searchRead('res.partner', []);
const companies = all.filter(p => p.is_company);

// GOOD - filter in domain
const companies = await client.searchRead('res.partner', [
  ['is_company', '=', true]
]);
```

## Full-Text Search Alternative

For complex text search, consider searching multiple fields:

```typescript
async function fullTextSearch(model, searchFields, term, options = {}) {
  if (!term) return [];

  // Build OR domain for all search fields
  const domain = [];
  searchFields.forEach((field, i) => {
    if (i > 0) domain.unshift('|');
    domain.push([field, 'ilike', term]);
  });

  return client.searchRead(model, domain, options);
}

// Usage
const results = await fullTextSearch(
  'res.partner',
  ['name', 'email', 'phone', 'street'],
  'acme',
  { fields: ['name', 'email'], limit: 20 }
);
```

## Related Documents

- [domains.md](./domains.md) - Domain syntax reference
- [crud.md](./crud.md) - CRUD patterns
- [field-types.md](./field-types.md) - Field types
