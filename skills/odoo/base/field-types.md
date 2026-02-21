# Odoo Field Types

## Basic Types

| Type | JSON Value | Notes |
|------|-----------|-------|
| `char` | `'John Doe'` | Short string |
| `text` | `'Long text...'` | Multiline |
| `integer` | `42` | |
| `float` | `99.99` | |
| `boolean` | `true` / `false` | |
| `date` | `'2024-01-15'` | String, YYYY-MM-DD |
| `datetime` | `'2024-01-15 14:30:00'` | String, UTC |
| `binary` | `'SGVsbG8='` | Base64 encoded |
| `html` | `'<p>Hello</p>'` | Sanitized on save |
| `selection` | `'draft'` | Predefined options |

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

```typescript testable id="field-types-selection" needs="client,introspector" creates="res.partner" expect="result.typeChanged === true"
const id = await client.create('res.partner', {
  name: uniqueTestName('Selection Test'),
  type: 'contact',
});
trackRecord('res.partner', id);

const [partner] = await client.read('res.partner', [id], ['type']);

await client.write('res.partner', id, { type: 'invoice' });
const [updated] = await client.read('res.partner', [id], ['type']);

// Get available options via introspection
const fields = await introspector.getFields('res.partner');
const typeField = fields.find(f => f.name === 'type');
// typeField.selection = [['contact', 'Contact'], ['invoice', 'Invoice Address'], ...]

return { typeChanged: updated.type !== partner.type, hasSelection: !!typeField?.selection };
```

## Many2One — ⚠️ Read/Write Asymmetry

**This is the #1 Odoo gotcha.** Write just the ID, but read returns `[id, display_name]` tuple.

| Operation | Format |
|-----------|--------|
| **Write** | `partner_id: 42` |
| **Read** | `partner_id: [42, 'Acme Corp']` or `false` |

```typescript testable id="field-types-many2one" needs="client" creates="res.partner" expect="result.parentId !== null && result.parentName !== null"
const parentId = await client.create('res.partner', {
  name: uniqueTestName('Parent Company'),
  is_company: true,
});
trackRecord('res.partner', parentId);

const childId = await client.create('res.partner', {
  name: uniqueTestName('Child Contact'),
  parent_id: parentId,  // Write: just the ID
});
trackRecord('res.partner', childId);

const [child] = await client.read('res.partner', [childId], ['parent_id']);
// Read: child.parent_id = [parentId, 'Parent Company']

const extractedParentId = child.parent_id ? child.parent_id[0] : null;
const extractedParentName = child.parent_id ? child.parent_id[1] : null;

return { parentId: extractedParentId, parentName: extractedParentName };
```

## One2Many / Many2Many

Read returns arrays of IDs. Write uses command syntax (see crud.md for full X2Many command reference).

```typescript testable id="field-types-one2many" needs="client" creates="res.partner" expect="result.childCount >= 1"
const parentId = await client.create('res.partner', {
  name: uniqueTestName('Parent For O2M'),
  is_company: true,
});
trackRecord('res.partner', parentId);

await client.write('res.partner', parentId, {
  child_ids: [
    [0, 0, { name: uniqueTestName('Child Created via O2M') }],  // [0,0,values] = create
  ]
});

const [partner] = await client.read('res.partner', [parentId], ['child_ids']);
// partner.child_ids = [childId1, childId2, ...]

const childIds = partner.child_ids || [];
for (const childId of childIds) {
  trackRecord('res.partner', childId);
}

return { childCount: childIds.length };
```

```typescript testable id="field-types-many2many" needs="client" creates="res.partner" expect="result.categoryCount >= 1"
const categories = await client.search('res.partner.category', [], { limit: 1 });
let categoryId;
if (categories.length > 0) {
  categoryId = categories[0];
} else {
  categoryId = await client.create('res.partner.category', { name: uniqueTestName('Test Category') });
  trackRecord('res.partner.category', categoryId);
}

const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Partner With Categories'),
  category_id: [[6, 0, [categoryId]]],  // [6,0,ids] = replace all
});
trackRecord('res.partner', partnerId);

const [partner] = await client.read('res.partner', [partnerId], ['category_id']);

const categoryIds = partner.category_id || [];
return { categoryCount: categoryIds.length };
```

## Properties Fields

Dynamic user-defined fields. See [properties.md](./properties.md) for full documentation.

**⚠️ Read format ≠ Write format. Write replaces ALL property values.**

```typescript
// Read: Array of objects
[
  { name: 'priority', type: 'selection', string: 'Priority', value: 'high' },
  { name: 'score', type: 'integer', string: 'Score', value: 85 }
]

// Write: Simple key-value object
{ priority: 'high', score: 85 }
```

## Computed Fields

Computed/readonly fields cannot be written. Write the source field instead (e.g., `name` not `display_name`).

```typescript testable id="field-types-computed" needs="introspector" expect="result.hasDisplayName === true"
const fields = await introspector.getFields('res.partner');
const computedFields = fields.filter(f => f.readonly);

const displayNameField = computedFields.find(f => f.name === 'display_name');

return { hasDisplayName: !!displayNameField, computedCount: computedFields.length };
```

## Date/Time

Odoo stores datetimes in **UTC**. Dates as `YYYY-MM-DD`, datetimes as `YYYY-MM-DD HH:MM:SS`.

```typescript testable id="field-types-datetime" needs="client" creates="res.partner" expect="result.hasCreateDate === true"
const id = await client.create('res.partner', {
  name: uniqueTestName('Date Test Partner'),
});
trackRecord('res.partner', id);

const [partner] = await client.read('res.partner', [id], ['create_date']);

return { hasCreateDate: !!partner.create_date };
```

## Field Attributes (Introspection)

| Attribute | Meaning |
|-----------|---------|
| `required` | Must have a value on create |
| `readonly` | Computed, cannot be written |
| `store` | Stored in DB (vs computed on-the-fly) |
| `relation` | Target model for relational fields |
| `selection` | Available `[value, label]` pairs |
