# Odoo Domain Filters

How to filter records using Odoo's domain syntax.

## Overview

Domains are Odoo's query language for filtering records. They are arrays of conditions (tuples) combined with logical operators. An empty domain `[]` matches all records.

## Basic Syntax

```typescript
const domain = [
  ['field_name', 'operator', value]
];
```

## Comparison Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `=` | Equals | `['state', '=', 'draft']` |
| `!=` | Not equals | `['state', '!=', 'cancel']` |
| `>` | Greater than | `['amount', '>', 1000]` |
| `>=` | Greater or equal | `['amount', '>=', 1000]` |
| `<` | Less than | `['amount', '<', 100]` |
| `<=` | Less or equal | `['amount', '<=', 100]` |
| `=?` | Unset or equals | Returns true if value is null/false; otherwise behaves like `=`. Useful for optional filters. |
| `like` | Pattern match (case-sensitive) | You provide wildcards: `_` = any char, `%` = any string |
| `not like` | Negated pattern (case-sensitive) | |
| `ilike` | Pattern match (case-insensitive) | Auto-wraps value with `%`: `'ilike', 'john'` → `ILIKE '%john%'` |
| `not ilike` | Negated pattern (case-insensitive) | |
| `=like` | Exact pattern (case-sensitive) | No auto-wrapping, you supply wildcards: `['code', '=like', 'SO%']` |
| `=ilike` | Exact pattern (case-insensitive) | Same as `=like` but case-insensitive |
| `in` | Value in list | `['state', 'in', ['draft', 'sent']]` |
| `not in` | Value not in list | `['state', 'not in', ['cancel', 'done']]` |
| `child_of` | Descendant of record(s) | `['category_id', 'child_of', parentId]` (hierarchical models) |
| `parent_of` | Ancestor of record(s) | `['category_id', 'parent_of', childId]` |

### Pattern Matching: Key Distinction

- `like` / `not like` → you must supply your own `%` wildcards
- `ilike` / `not ilike` → Odoo auto-wraps with `%` on both sides
- `=like` / `=ilike` → exact pattern match, no auto-wrapping, but you can use `%` and `_`

```typescript testable id="domain-ilike" needs="client" creates="res.partner" expect="result.found === true"
// Create test data
const id = await client.create('res.partner', {
  name: uniqueTestName('Software Solutions Inc'),
  email: 'contact@example.com',
});
trackRecord('res.partner', id);

// ilike auto-wraps with % — just pass the search term
const results = await client.search('res.partner', [['name', 'ilike', 'software']]);

return { found: results.includes(id) };
```

## Logical Operators (Prefix/Polish Notation)

Default behavior: **AND** between conditions.

```typescript
// All conditions must match (implicit AND)
const domain = [
  ['state', '=', 'open'],
  ['amount', '>', 1000]
];
// Equivalent to: state = 'open' AND amount > 1000
```

### Explicit Operators

| Operator | Meaning | Arity |
|----------|---------|-------|
| `'&'` | AND | 2 (next 2 items). **Default** — implicit between consecutive criteria |
| `'\|'` | OR | 2 (next 2 items) |
| `'!'` | NOT | 1 (next 1 item) |

### OR Examples

```typescript testable id="domain-or" needs="client" creates="res.partner" expect="result.found >= 2"
// Create test data
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

// OR: match either partner
const results = await client.search('res.partner', [
  '|',
  ['id', '=', id1],
  ['id', '=', id2],
]);

return { found: results.filter(id => id === id1 || id === id2).length };
```

### NOT Examples

```typescript
// NOT archived
['!', ['active', '=', false]]

// NOT in these states
['!', ['state', 'in', ['cancel', 'done']]]
```

### Complex Combinations

```typescript
// (state = 'draft' OR state = 'sent') AND amount > 1000
['&', '|', ['state', '=', 'draft'], ['state', '=', 'sent'], ['amount', '>', 1000]]

// (A AND B) OR (C AND D)
['|', '&', ['field_a', '=', 'A'], ['field_b', '=', 'B'], '&', ['field_c', '=', 'C'], ['field_d', '=', 'D']]

// Chained OR (3+ conditions)
['|', '|', ['state', '=', 'draft'], ['state', '=', 'sent'], ['state', '=', 'sale']]
// TIP: For many-OR on same field, use 'in' instead:
[['state', 'in', ['draft', 'sent', 'sale']]]
```

### Conversion Method (Infix → Prefix)

1. Start with the outermost operator, move it to front
2. Repeat for sub-expressions
3. Remove parentheses

```
Infix:   (state = 'draft' OR amount > 1000) AND partner = 5
Step 1:  AND (state = 'draft' OR amount > 1000) (partner = 5)
Step 2:  AND OR (state = 'draft') (amount > 1000) (partner = 5)
Result:  ['&', '|', ['state','=','draft'], ['amount_total','>',1000], ['partner_id','=',5]]
```

## Special Values

### False/Null Checking

```typescript testable id="domain-false-check" needs="client" creates="res.partner" expect="result.withEmail === true && result.withoutEmail === true"
// Create partner WITH email
const id1 = await client.create('res.partner', {
  name: uniqueTestName('Partner With Email'),
  email: 'has.email@example.com',
});
trackRecord('res.partner', id1);

// Create partner WITHOUT email
const id2 = await client.create('res.partner', {
  name: uniqueTestName('Partner Without Email'),
  email: false,
});
trackRecord('res.partner', id2);

// Field is set (not empty) — use JSON false, not Python False
const withEmailResults = await client.search('res.partner', [
  ['id', 'in', [id1, id2]],
  ['email', '!=', false]
]);

// Field is empty
const withoutEmailResults = await client.search('res.partner', [
  ['id', 'in', [id1, id2]],
  ['email', '=', false]
]);

return {
  withEmail: withEmailResults.includes(id1) && !withEmailResults.includes(id2),
  withoutEmail: withoutEmailResults.includes(id2) && !withoutEmailResults.includes(id1)
};
```

### Date Comparisons

```typescript
// Records in date range — dates as strings
[['date', '>=', '2024-01-01'], ['date', '<=', '2024-12-31']]

// Datetime fields use full format (UTC)
[['write_date', '>=', '2024-01-01 00:00:00']]
```

## Relational Field Domains

### Many2One Traversal (Dot Notation)

Traverse relations using dot notation. Can chain multiple levels:

```typescript
// Partners where country is Spain
[['country_id.code', '=', 'ES']]

// Invoice lines where partner has a specific tag
[['partner_id.category_id', 'in', [11]]]

// Account moves where account code starts with 57
[['account_id.code', '=like', '57%']]
```

| Relation Type | Behavior |
|---------------|----------|
| Many2one | Traverses to related record's field. Can chain multiple levels. |
| One2many | Matches parent if *any* child matches. |
| Many2many | Matches if *any* related record satisfies condition. |

### Many2Many/One2Many

```typescript
// Users in specific group
[['group_ids', 'in', [groupId]]]

// Partners with at least one child contact
[['child_ids', '!=', false]]
```

## Common Patterns

### Active Records

```typescript
// Odoo filters active=True by default
// To include archived records, use context:
const results = await client.searchRead('res.partner',
  [['name', 'ilike', 'test']],
  { fields: ['name', 'active'], context: { active_test: false } }
);
```

### Related Records

```typescript testable id="domain-has-relation" needs="client" creates="res.partner" expect="result.withParent === true && result.withoutParent === true"
// Create parent partner
const parentId = await client.create('res.partner', {
  name: uniqueTestName('Parent Company'),
  is_company: true,
});
trackRecord('res.partner', parentId);

// Create child with parent
const childId = await client.create('res.partner', {
  name: uniqueTestName('Child Contact'),
  parent_id: parentId,
});
trackRecord('res.partner', childId);

// Create standalone partner
const standaloneId = await client.create('res.partner', {
  name: uniqueTestName('Standalone Contact'),
});
trackRecord('res.partner', standaloneId);

// Has a parent
const hasParent = await client.search('res.partner', [
  ['id', 'in', [childId, standaloneId]],
  ['parent_id', '!=', false]
]);

// No parent
const noParent = await client.search('res.partner', [
  ['id', 'in', [childId, standaloneId]],
  ['parent_id', '=', false]
]);

return {
  withParent: hasParent.includes(childId) && !hasParent.includes(standaloneId),
  withoutParent: noParent.includes(standaloneId) && !noParent.includes(childId)
};
```

### Text Search Across Fields

```typescript
// Search by name or email
['|', ['name', 'ilike', searchTerm], ['email', 'ilike', searchTerm]]
```

## Usage in API Calls

### Methods That Accept Domains

| Method | Returns | Default Limit | Notes |
|--------|---------|--------------|-------|
| `search` | `number[]` (IDs) | None (all) | Pass `limit`/`offset` for pagination |
| `searchRead` | `object[]` (records) | **100** ⚠️ | **Always pass `limit` explicitly** |
| `searchCount` | `number` | N/A | Just the count, very efficient |
| `name_search` | `[id, name][]` | N/A | Used for autocomplete |
| `read_group` | Grouped aggregates | N/A | For pivot/aggregate queries |

> **⚠️ CRITICAL**: `searchRead` defaults to limit=100. If you expect more records, always pass `limit: 0` (all) or a specific number. `search` has no default limit.

### search()

```typescript testable id="domain-search" needs="client" creates="res.partner" expect="result.found === true"
const id = await client.create('res.partner', {
  name: uniqueTestName('Test Company USA'),
  is_company: true,
});
trackRecord('res.partner', id);

// search() returns array of IDs
const ids = await client.search('res.partner', [
  ['is_company', '=', true],
  ['id', '=', id],
]);

return { found: ids.includes(id) };
```

### searchRead()

```typescript testable id="domain-searchread" needs="client" creates="res.partner" expect="result.hasFields === true"
const id = await client.create('res.partner', {
  name: uniqueTestName('Search Read Test'),
  email: 'searchread@example.com',
  is_company: true,
});
trackRecord('res.partner', id);

// searchRead() returns records with specified fields
const partners = await client.searchRead(
  'res.partner',
  [['id', '=', id]],
  { fields: ['name', 'email'], limit: 10 }
);

const partner = partners[0];
return { hasFields: !!partner.name && !!partner.email };
```

### searchCount()

```typescript
const count = await client.searchCount('res.partner', [
  ['is_company', '=', true]
]);
```

## JSON-RPC Gotchas

When calling Odoo over JSON-RPC (which `@marcfargas/odoo-client` does), beware:

**Nesting depth** — don't over-wrap domains:
```javascript
// WRONG — triple-nested
"args": [..., "search_read", [[[["state", "=", "sale"]]]], ...]

// CORRECT — domain is a list of lists
"args": [..., "search_read", [[["state", "=", "sale"]]], ...]
```

**Boolean values**: Use JSON `false`/`true`, not Python `False`/`True`.

**Dates must be strings**: `"2025-01-01"` for Date, `"2025-01-01 00:00:00"` for Datetime (UTC).

**No Python expressions**: `user.id`, `context_today()`, `ref('xml_id')` don't work over RPC. Compute values client-side and pass literal data.

## Quick Reference

```
SYNTAX:      [['field', 'operator', value]]
LOGIC:       '&' (AND, default), '|' (OR), '!' (NOT)  — PREFIX notation
TRAVERSAL:   'partner_id.country_id.code'  (dot notation through Many2one)
HIERARCHY:   'child_of', 'parent_of'  (tree structures)

OPERATORS:   =  !=  >  >=  <  <=  =?
             in  not in
             like  not like  ilike  not ilike  =like  =ilike
             child_of  parent_of

IMPLICIT AND:  [A, B, C]           → A AND B AND C
OR:            ['|', A, B]         → A OR B
NOT:           ['!', A]            → NOT A
COMPLEX:       ['&', '|', A, B, C] → (A OR B) AND C
CHAINED OR:    ['|', '|', A, B, C] → A OR B OR C

JSON-RPC:    searchRead default limit = 100 — always pass limit!
             Dates as strings, booleans as false/true (JSON)
             No Python expressions — pure data only
```

## Related Documents

- [field-types.md](./field-types.md) - Understanding field types
- [search.md](./search.md) - Search and filtering patterns
- [crud.md](./crud.md) - Create, Read, Update, Delete operations
