# Properties Fields

Dynamic, user-defined fields on Odoo records. Commonly used in CRM leads (`lead_properties`) and project tasks (`task_properties`).

## Where Definitions Live

Properties are defined on a **parent** model:

| Record Model | Properties Field | Definition Model | Definition Field |
|--------------|------------------|------------------|------------------|
| `crm.lead` | `lead_properties` | `crm.team` | `lead_properties_definition` |
| `project.task` | `task_properties` | `project.project` | `task_properties_definition` |

## Property Types

| Type | Value Example | Notes |
|------|---------------|-------|
| `boolean` | `true` | |
| `integer` | `42` | |
| `float` | `99.99` | |
| `char` | `'Hello'` | **`text` is NOT valid** — use `char` |
| `date` | `'2024-01-15'` | |
| `datetime` | `'2024-01-15 14:30:00'` | |
| `selection` | `'high'` | Needs `selection` array in definition |
| `many2one` | `42` | Needs `comodel` in definition |
| `many2many` | `[1, 2, 3]` | Needs `comodel` in definition |
| `tags` | `[1, 2]` | Needs `tags` array in definition |

## ⚠️ Read/Write Asymmetry

**Read returns array of objects. Write takes a simple key-value object.**

```typescript
// READ format:
[
  { name: 'priority', type: 'selection', string: 'Priority', value: 'high', selection: [...] },
  { name: 'score', type: 'integer', string: 'Lead Score', value: 85 }
]

// WRITE format:
{ priority: 'high', score: 85 }
```

## ⚠️ Full Replacement on Write

**Writing properties REPLACES ALL values. Omitted properties become `false`.**

```typescript
// WRONG — clears score and everything else!
await client.write('crm.lead', id, { lead_properties: { priority: 'high' } });

// CORRECT — read, convert, modify, write all back
import { propertiesToWriteFormat } from '@marcfargas/odoo-client';

const [lead] = await client.read('crm.lead', [id], ['lead_properties']);
const props = propertiesToWriteFormat(lead.lead_properties);
props.priority = 'critical';  // Modify one
await client.write('crm.lead', id, { lead_properties: props });
```

## Helper Functions

```typescript
import { propertiesToWriteFormat, getPropertyValue } from '@marcfargas/odoo-client';

const [lead] = await client.read('crm.lead', [id], ['lead_properties']);

// Convert read→write format
const writeFormat = propertiesToWriteFormat(lead.lead_properties);
// { score: 85, priority: 'high', ... }

// Extract single value
const score = getPropertyValue(lead.lead_properties, 'score');
```

## Defining Properties (Admin)

```typescript
await client.write('crm.team', teamId, {
  lead_properties_definition: [
    {
      name: 'priority_level',
      string: 'Priority Level',
      type: 'selection',
      selection: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']],
    },
    { name: 'lead_score', string: 'Lead Score', type: 'integer' },
    { name: 'notes', string: 'Notes', type: 'char' },  // NOT 'text'!
    {
      name: 'assigned_user',
      string: 'Assigned To',
      type: 'many2one',
      comodel: 'res.users',
    },
  ],
});
```

## Finding Properties in Schema

```typescript testable id="properties-schema" needs="client" expect="result.success === true"
const propFields = await client.searchRead(
  'ir.model.fields',
  [['ttype', '=', 'properties']],
  { fields: ['name', 'model', 'field_description'] }
);

return { success: true, count: propFields.length };
```
