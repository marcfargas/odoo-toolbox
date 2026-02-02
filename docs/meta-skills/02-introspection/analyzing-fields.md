# Analyzing Odoo Fields

How to understand field metadata and structure for any model.

## Overview

After discovering models, you need to understand their fields. This is essential for:
- Knowing which fields are required when creating records
- Understanding relational field targets
- Identifying computed vs stored fields
- Finding Properties fields

## Using the Introspector

```typescript
import { OdooClient } from '@odoo-toolbox/client';
import { Introspector } from '@odoo-toolbox/introspection';

const client = new OdooClient({...});
await client.authenticate();

const introspector = new Introspector(client);

// Get fields for a model
const fields = await introspector.getFields('crm.lead');
```

## Field Metadata

Each field object contains:

| Property | Description |
|----------|-------------|
| `name` | Technical field name |
| `ttype` | Field type (char, integer, many2one, etc.) |
| `field_description` | Human-readable label |
| `required` | Whether the field is mandatory |
| `readonly` | Whether the field is computed/read-only |
| `store` | Whether stored in database |
| `relation` | For relational fields, the target model |
| `selection` | For selection fields, available options |

## Listing All Fields

```typescript testable id="analyze-list-fields" needs="introspector" expect="result.count > 0 && result.hasName === true"
const fields = await introspector.getFields('res.partner');

// Find the 'name' field
const nameField = fields.find(f => f.name === 'name');

return { count: fields.length, hasName: !!nameField, nameType: nameField?.ttype };
```

Output:
```
- name: char (required)
- email: char
- phone: char
- is_company: boolean
- partner_id: many2one -> res.partner
- child_ids: one2many -> res.partner
- category_id: many2many -> res.partner.category
```

## Finding Required Fields

Critical for creating records:

```typescript
const fields = await introspector.getFields('crm.lead');

const requiredFields = fields.filter(f => f.required);

console.log('Required fields for crm.lead:');
requiredFields.forEach(f => {
  console.log(`- ${f.name}: ${f.ttype}`);
});
```

## Finding Relational Fields

```typescript testable id="analyze-relational-fields" needs="introspector" expect="result.hasMany2One === true && result.hasOne2Many === true"
const fields = await introspector.getFields('res.partner');

// Many2One fields (single reference)
const many2oneFields = fields.filter(f => f.ttype === 'many2one');
const parentIdField = many2oneFields.find(f => f.name === 'parent_id');

// One2Many fields (reverse relations)
const one2manyFields = fields.filter(f => f.ttype === 'one2many');
const childIdsField = one2manyFields.find(f => f.name === 'child_ids');

// Many2Many fields
const many2manyFields = fields.filter(f => f.ttype === 'many2many');

return {
  hasMany2One: !!parentIdField && parentIdField.relation === 'res.partner',
  hasOne2Many: !!childIdsField && childIdsField.relation === 'res.partner',
  many2manyCount: many2manyFields.length
};
```

## Finding Selection Fields

Get available options:

```typescript testable id="analyze-selection-fields" needs="introspector" expect="result.hasSelection === true"
const fields = await introspector.getFields('res.partner');

const selectionFields = fields.filter(f => f.ttype === 'selection');

// res.partner has a 'type' selection field
const typeField = selectionFields.find(f => f.name === 'type');

return {
  hasSelection: selectionFields.length > 0,
  typeFieldExists: !!typeField
};
```

## Finding Properties Fields

Properties are dynamic fields defined at runtime:

```typescript
const fields = await introspector.getFields('crm.lead');

// Properties fields have type 'properties'
const propertiesFields = fields.filter(f => f.ttype === 'properties');

console.log('\nProperties fields:');
propertiesFields.forEach(f => {
  console.log(`- ${f.name}: ${f.field_description}`);
  // Properties definition is on a parent model
  console.log(`  Definition field: ${f.definition}`);
});
```

Common Properties fields:

| Model | Properties Field | Definition On |
|-------|------------------|---------------|
| `crm.lead` | `lead_properties` | `crm.team.lead_properties_definition` |
| `project.task` | `task_properties` | `project.project.task_properties_definition` |

## Finding Computed Fields

Computed fields cannot be written directly:

```typescript testable id="analyze-computed-fields" needs="introspector" expect="result.hasDisplayName === true"
const fields = await introspector.getFields('res.partner');

// Readonly fields (computed or protected)
const readonlyFields = fields.filter(f => f.readonly);

// display_name is a classic computed field
const displayNameField = readonlyFields.find(f => f.name === 'display_name');

return {
  hasDisplayName: !!displayNameField,
  readonlyCount: readonlyFields.length
};
```

## Searching Fields Across Models

Find fields by pattern across the entire schema:

```typescript testable id="analyze-search-fields" needs="client" expect="result.count > 0"
// Find all fields with 'email' in the name
const emailFields = await client.searchRead(
  'ir.model.fields',
  [['name', 'ilike', '%email%']],
  { fields: ['name', 'model', 'ttype', 'field_description'], limit: 20 }
);

return { count: emailFields.length };
```

## Finding Fields That Reference a Model

```typescript
// Find all many2one fields pointing to res.partner
const partnerRefs = await client.searchRead(
  'ir.model.fields',
  [
    ['ttype', '=', 'many2one'],
    ['relation', '=', 'res.partner']
  ],
  {
    fields: ['name', 'model', 'field_description'],
    limit: 50
  }
);

console.log('Fields referencing res.partner:');
partnerRefs.forEach(f => {
  console.log(`- ${f.model}.${f.name}: ${f.field_description}`);
});
```

## Direct Query (Without Introspector)

```typescript
// Get all fields for a model
const fields = await client.searchRead(
  'ir.model.fields',
  [['model', '=', 'crm.lead']],
  {
    fields: [
      'name',
      'ttype',
      'field_description',
      'required',
      'readonly',
      'relation',
      'selection'
    ]
  }
);
```

## Practical Example: Generating Field Documentation

```typescript
async function documentModel(client, modelName) {
  const introspector = new Introspector(client);
  const fields = await introspector.getFields(modelName);

  console.log(`\n## ${modelName}\n`);

  // Required fields
  const required = fields.filter(f => f.required && !f.readonly);
  if (required.length > 0) {
    console.log('### Required Fields\n');
    required.forEach(f => {
      console.log(`- **${f.name}** (${f.ttype}): ${f.field_description}`);
    });
  }

  // Optional fields
  const optional = fields.filter(f => !f.required && !f.readonly);
  if (optional.length > 0) {
    console.log('\n### Optional Fields\n');
    optional.slice(0, 20).forEach(f => {
      const relation = f.relation ? ` -> ${f.relation}` : '';
      console.log(`- ${f.name} (${f.ttype}${relation})`);
    });
  }

  // Relations
  const relations = fields.filter(f =>
    ['many2one', 'one2many', 'many2many'].includes(f.ttype)
  );
  if (relations.length > 0) {
    console.log('\n### Relations\n');
    relations.forEach(f => {
      console.log(`- ${f.name}: ${f.ttype} -> ${f.relation}`);
    });
  }
}

// Usage
await documentModel(client, 'crm.lead');
```

## Field Type Reference

| Type | Description | Read Value | Write Value |
|------|-------------|------------|-------------|
| `char` | Short text | `string` | `string` |
| `text` | Long text | `string` | `string` |
| `integer` | Whole number | `number` | `number` |
| `float` | Decimal | `number` | `number` |
| `boolean` | True/False | `boolean` | `boolean` |
| `date` | Date | `string` (YYYY-MM-DD) | `string` |
| `datetime` | Date+Time | `string` (ISO) | `string` |
| `selection` | Dropdown | `string` (key) | `string` (key) |
| `many2one` | Single ref | `[id, name]` | `id` |
| `one2many` | Multiple refs | `[ids]` | Commands |
| `many2many` | Multiple refs | `[ids]` | Commands |
| `properties` | Dynamic | `[{name, type, value}]` | `{name: value}` |
| `binary` | Binary data | `string` (base64) | `string` (base64) |

## Related Documents

- [field-types.md](../01-fundamentals/field-types.md) - Field type behaviors
- [properties.md](../04-patterns/properties.md) - Properties fields
- [discovering-models.md](./discovering-models.md) - Finding models
