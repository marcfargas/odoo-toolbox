# Properties Fields

Working with Odoo's dynamic, user-defined Properties fields.

> **MCP Tools**: Use `odoo_read_properties` to get property values in both raw and simple formats. **IMPORTANT**: Use `odoo_update_properties` for safe partial updates (prevents accidental data loss). Use `odoo_find_properties_field` to discover if a model has properties and `odoo_get_property_definitions` to see available property definitions.

## Overview

Properties are dynamic fields that can be created via configuration without modifying the database schema. They're commonly used in:
- CRM leads (`lead_properties` on `crm.lead`)
- Project tasks (`task_properties` on `project.task`)

## Understanding Properties

### Where Definitions Live

Properties are defined on a **parent** model, not the record itself:

| Record Model | Properties Field | Definition Model | Definition Field |
|--------------|------------------|------------------|------------------|
| `crm.lead` | `lead_properties` | `crm.team` | `lead_properties_definition` |
| `project.task` | `task_properties` | `project.project` | `task_properties_definition` |

### Allowed Property Types

From Odoo's `fields.py:Properties.ALLOWED_TYPES`:

| Type | Description | Value Example |
|------|-------------|---------------|
| `boolean` | True/False | `true` |
| `integer` | Whole number | `42` |
| `float` | Decimal | `99.99` |
| `char` | Short text | `'Hello'` |
| `date` | Date only | `'2024-01-15'` |
| `datetime` | Date and time | `'2024-01-15 14:30:00'` |
| `selection` | Dropdown | `'high'` |
| `many2one` | Single reference | `42` (ID) |
| `many2many` | Multiple references | `[1, 2, 3]` (IDs) |
| `tags` | Tag selection | `[1, 2]` (IDs) |
| `separator` | Visual divider | (no value) |

**Important**: `text` is NOT a valid property type. Use `char` instead.

## CRITICAL: Read/Write Asymmetry

Properties have **different formats** when reading vs writing:

### Read Format (Array of Objects)

When you read properties, Odoo returns an array with full metadata:

```typescript
const [lead] = await client.read('crm.lead', [id], ['lead_properties']);

// lead.lead_properties =
[
  {
    name: 'priority',
    type: 'selection',
    string: 'Priority',
    value: 'high',
    selection: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']]
  },
  {
    name: 'score',
    type: 'integer',
    string: 'Lead Score',
    value: 85
  },
  {
    name: 'requires_approval',
    type: 'boolean',
    string: 'Requires Approval',
    value: true
  }
]
```

### Write Format (Simple Key-Value)

When writing, use a simple object:

```typescript
await client.write('crm.lead', id, {
  lead_properties: {
    priority: 'high',
    score: 85,
    requires_approval: true
  }
});
```

## CRITICAL: Full Replacement Behavior

**When you write properties, Odoo REPLACES ALL property values.**

Properties you don't specify become `false`.

### Wrong Way (Loses Data!)

```typescript
// This CLEARS all other properties!
await client.write('crm.lead', id, {
  lead_properties: { priority: 'high' }
});
// score is now false, requires_approval is now false!
```

### Correct Way (Preserve Values)

```typescript
import { propertiesToWriteFormat } from '@odoo-toolbox/client';

// 1. Read current properties
const [lead] = await client.read('crm.lead', [id], ['lead_properties']);

// 2. Convert to write format
const props = propertiesToWriteFormat(lead.lead_properties);
// props = { priority: 'high', score: 85, requires_approval: true }

// 3. Modify what you need
props.priority = 'critical';

// 4. Write ALL properties back
await client.write('crm.lead', id, { lead_properties: props });
```

## Helper Functions

### propertiesToWriteFormat()

Converts read format to write format:

```typescript
import { propertiesToWriteFormat } from '@odoo-toolbox/client';

const [lead] = await client.read('crm.lead', [id], ['lead_properties']);
const writeFormat = propertiesToWriteFormat(lead.lead_properties);

// Input (read format):
// [{ name: 'score', type: 'integer', value: 85 }, ...]

// Output (write format):
// { score: 85, ... }
```

### getPropertyValue()

Extract a specific property value:

```typescript
import { getPropertyValue } from '@odoo-toolbox/client';

const [lead] = await client.read('crm.lead', [id], ['lead_properties']);

const score = getPropertyValue(lead.lead_properties, 'score');
const priority = getPropertyValue(lead.lead_properties, 'priority');
```

## Defining Properties (Admin)

### Property Definition Structure

```typescript
const propertyDefinition = {
  name: 'priority_level',      // Technical name (no spaces)
  string: 'Priority Level',    // Human-readable label
  type: 'selection',           // Property type
  selection: [                 // For selection type
    ['low', 'Low'],
    ['medium', 'Medium'],
    ['high', 'High'],
    ['critical', 'Critical'],
  ],
};
```

### Creating Properties on CRM Teams

```typescript
import { PropertiesDefinition } from '@odoo-toolbox/client';

// Get a CRM team
const teams = await client.searchRead('crm.team', [], {
  fields: ['id', 'name'],
  limit: 1,
});

const teamId = teams[0].id;

// Define properties
const definition: PropertiesDefinition = [
  {
    name: 'priority_level',
    string: 'Priority Level',
    type: 'selection',
    selection: [
      ['low', 'Low'],
      ['medium', 'Medium'],
      ['high', 'High'],
      ['critical', 'Critical'],
    ],
  },
  {
    name: 'lead_score',
    string: 'Lead Score',
    type: 'integer',
  },
  {
    name: 'requires_approval',
    string: 'Requires Approval',
    type: 'boolean',
  },
  {
    name: 'notes',
    string: 'Internal Notes',
    type: 'char',  // NOT 'text'!
  },
];

// Write to team
await client.write('crm.team', teamId, {
  lead_properties_definition: definition,
});

console.log('Properties defined!');
```

### Selection Property

```typescript
{
  name: 'lead_source',
  string: 'Lead Source',
  type: 'selection',
  selection: [
    ['website', 'Website'],
    ['referral', 'Referral'],
    ['social', 'Social Media'],
    ['trade_show', 'Trade Show'],
    ['cold_call', 'Cold Call'],
    ['other', 'Other'],
  ],
}
```

### Many2One Property

```typescript
{
  name: 'assigned_user',
  string: 'Assigned To',
  type: 'many2one',
  comodel: 'res.users',  // Target model
}
```

### Tags Property

```typescript
{
  name: 'categories',
  string: 'Categories',
  type: 'tags',
  tags: [
    { name: 'vip', string: 'VIP', color: 1 },
    { name: 'new', string: 'New Customer', color: 2 },
    { name: 'urgent', string: 'Urgent', color: 3 },
  ],
}
```

## Complete Example: Safe Property Update

```typescript
import {
  OdooClient,
  propertiesToWriteFormat,
  getPropertyValue,
} from '@odoo-toolbox/client';

const client = new OdooClient({
  url: process.env.ODOO_URL || 'http://localhost:8069',
  database: process.env.ODOO_DB || 'odoo',
  username: process.env.ODOO_USER || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
});

await client.authenticate();

// Find a lead with properties
const leads = await client.searchRead(
  'crm.lead',
  [['lead_properties', '!=', false]],
  { fields: ['name', 'lead_properties'], limit: 1 }
);

if (leads.length === 0) {
  console.log('No leads with properties found');
  process.exit(0);
}

const lead = leads[0];
console.log(`Lead: ${lead.name}`);

// Read current properties
console.log('\nCurrent properties:');
lead.lead_properties.forEach(prop => {
  console.log(`  ${prop.string}: ${JSON.stringify(prop.value)}`);
});

// Get specific value
const currentScore = getPropertyValue(lead.lead_properties, 'lead_score') || 0;
console.log(`\nCurrent score: ${currentScore}`);

// Convert to write format
const writeProps = propertiesToWriteFormat(lead.lead_properties);

// Update only the score (preserving others!)
writeProps.lead_score = currentScore + 10;

// Write back
await client.write('crm.lead', lead.id, {
  lead_properties: writeProps,
});

console.log(`\nUpdated score to: ${writeProps.lead_score}`);

await client.logout();
```

## Finding Properties in Schema

```typescript testable id="properties-schema" needs="client" expect="result.success === true"
// Find all properties fields (may be empty if no modules use properties)
const propFields = await client.searchRead(
  'ir.model.fields',
  [['ttype', '=', 'properties']],
  { fields: ['name', 'model', 'field_description'] }
);

// This works even if no properties exist
return { success: true, count: propFields.length };
```

## Related Documents

- [field-types.md](../01-fundamentals/field-types.md) - All field types
- [crud-operations.md](./crud-operations.md) - CRUD patterns
- [analyzing-fields.md](../02-introspection/analyzing-fields.md) - Finding fields
