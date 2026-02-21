# Domains — Advanced Filter Composition

Domains are Odoo's query filter syntax: arrays of condition tuples combined with prefix logical operators. An empty domain `[]` matches all records.

## Operator Reference

| Operator | Example | Notes |
|----------|---------|-------|
| `=`, `!=` | `['state', '=', 'draft']` | |
| `>`, `>=`, `<`, `<=` | `['amount', '>', 1000]` | Numeric and date comparisons |
| `=?` | `['team_id', '=?', teamId]` | True when value is `null`/`false`; acts as `=` otherwise |
| `in` | `['state', 'in', ['draft', 'sent']]` | Match any value in list |
| `not in` | `['state', 'not in', ['cancel']]` | Exclude values |
| `like` | `['code', 'like', 'SO%']` | Case-sensitive, **you supply wildcards** |
| `ilike` | `['name', 'ilike', 'john']` | Case-insensitive, **auto-wraps with `%`** |
| `=like` | `['code', '=like', 'SO%']` | Exact pattern, case-sensitive, no auto-wrap |
| `=ilike` | `['code', '=ilike', 'so%']` | Exact pattern, case-insensitive |
| `child_of` | `['category_id', 'child_of', parentId]` | Hierarchical: matches node and all descendants |
| `parent_of` | `['category_id', 'parent_of', childId]` | Hierarchical: matches node and all ancestors |

### ⚠️ `ilike` auto-wraps with `%`

`['name', 'ilike', 'acme']` → `WHERE name ILIKE '%acme%'`

Passing `'%acme%'` double-wraps: `WHERE name ILIKE '%%acme%%'` (matches nothing).

```typescript testable id="domain-ilike-correct" needs="client" creates="res.partner" expect="result.found === true"
const id = await client.create('res.partner', { name: 'Acme Software Solutions' });

// ✅ Correct — just pass the search term
const results = await client.search('res.partner', [['name', 'ilike', 'acme']]);

// ❌ Wrong — double-wraps the % characters
// const results = await client.search('res.partner', [['name', 'ilike', '%acme%']]);

return { found: results.includes(id) };
```

## Logical Operators

By default, consecutive criteria are implicitly **AND**ed. Use prefix operators for OR/NOT.

| Operator | Applies to | Notation |
|----------|-----------|---------|
| `'&'` | 2 conditions | AND (implicit default) |
| `'|'` | 2 conditions | OR |
| `'!'` | 1 condition | NOT |

```typescript testable id="domain-or" needs="client" creates="res.partner" expect="result.found === 2"
const id1 = await client.create('res.partner', { name: 'Partner One', is_company: true });
const id2 = await client.create('res.partner', { name: 'Partner Two', is_company: false });

const results = await client.search('res.partner', [
  '|',
  ['id', '=', id1],
  ['id', '=', id2],
]);

return { found: results.filter(id => [id1, id2].includes(id)).length };
```

```typescript testable id="domain-not" needs="client" creates="res.partner" expect="result.found === true"
const id = await client.create('res.partner', { name: 'Active Partner', active: true });

// NOT active=false means active must be true
const results = await client.search('res.partner', [
  ['id', '=', id],
  ['!', ['active', '=', false]],
]);

return { found: results.includes(id) };
```

## Complex Combinations

Domains use **Polish prefix notation** — operators precede their operands:

```typescript
// (A AND B) — implicit, no operator needed
[['state', '=', 'draft'], ['amount', '>', 1000]]

// (A OR B)
['|', ['state', '=', 'draft'], ['state', '=', 'sent']]

// ((A OR B) AND C)
['&', '|', ['state', '=', 'draft'], ['state', '=', 'sent'], ['amount', '>', 1000]]

// (A OR B OR C) — chain '|' operators
['|', '|', ['state', '=', 'draft'], ['state', '=', 'sent'], ['state', '=', 'sale']]
```

**Tip:** For many OR conditions on the same field, use `in` instead:

```typescript
// Cleaner than ['|', '|', ...]
[['state', 'in', ['draft', 'sent', 'sale']]]
```

```typescript testable id="domain-complex" needs="client" creates="res.partner" expect="result.count >= 1"
const id1 = await client.create('res.partner', { name: 'Company Alpha', is_company: true });
const id2 = await client.create('res.partner', { name: 'Person Beta', is_company: false });

// Find records where: (is_company=true OR id=id2) AND id IN [id1, id2]
const results = await client.search('res.partner', [
  '&',
  '|',
  ['is_company', '=', true],
  ['id', '=', id2],
  ['id', 'in', [id1, id2]],
]);

return { count: results.filter(id => [id1, id2].includes(id)).length };
```

## Special Values

**Odoo uses `false` (not `null`) for unset fields.**

```typescript testable id="domain-false" needs="client" creates="res.partner" expect="result.withEmail === true && result.withoutEmail === true"
const id1 = await client.create('res.partner', { name: 'Has Email', email: 'x@example.com' });
const id2 = await client.create('res.partner', { name: 'No Email' });

const withEmail = await client.search('res.partner', [
  ['id', 'in', [id1, id2]],
  ['email', '!=', false],   // Field is set
]);

const withoutEmail = await client.search('res.partner', [
  ['id', 'in', [id1, id2]],
  ['email', '=', false],    // Field is unset
]);

return {
  withEmail: withEmail.includes(id1) && !withEmail.includes(id2),
  withoutEmail: withoutEmail.includes(id2) && !withoutEmail.includes(id1),
};
```

## Date Domains

Dates use `YYYY-MM-DD` strings; datetimes use `YYYY-MM-DD HH:MM:SS` UTC:

```typescript testable id="domain-dates" needs="client" creates="res.partner" expect="result.count >= 0"
const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'

const weekAgo = new Date();
weekAgo.setDate(weekAgo.getDate() - 7);
const weekAgoStr = weekAgo.toISOString().split('T')[0];

// Records created in the last 7 days
const recent = await client.searchRead('res.partner', [
  ['create_date', '>=', weekAgoStr],
  ['create_date', '<=', today],
], {
  fields: ['name', 'create_date'],
  limit: 100,
});

return { count: recent.length };
```

No relative date expressions in RPC domains — compute values client-side first.

## Dot Notation (Relational Traversal)

Navigate related record fields directly in a domain:

```typescript testable id="domain-dot-notation" needs="client" creates="res.partner" expect="result.count >= 0"
// Partners in a specific country via traversal
const results = await client.searchRead('res.partner', [
  ['country_id.code', '=', 'ES'],
], {
  fields: ['name', 'country_id'],
  limit: 10,
});

return { count: results.length };
```

```typescript
// Many2one traversal: one level deep
[['country_id.code', '=', 'ES']]

// Multi-level traversal
[['partner_id.country_id.code', '=', 'FR']]

// Account code prefix (accounting queries)
[['account_id.code', '=like', '57%']]

// User membership in a group
[['group_ids', 'in', [groupId]]]
```

One2many/Many2many dot notation: matches if **ANY** related record satisfies the condition.

## Archived Records

By default, Odoo hides archived records (`active=False`). To include them:

```typescript testable id="domain-archived" needs="client" creates="res.partner" expect="result.foundAll === true"
const id = await client.create('res.partner', { name: 'To Archive', active: true });
await client.write('res.partner', id, { active: false }); // archive

// Default: won't find archived record
const defaultResults = await client.search('res.partner', [['id', '=', id]]);

// With active_test: false context — includes archived
const allResults = await client.search('res.partner', [['id', '=', id]], {
  context: { active_test: false },
});

return {
  foundWithDefault: defaultResults.length,
  foundAll: allResults.includes(id),
};
```

## JSON-RPC Gotchas

| Gotcha | Wrong | Correct |
|--------|-------|---------|
| Booleans | Python `True`/`False` | JSON `true`/`false` |
| Dates | JS `Date` objects | `"2025-01-01"` strings |
| Double-nesting | `[[[['state','=','sale']]]]` | `[['state', '=', 'sale']]` |
| Null check | `['field', '=', null]` | `['field', '=', false]` |
| ilike wildcards | `['name', 'ilike', '%john%']` | `['name', 'ilike', 'john']` |
| Python expressions | `['date', '>=', "context_today()"]` | Compute in JS, pass string |

## Methods That Accept Domains

| Method | Returns | Default Limit |
|--------|---------|---------------|
| `search()` | `number[]` | None (all) |
| `searchRead()` | `object[]` | **100** ⚠️ |
| `searchCount()` | `number` | N/A |

> **`searchRead` defaults to limit=100.** Always pass explicit `limit`.

---

See also:
- [Search](../client/search.md) — `searchRead`, `search`, `searchCount` usage
- [Accounting](../services/accounting.md) — domain patterns for financial queries

For agent-optimized CLI examples, see the [odoo skill](../skills/odoo/).
