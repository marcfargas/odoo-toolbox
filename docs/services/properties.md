# Properties Service — `client.properties.*`

Safe operations for Odoo's dynamic (properties) fields — user-defined fields that vary per-record.

**Safety:** All `client.properties.*` methods are **WRITE** — they modify property values.

## What Are Properties?

Properties are dynamic fields that Odoo users define through the UI without code changes. They appear on models like `crm.lead` (`lead_properties`) and `project.task` (`task_properties`).

Where definitions live:

| Record Model | Properties Field | Definition on | Definition Field |
|--------------|------------------|---------------|-----------------|
| `crm.lead` | `lead_properties` | `crm.team` | `lead_properties_definition` |
| `project.task` | `task_properties` | `project.project` | `task_properties_definition` |

## ⚠️ Critical: Full-Replacement Write Semantics

**Writing properties directly replaces ALL values.** Any property you omit becomes `false`.

```typescript
// ❌ NEVER — wipes ALL other properties on this record!
await client.write('crm.lead', id, {
  lead_properties: { priority: 'high' }   // All other properties → false
});
```

**Always use the service methods instead.** They read the current values first, then merge your updates:

```typescript
// ✅ SAFE — only 'priority' changes, all other properties are preserved
await client.properties.updateSafely('crm.lead', id, 'lead_properties', {
  priority: 'high',
});
```

## `updateSafely(model, id, field, updates)`

Update one or more property values on a single record without touching the rest:

```typescript testable id="props-update-safely" needs="client" creates="crm.team,crm.lead" expect="result.success === true"
// Create a CRM team with property definitions
const teamId = await client.create('crm.team', {
  name: 'Test Team',
  lead_properties_definition: [
    { name: 'priority', string: 'Priority', type: 'char' },
    { name: 'score', string: 'Score', type: 'integer' },
  ],
});

// Create a lead (inherits property definitions from team)
const leadId = await client.create('crm.lead', {
  name: 'Test Lead',
  team_id: teamId,
});

// Update only 'priority' — 'score' is unchanged
await client.properties.updateSafely(
  'crm.lead',
  leadId,
  'lead_properties',
  { priority: 'high' }
);

// Update only 'score' — 'priority' is unchanged
await client.properties.updateSafely(
  'crm.lead',
  leadId,
  'lead_properties',
  { score: 85 }
);

const current = await client.properties.getCurrentWriteFormat(
  'crm.lead', leadId, 'lead_properties'
);

return { success: current.priority === 'high' && current.score === 85 };
```

## `updateSafelyBatch(model, ids, field, updates)`

Apply the same property updates to multiple records at once. Each record's existing properties are preserved independently:

```typescript testable id="props-update-batch" needs="client" creates="crm.team,crm.lead" expect="result.success === true"
const teamId = await client.create('crm.team', {
  name: 'Batch Test Team',
  lead_properties_definition: [
    { name: 'priority', string: 'Priority', type: 'char' },
  ],
});

const lead1Id = await client.create('crm.lead', { name: 'Lead 1', team_id: teamId });
const lead2Id = await client.create('crm.lead', { name: 'Lead 2', team_id: teamId });

// Update the same property on both records
await client.properties.updateSafelyBatch(
  'crm.lead',
  [lead1Id, lead2Id],
  'lead_properties',
  { priority: 'medium' }
);

return { success: true };
```

## `getCurrentWriteFormat(model, id, field)`

Read the current property values in the write format (key-value object) — useful for inspecting before updating or for building conditional logic:

```typescript testable id="props-get-current" needs="client" creates="crm.team,crm.lead" expect="result.success === true"
const teamId = await client.create('crm.team', {
  name: 'Read Props Team',
  lead_properties_definition: [
    { name: 'stage', string: 'Stage', type: 'char' },
  ],
});

const leadId = await client.create('crm.lead', { name: 'Read Props Lead', team_id: teamId });

await client.properties.updateSafely('crm.lead', leadId, 'lead_properties', {
  stage: 'qualification',
});

const current = await client.properties.getCurrentWriteFormat(
  'crm.lead', leadId, 'lead_properties'
);

console.log('Current properties:', current);
// { stage: 'qualification' }

return { success: current.stage === 'qualification' };
```

## Read/Write Format Asymmetry

The raw `lead_properties` field has different formats for read vs write:

```typescript
// READ format — array of objects with full metadata
[
  {
    name: 'priority',
    type: 'selection',
    string: 'Priority',
    value: 'high',
    selection: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']],
  },
  {
    name: 'score',
    type: 'integer',
    string: 'Lead Score',
    value: 85,
  }
]

// WRITE format — simple key-value
{ priority: 'high', score: 85 }
```

Use the helper functions from the package for manual format conversion:

```typescript
import { propertiesToWriteFormat, getPropertyValue } from '@marcfargas/odoo-client';

const [lead] = await client.read('crm.lead', [id], ['lead_properties']);

// Convert read format → write format
const writeFormat = propertiesToWriteFormat(lead.lead_properties);

// Extract a single value from read format
const score = getPropertyValue(lead.lead_properties, 'score');
```

## Property Types Reference

| Type | Value Example | Notes |
|------|---------------|-------|
| `boolean` | `true` | |
| `integer` | `42` | |
| `float` | `99.99` | |
| `char` | `'Hello'` | Use `char`, **not** `text` |
| `date` | `'2024-01-15'` | |
| `datetime` | `'2024-01-15 14:30:00'` | |
| `selection` | `'high'` | Definition must include `selection` array |
| `many2one` | `42` | Definition must include `comodel` |
| `many2many` | `[1, 2, 3]` | Definition must include `comodel` |
| `tags` | `[1, 2]` | Definition must include `tags` array |

## Defining Properties (Admin Only)

Properties are defined on the **parent** model using `*_properties_definition` fields. Changes affect all records in that parent's scope (e.g., all leads in a CRM team):

```typescript testable id="props-define" needs="client" creates="crm.team" expect="result.success === true"
const teamId = await client.create('crm.team', {
  name: 'Properties Demo Team',
  lead_properties_definition: [
    {
      name: 'priority_level',
      string: 'Priority Level',
      type: 'selection',
      selection: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']],
    },
    { name: 'lead_score', string: 'Lead Score', type: 'integer' },
    { name: 'notes', string: 'Notes', type: 'char' },   // char, NOT text
    {
      name: 'assigned_user',
      string: 'Assigned To',
      type: 'many2one',
      comodel: 'res.users',
    },
  ],
});

return { success: true, teamId };
```

> **Never use `type: 'text'`** — it is not a valid property type. Use `type: 'char'` for string properties.

## Discovering Properties in the Schema

Find all models that have properties fields:

```typescript testable id="props-discover" needs="client" expect="result.count >= 0"
const propFields = await client.searchRead('ir.model.fields', [
  ['ttype', '=', 'properties'],
], {
  fields: ['name', 'model', 'field_description'],
  limit: 0,
});

for (const f of propFields) {
  console.log(`${f.model}.${f.name} — ${f.field_description}`);
}

return { count: propFields.length };
```

---

See also:
- [Field Types](../client/field-types.md) — properties read/write asymmetry overview
- [Schema Discovery](../introspection/schema-discovery.md) — discover property fields

For agent-optimized CLI examples, see the [odoo skill](../skills/odoo/).
