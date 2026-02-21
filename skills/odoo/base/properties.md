# Properties Fields

Dynamic, user-defined fields on Odoo records. Commonly used in CRM leads (`lead_properties`) and project tasks (`task_properties`).

> ⚠️ **CRITICAL: Properties have full-replacement semantics**  
> Writing properties REPLACES ALL values. Omitted properties become `false`, causing **data loss**.  
> **Always use the safe helper functions below** - never write properties directly.

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

## ✅ Safe Update Methods (REQUIRED)

**Always use `client.properties.*` methods. Never write properties directly.**

```typescript testable id="safe-properties" needs="client" creates="crm.team,crm.lead" expect="result.success === true"
// Create a CRM team with a "priority" property definition
const teamId = await client.create('crm.team', {
  name: uniqueTestName('Props Team'),
  lead_properties_definition: [
    { name: 'priority', string: 'Priority', type: 'char' },
  ],
});
trackRecord('crm.team', teamId);

// Create two leads in that team (properties are inherited from team)
const leadId1 = await client.create('crm.lead', {
  name: uniqueTestName('Props Lead 1'),
  team_id: teamId,
});
trackRecord('crm.lead', leadId1);

const leadId2 = await client.create('crm.lead', {
  name: uniqueTestName('Props Lead 2'),
  team_id: teamId,
});
trackRecord('crm.lead', leadId2);

// ✅ SAFE - Update only priority, preserves everything else
await client.properties.updateSafely(
  'crm.lead',
  leadId1,
  'lead_properties',
  { priority: 'critical' }
);

// ✅ SAFE - Batch update multiple leads
await client.properties.updateSafelyBatch(
  'crm.lead',
  [leadId1, leadId2],
  'lead_properties',
  { priority: 'high' }
);

// ✅ SAFE - Get current values for inspection
const current = await client.properties.getCurrentWriteFormat(
  'crm.lead',
  leadId1,
  'lead_properties'
);

return { success: current.priority === 'high' };
```

### Available Methods

| Method | Purpose |
|--------|---------|
| `client.properties.updateSafely(model, id, field, updates)` | Update single record safely |
| `client.properties.updateSafelyBatch(model, ids, field, updates)` | Update multiple records safely |
| `client.properties.getCurrentWriteFormat(model, id, field)` | Get current properties in write format |

### Helper Functions

```typescript
import { propertiesToWriteFormat, getPropertyValue } from '@marcfargas/odoo-client';

const [lead] = await client.read('crm.lead', [id], ['lead_properties']);

// Convert read→write format
const writeFormat = propertiesToWriteFormat(lead.lead_properties);

// Extract single value
const score = getPropertyValue(lead.lead_properties, 'score');
```

## 🚫 DANGER: Never Use Direct Write

```typescript
// ❌ NEVER DO THIS - Causes data loss!
await client.write('crm.lead', id, {
  lead_properties: { priority: 'high' }  // ← Wipes out ALL other properties!
});

// ❌ NEVER DO THIS - Manual pattern is error-prone!
const [lead] = await client.read('crm.lead', [id], ['lead_properties']);
const props = propertiesToWriteFormat(lead.lead_properties);
props.priority = 'critical';  // ← Easy to forget other properties
await client.write('crm.lead', id, { lead_properties: props });
```

## Understanding Properties Structure

**Read/Write Asymmetry:** Read returns array with metadata, write takes simple object.

```typescript
// READ format (what Odoo returns):
[
  { name: 'priority', type: 'selection', string: 'Priority', value: 'high', selection: [...] },
  { name: 'score', type: 'integer', string: 'Lead Score', value: 85 }
]

// WRITE format (what Odoo expects):
{ priority: 'high', score: 85 }
```

## Defining Properties (Admin Only)

Properties are defined on **parent models** with `*_properties_definition` fields:

```typescript testable id="define-properties" needs="client" expect="result.success === true"
// Define properties on CRM team (affects all leads in that team)
const teamId = 1;

await client.write('crm.team', teamId, {
  lead_properties_definition: [
    {
      name: 'priority_level',
      string: 'Priority Level', 
      type: 'selection',
      selection: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']],
    },
    { name: 'lead_score', string: 'Lead Score', type: 'integer' },
    { name: 'notes', string: 'Notes', type: 'char' },  // Use 'char', NOT 'text'!
    {
      name: 'assigned_user',
      string: 'Assigned To',
      type: 'many2one', 
      comodel: 'res.users',
    },
  ],
});

return { success: true };
```

**Critical:** Definition changes affect ALL records using those properties. Test carefully!

## Finding Properties in Schema

```typescript testable id="properties-schema" needs="client" expect="result.success === true"
const propFields = await client.searchRead(
  'ir.model.fields',
  [['ttype', '=', 'properties']],
  { fields: ['name', 'model', 'field_description'] }
);

return { success: true, count: propFields.length };
```
