# Odoo Domain Filters

How to filter records using Odoo's domain syntax.

## Overview

Domains are Odoo's query language for filtering records. They are arrays of conditions (tuples) combined with logical operators.

## Basic Syntax

A domain is an array of conditions:

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
| `like` | Pattern match (case-sensitive) | `['name', 'like', 'John%']` |
| `ilike` | Pattern match (case-insensitive) | `['name', 'ilike', '%smith%']` |
| `=like` | Exact pattern (case-sensitive) | `['code', '=like', 'AB%']` |
| `=ilike` | Exact pattern (case-insensitive) | `['code', '=ilike', 'ab%']` |
| `in` | Value in list | `['state', 'in', ['draft', 'sent']]` |
| `not in` | Value not in list | `['state', 'not in', ['cancel', 'done']]` |

## Pattern Matching

Use `%` as wildcard in `like`/`ilike`:

```typescript testable id="domain-ilike" needs="client" creates="res.partner" expect="result.found === true"
// Create test data
const id = await client.create('res.partner', {
  name: uniqueTestName('Software Solutions Inc'),
  email: 'contact@example.com',
});
trackRecord('res.partner', id);

// Contains "software" anywhere (case-insensitive)
const results = await client.search('res.partner', [['name', 'ilike', '%software%']]);

return { found: results.includes(id) };
```

## Logical Operators

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

| Operator | Description |
|----------|-------------|
| `&` | AND (default, explicit) |
| `\|` | OR |
| `!` | NOT |

### AND Examples

```typescript
// Explicit AND (same as default)
['&', ['state', '=', 'draft'], ['partner_id', '!=', false]]
```

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

// OR: is_company=true OR has email
const results = await client.search('res.partner', [
  '|',
  ['id', '=', id1],  // First partner
  ['id', '=', id2],  // OR second partner
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
[
  '&',
  '|',
  ['state', '=', 'draft'],
  ['state', '=', 'sent'],
  ['amount', '>', 1000]
]

// (A AND B) OR (C AND D)
[
  '|',
  '&', ['field_a', '=', 'A'], ['field_b', '=', 'B'],
  '&', ['field_c', '=', 'C'], ['field_d', '=', 'D']
]
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

// Field is set (not empty)
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
// Records from today
[['date', '=', '2024-01-15']]

// Records in date range
[
  ['date', '>=', '2024-01-01'],
  ['date', '<=', '2024-01-31']
]
```

## Relational Field Domains

### Many2One Traversal

You can traverse relations using dot notation:

```typescript
// Leads where partner is a company
[['partner_id.is_company', '=', true]]

// Leads where partner's country is US
[['partner_id.country_id.code', '=', 'US']]
```

### Many2Many/One2Many

```typescript
// Users in specific group
[['group_ids', 'in', [groupId]]]

// Partners with at least one invoice
[['invoice_ids', '!=', false]]
```

## Common Domain Patterns

### Active Records Only

```typescript
[['active', '=', true]]
// Or simply omit - Odoo includes active=True by default
```

### Records with Related Data

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

### Status-Based Filtering

```typescript
// Open opportunities
[['type', '=', 'opportunity'], ['probability', '>', 0]]

// Draft quotes
[['state', '=', 'draft']]

// Confirmed orders
[['state', 'in', ['sale', 'done']]]
```

### Date Range

```typescript
// This month's records
const now = new Date();
const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

const domain = [
  ['create_date', '>=', firstDay.toISOString().split('T')[0]],
  ['create_date', '<=', lastDay.toISOString().split('T')[0]]
];
```

### Text Search

```typescript
// Search by name or email
[
  '|',
  ['name', 'ilike', searchTerm],
  ['email', 'ilike', searchTerm]
]
```

## Usage in API Calls

### search()

```typescript testable id="domain-search" needs="client" creates="res.partner" expect="result.found === true"
// Create test company
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
// Create test partner
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

## Empty Domain

An empty domain `[]` returns all records (subject to access rights):

```typescript
// Get all partners
const allPartners = await client.search('res.partner', []);
```

## Debugging Domains

If a domain isn't working as expected:

1. **Start simple** - Test with one condition at a time
2. **Check field names** - Use introspection to verify
3. **Check types** - Ensure values match field types
4. **Test in Odoo UI** - Developer mode shows domain filters

## Related Documents

- [field-types.md](./field-types.md) - Understanding field types
- [search-patterns.md](../04-patterns/search-patterns.md) - Search patterns
