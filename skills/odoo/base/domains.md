# Odoo Domain Filters

Domains are Odoo's query filter syntax — arrays of condition tuples combined with prefix logical operators. Empty domain `[]` matches all records.

## Operators

| Operator | Example | Notes |
|----------|---------|-------|
| `=`, `!=` | `['state', '=', 'draft']` | |
| `>`, `>=`, `<`, `<=` | `['amount', '>', 1000]` | |
| `=?` | `['team_id', '=?', teamId]` | True if value is null/false; otherwise acts as `=` |
| `in`, `not in` | `['state', 'in', ['draft', 'sent']]` | |
| `like` | `['code', 'like', 'SO%']` | Case-sensitive, **you supply wildcards** |
| `ilike` | `['name', 'ilike', 'john']` | Case-insensitive, **auto-wraps with `%`** → `ILIKE '%john%'` |
| `=like` | `['code', '=like', 'SO%']` | Exact pattern, case-sensitive, no auto-wrapping |
| `=ilike` | `['code', '=ilike', 'so%']` | Exact pattern, case-insensitive |
| `child_of` | `['category_id', 'child_of', parentId]` | Hierarchical models |
| `parent_of` | `['category_id', 'parent_of', childId]` | Hierarchical models |

**⚠️ `ilike` auto-wraps with `%`** — `['name', 'ilike', '%acme%']` becomes `ILIKE '%%acme%%'` (double-wrapped, wrong). Just pass `'acme'`.

```typescript testable id="domain-ilike" needs="client" creates="res.partner" expect="result.found === true"
const id = await client.create('res.partner', {
  name: uniqueTestName('Software Solutions Inc'),
  email: 'contact@example.com',
});
trackRecord('res.partner', id);

const results = await client.search('res.partner', [['name', 'ilike', 'software']]);

return { found: results.includes(id) };
```

## Logical Operators (Prefix Notation)

Conditions are **AND** by default. Use prefix operators for OR/NOT:

| Operator | Arity | Example |
|----------|-------|---------|
| `'&'` | 2 | Default — implicit between consecutive criteria |
| `'\|'` | 2 | `['\|', ['state', '=', 'draft'], ['state', '=', 'sent']]` |
| `'!'` | 1 | `['!', ['active', '=', false]]` |

```typescript testable id="domain-or" needs="client" creates="res.partner" expect="result.found >= 2"
const id1 = await client.create('res.partner', {
  name: uniqueTestName('Company A'),
  is_company: true,
});
trackRecord('res.partner', id1);

const id2 = await client.create('res.partner', {
  name: uniqueTestName('Contact B'),
  is_company: false,
  email: 'test@example.com',
});
trackRecord('res.partner', id2);

const results = await client.search('res.partner', [
  '|',
  ['id', '=', id1],
  ['id', '=', id2],
]);

return { found: results.filter(id => id === id1 || id === id2).length };
```

### Complex Combinations

```typescript
// (A OR B) AND C
['&', '|', ['state', '=', 'draft'], ['state', '=', 'sent'], ['amount', '>', 1000]]

// Chained OR (3+ conditions) — nest '|' operators
['|', '|', ['state', '=', 'draft'], ['state', '=', 'sent'], ['state', '=', 'sale']]
// TIP: For many-OR on same field, prefer 'in':
[['state', 'in', ['draft', 'sent', 'sale']]]
```

## Special Values

```typescript testable id="domain-false-check" needs="client" creates="res.partner" expect="result.withEmail === true && result.withoutEmail === true"
const id1 = await client.create('res.partner', {
  name: uniqueTestName('Partner With Email'),
  email: 'has.email@example.com',
});
trackRecord('res.partner', id1);

const id2 = await client.create('res.partner', {
  name: uniqueTestName('Partner Without Email'),
  email: false,
});
trackRecord('res.partner', id2);

// Field is set — use JSON false, not Python False
const withEmailResults = await client.search('res.partner', [
  ['id', 'in', [id1, id2]],
  ['email', '!=', false]
]);

const withoutEmailResults = await client.search('res.partner', [
  ['id', 'in', [id1, id2]],
  ['email', '=', false]
]);

return {
  withEmail: withEmailResults.includes(id1) && !withEmailResults.includes(id2),
  withoutEmail: withoutEmailResults.includes(id2) && !withoutEmailResults.includes(id1)
};
```

Dates as strings: `['date', '>=', '2024-01-01']`. Datetimes in UTC: `['write_date', '>=', '2024-01-01 00:00:00']`.

## Relational Traversal (Dot Notation)

```typescript
// Many2one: traverse to related record's field (can chain)
[['country_id.code', '=', 'ES']]
[['partner_id.category_id', 'in', [11]]]
[['account_id.code', '=like', '57%']]

// One2many/Many2many: matches if ANY related record satisfies
[['child_ids', '!=', false]]          // Has at least one child
[['group_ids', 'in', [groupId]]]      // User is in group
```

```typescript testable id="domain-has-relation" needs="client" creates="res.partner" expect="result.withParent === true && result.withoutParent === true"
const parentId = await client.create('res.partner', {
  name: uniqueTestName('Parent Company'),
  is_company: true,
});
trackRecord('res.partner', parentId);

const childId = await client.create('res.partner', {
  name: uniqueTestName('Child Contact'),
  parent_id: parentId,
});
trackRecord('res.partner', childId);

const standaloneId = await client.create('res.partner', {
  name: uniqueTestName('Standalone Contact'),
});
trackRecord('res.partner', standaloneId);

const hasParent = await client.search('res.partner', [
  ['id', 'in', [childId, standaloneId]],
  ['parent_id', '!=', false]
]);

const noParent = await client.search('res.partner', [
  ['id', 'in', [childId, standaloneId]],
  ['parent_id', '=', false]
]);

return {
  withParent: hasParent.includes(childId) && !hasParent.includes(standaloneId),
  withoutParent: noParent.includes(standaloneId) && !noParent.includes(childId)
};
```

## Archived Records

Odoo filters `active=True` by default. To include archived records:

```typescript
const all = await client.searchRead('res.partner',
  [['name', 'ilike', 'test']],
  { fields: ['name', 'active'], context: { active_test: false } }
);
```

## API Methods That Accept Domains

| Method | Returns | Default Limit |
|--------|---------|---------------|
| `search` | `number[]` (IDs) | None (all) |
| `searchRead` | `object[]` | **100** ⚠️ |
| `searchCount` | `number` | N/A |

**⚠️ `searchRead` defaults to limit=100.** Always pass explicit `limit`.

```typescript testable id="domain-search" needs="client" creates="res.partner" expect="result.found === true"
const id = await client.create('res.partner', {
  name: uniqueTestName('Test Company USA'),
  is_company: true,
});
trackRecord('res.partner', id);

const ids = await client.search('res.partner', [
  ['is_company', '=', true],
  ['id', '=', id],
]);

return { found: ids.includes(id) };
```

```typescript testable id="domain-searchread" needs="client" creates="res.partner" expect="result.hasFields === true"
const id = await client.create('res.partner', {
  name: uniqueTestName('Search Read Test'),
  email: 'searchread@example.com',
  is_company: true,
});
trackRecord('res.partner', id);

const partners = await client.searchRead(
  'res.partner',
  [['id', '=', id]],
  { fields: ['name', 'email'], limit: 10 }
);

const partner = partners[0];
return { hasFields: !!partner.name && !!partner.email };
```

## JSON-RPC Gotchas

- **Nesting depth**: domain is a list of tuples, not triple-nested: `[[["state","=","sale"]]]` not `[[[["state","=","sale"]]]]`
- **Booleans**: JSON `false`/`true`, not Python `False`/`True`
- **Dates**: strings only (`"2025-01-01"`)
- **No Python expressions**: `user.id`, `context_today()`, `ref('xml_id')` don't work via RPC — compute values client-side
