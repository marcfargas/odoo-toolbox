# Search Patterns

## Search Methods

| Method | Returns | Use When |
|--------|---------|----------|
| `search()` | `number[]` (IDs) | Need IDs for further operations |
| `searchRead()` | `object[]` (records) | Need record data |
| `searchCount()` | `number` | Only need count |
| `read()` | Records by ID | Already have IDs |

```typescript testable id="search-basic" needs="client" creates="res.partner" expect="result.found === true"
const id = await client.create('res.partner', {
  name: uniqueTestName('Test Company'),
  is_company: true,
});
trackRecord('res.partner', id);

const ids = await client.search('res.partner', [
  ['is_company', '=', true],
  ['id', '=', id]
]);

return { found: ids.includes(id), count: ids.length };
```

```typescript testable id="search-searchread" needs="client" creates="res.partner" expect="result.hasName === true"
const id = await client.create('res.partner', {
  name: uniqueTestName('SearchRead Test'),
  email: 'searchread@test.com',
  is_company: true,
});
trackRecord('res.partner', id);

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

```typescript testable id="search-count" needs="client" creates="res.partner" expect="result.count >= 1"
const id = await client.create('res.partner', {
  name: uniqueTestName('Count Test'),
  is_company: true,
});
trackRecord('res.partner', id);

const count = await client.searchCount('res.partner', [
  ['is_company', '=', true],
  ['id', '=', id]
]);

return { count };
```

## Pagination

```typescript
async function* paginatedSearch(model, domain, pageSize = 100) {
  let offset = 0;
  while (true) {
    const records = await client.searchRead(model, domain, {
      fields: ['id', 'name'],
      limit: pageSize,
      offset,
      order: 'id asc'
    });
    if (records.length === 0) break;
    yield records;
    offset += pageSize;
  }
}
```

## Sorting

```typescript testable id="search-sorting" needs="client" creates="res.partner" expect="result.sorted === true"
const id1 = await client.create('res.partner', { name: uniqueTestName('Zzz Last Partner') });
const id2 = await client.create('res.partner', { name: uniqueTestName('Aaa First Partner') });
trackRecord('res.partner', id1);
trackRecord('res.partner', id2);

const sorted = await client.searchRead('res.partner', [
  ['id', 'in', [id1, id2]]
], {
  fields: ['name'],
  order: 'name asc'
});

const firstIsAaa = sorted[0]?.name?.includes('Aaa');

return { sorted: firstIsAaa, count: sorted.length };
```

## Common Patterns

```typescript testable id="search-multiple-values" needs="client" creates="res.partner" expect="result.inFound === 2 && result.notInFound === 1"
const id1 = await client.create('res.partner', { name: uniqueTestName('Partner One'), is_company: true });
const id2 = await client.create('res.partner', { name: uniqueTestName('Partner Two'), is_company: true });
const id3 = await client.create('res.partner', { name: uniqueTestName('Partner Three'), is_company: false });
trackRecord('res.partner', id1);
trackRecord('res.partner', id2);
trackRecord('res.partner', id3);

const inResults = await client.search('res.partner', [['id', 'in', [id1, id2]]]);
const notInResults = await client.search('res.partner', [
  ['id', 'in', [id1, id2, id3]],
  ['id', 'not in', [id1, id2]]
]);

return {
  inFound: inResults.filter(id => [id1, id2].includes(id)).length,
  notInFound: notInResults.length
};
```

```typescript testable id="search-empty-nonempty" needs="client" creates="res.partner" expect="result.withEmailFound === true && result.withoutEmailFound === true"
const id1 = await client.create('res.partner', {
  name: uniqueTestName('Partner Has Email'),
  email: 'has.email@test.com',
});
trackRecord('res.partner', id1);

const id2 = await client.create('res.partner', {
  name: uniqueTestName('Partner No Email'),
});
trackRecord('res.partner', id2);

const withEmail = await client.search('res.partner', [
  ['id', 'in', [id1, id2]],
  ['email', '!=', false]
]);

const missingEmail = await client.search('res.partner', [
  ['id', 'in', [id1, id2]],
  ['email', '=', false]
]);

return {
  withEmailFound: withEmail.includes(id1) && !withEmail.includes(id2),
  withoutEmailFound: missingEmail.includes(id2) && !missingEmail.includes(id1)
};
```

### Date Range

```typescript
const weekAgo = new Date();
weekAgo.setDate(weekAgo.getDate() - 7);

const recent = await client.searchRead('crm.lead', [
  ['create_date', '>=', weekAgo.toISOString().split('T')[0]]
], { fields: ['name', 'create_date'], limit: 50 });
```

### Performance

- Always specify `fields` — omitting fetches all fields
- Use `searchCount` for existence checks, not `searchRead(...).length`
- Filter in domain, not in code
- **`searchRead` defaults to limit=100** — pass explicit `limit`
