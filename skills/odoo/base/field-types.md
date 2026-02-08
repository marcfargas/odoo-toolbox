# Odoo Field Types

Understanding Odoo field types and their read/write behaviors.

## Overview

Odoo has various field types, each with specific behaviors when reading and writing data. Understanding these is critical for correct data manipulation.

## Basic Field Types

| Type | Description | Python Type | Example |
|------|-------------|-------------|---------|
| `char` | Short string | `str` | `'John Doe'` |
| `text` | Long text | `str` | `'Long description...'` |
| `integer` | Whole number | `int` | `42` |
| `float` | Decimal number | `float` | `99.99` |
| `boolean` | True/False | `bool` | `true` |
| `date` | Date only | `str` (YYYY-MM-DD) | `'2024-01-15'` |
| `datetime` | Date and time | `str` (ISO 8601) | `'2024-01-15 14:30:00'` |
| `binary` | Binary data | `str` (base64) | `'SGVsbG8='` |
| `html` | HTML content | `str` | `'<p>Hello</p>'` |

### Usage Example

```typescript testable id="field-types-basic" needs="client" creates="res.partner" expect="id > 0"
const id = await client.create('res.partner', {
  name: uniqueTestName('John Doe'),  // char
  comment: 'Important note',         // text
  color: 5,                          // integer
  is_company: false,                 // boolean
});
trackRecord('res.partner', id);
return id;
```

## Selection Fields

Selection fields have predefined options. When introspecting, you can get the available options.

```typescript testable id="field-types-selection" needs="client,introspector" creates="res.partner" expect="result.typeChanged === true"
// Create a partner to test selection field
const id = await client.create('res.partner', {
  name: uniqueTestName('Selection Test'),
  type: 'contact',
});
trackRecord('res.partner', id);

// Reading selection field (read returns array)
const [partner] = await client.read('res.partner', [id], ['type']);
// partner.type = 'contact' (string value)

// Writing selection field
await client.write('res.partner', id, { type: 'invoice' });

// Verify the change
const [updated] = await client.read('res.partner', [id], ['type']);

// Getting available options via introspection
const fields = await introspector.getFields('res.partner');
const typeField = fields.find(f => f.name === 'type');
// typeField.selection = [['contact', 'Contact'], ['invoice', 'Invoice Address'], ...]

return { typeChanged: updated.type !== partner.type, hasSelection: !!typeField?.selection };
```

## Relational Fields

### Many2One (Single Reference)

**CRITICAL: Read/Write Asymmetry**

| Operation | Format |
|-----------|--------|
| **Write** | Pass just the ID: `42` |
| **Read** | Returns tuple: `[42, 'Display Name']` |

```typescript testable id="field-types-many2one" needs="client" creates="res.partner" expect="result.parentId !== null && result.parentName !== null"
// Create parent partner first
const parentId = await client.create('res.partner', {
  name: uniqueTestName('Parent Company'),
  is_company: true,
});
trackRecord('res.partner', parentId);

// WRITING: Pass just the ID for Many2One
const childId = await client.create('res.partner', {
  name: uniqueTestName('Child Contact'),
  parent_id: parentId,  // Just the ID
});
trackRecord('res.partner', childId);

// READING: Returns [id, display_name] (read returns array)
const [child] = await client.read('res.partner', [childId], ['parent_id']);
// child.parent_id = [parentId, 'Parent Company']

// Extracting values
const extractedParentId = child.parent_id ? child.parent_id[0] : null;
const extractedParentName = child.parent_id ? child.parent_id[1] : null;

return { parentId: extractedParentId, parentName: extractedParentName };
```

### One2Many (List of Related Records)

One2Many fields reference records that point back to this record.

```typescript testable id="field-types-one2many" needs="client" creates="res.partner" expect="result.childCount >= 1"
// Create parent partner
const parentId = await client.create('res.partner', {
  name: uniqueTestName('Parent For O2M'),
  is_company: true,
});
trackRecord('res.partner', parentId);

// Writing: Use special commands to create child via One2Many
await client.write('res.partner', parentId, {
  child_ids: [
    [0, 0, { name: uniqueTestName('Child Created via O2M') }],  // Create new record
  ]
});

// Reading: Returns array of IDs (read returns array)
const [partner] = await client.read('res.partner', [parentId], ['child_ids']);
// partner.child_ids = [childId1, childId2, ...]

// Track created children for cleanup
const childIds = partner.child_ids || [];
for (const childId of childIds) {
  trackRecord('res.partner', childId);
}

return { childCount: childIds.length };
```

### Many2Many (Multiple References)

Many2Many fields can reference multiple records in both directions.

```typescript testable id="field-types-many2many" needs="client" creates="res.partner" expect="result.categoryCount >= 1"
// First, find or create a partner category
const categories = await client.search('res.partner.category', [], { limit: 1 });
let categoryId;
if (categories.length > 0) {
  categoryId = categories[0];
} else {
  categoryId = await client.create('res.partner.category', { name: uniqueTestName('Test Category') });
  trackRecord('res.partner.category', categoryId);
}

// Create partner with Many2Many categories
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Partner With Categories'),
  category_id: [[6, 0, [categoryId]]],  // Replace all with these IDs
});
trackRecord('res.partner', partnerId);

// Reading: Returns array of IDs (read returns array)
const [partner] = await client.read('res.partner', [partnerId], ['category_id']);
// partner.category_id = [categoryId1, categoryId2, ...]

const categoryIds = partner.category_id || [];
return { categoryCount: categoryIds.length };
```

### X2Many Commands Reference

| Command | Format | Description |
|---------|--------|-------------|
| `[0, 0, values]` | Create | Create new record with values |
| `[1, id, values]` | Update | Update existing record |
| `[2, id, 0]` | Delete | Delete record |
| `[3, id, 0]` | Unlink | Remove from relation (no delete) |
| `[4, id, 0]` | Link | Add existing record to relation |
| `[5, 0, 0]` | Unlink All | Remove all records from relation |
| `[6, 0, ids]` | Replace | Replace all with given IDs |

## Properties Fields

Properties are dynamic, user-defined fields. See [properties.md](./properties.md) for full documentation.

**Key Points:**
- Defined at parent level (e.g., `crm.team` for `crm.lead`)
- Read format differs from write format
- Write replaces ALL property values

```typescript
// Read format: Array of objects
[
  { name: 'priority', type: 'selection', string: 'Priority', value: 'high' },
  { name: 'score', type: 'integer', string: 'Score', value: 85 }
]

// Write format: Simple key-value object
{ priority: 'high', score: 85 }
```

## Computed Fields

Some fields are computed (calculated) and cannot be written directly.

```typescript testable id="field-types-computed" needs="introspector" expect="result.hasDisplayName === true"
// Check if a field is readonly/computed
const fields = await introspector.getFields('res.partner');
const computedFields = fields.filter(f => f.readonly);

// display_name is a common computed field
const displayNameField = computedFields.find(f => f.name === 'display_name');

return { hasDisplayName: !!displayNameField, computedCount: computedFields.length };
```

Common computed fields:
- `display_name` - Computed from `name` and other fields
- `*_count` fields - Count of related records
- `*_total` fields - Sum of related values

## Date/Time Handling

```typescript testable id="field-types-datetime" needs="client" creates="res.partner" expect="result.hasCreateDate === true"
// create_date is automatically set when a record is created
const id = await client.create('res.partner', {
  name: uniqueTestName('Date Test Partner'),
});
trackRecord('res.partner', id);

// Read back create_date (automatic datetime field)
const [partner] = await client.read('res.partner', [id], ['create_date']);

// create_date should be a datetime string like '2024-01-15 14:30:00'
return { hasCreateDate: !!partner.create_date };
```

**Timezone Note**: Odoo stores datetimes in UTC. The client may need to handle timezone conversion.

## Monetary Fields

Monetary fields often have an associated currency field.

```typescript
await client.create('sale.order.line', {
  price_unit: 99.99,
  currency_id: 1,  // Reference to res.currency
});
```

## Field Attributes

When introspecting fields, these attributes are important:

| Attribute | Description |
|-----------|-------------|
| `required` | Must have a value |
| `readonly` | Cannot be written (computed) |
| `store` | Stored in database (vs computed on-the-fly) |
| `relation` | For relational fields, the target model |
| `selection` | For selection fields, available options |

## Related Documents

- [domains.md](./domains.md) - Filtering with domains
- [properties.md](./properties.md) - Properties fields in detail
- [crud.md](./crud.md) - CRUD patterns
