# Schema Discovery

> **Requires:** `@marcfargas/odoo-introspection` — a **separate npm package** from `@marcfargas/odoo-client`.
>
> ```bash
> npm install @marcfargas/odoo-introspection
> ```

Inspect the live Odoo schema to discover models, fields, and their relationships at runtime.

## Setup

```typescript
import { createClient } from '@marcfargas/odoo-client';
import { Introspector } from '@marcfargas/odoo-introspection';

const client = await createClient();
const introspector = new Introspector(client);
// Results are cached in-memory — repeated calls are fast
```

The `Introspector` queries Odoo's `ir.model` and `ir.model.fields` meta-models, which are always available in any Odoo instance.

## Listing Models

### `getModels(options?)`

Returns all models registered in the Odoo instance:

```typescript testable id="intro-list-models" needs="introspector" expect="result.count > 0 && result.hasPartner === true"
const models = await introspector.getModels();

const partnerModel = models.find(m => m.model === 'res.partner');
console.log(`Found ${models.length} models`);
console.log(`Partner label: ${partnerModel?.name}`);

return { count: models.length, hasPartner: !!partnerModel };
```

Each `OdooModel` object:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` | `ir.model` record ID |
| `model` | `string` | Technical name: `'res.partner'` |
| `name` | `string` | Human label: `'Contact'` |
| `info` | `string` | Description/help text |
| `transient` | `boolean` | True for wizard/temporary models |
| `modules` | `string` | Comma-separated module names |

### Filter by Module

```typescript testable id="intro-filter-module" needs="introspector" expect="result.count > 0"
const baseModels = await introspector.getModels({ modules: ['base'] });
console.log(`Base module has ${baseModels.length} models`);

return { count: baseModels.length };
```

### Exclude Transient Models

Transient models are wizards and temporary data — usually not interesting for schema analysis:

```typescript testable id="intro-exclude-transient" needs="introspector" expect="result.noTransient === true"
const models = await introspector.getModels({ includeTransient: false }); // default
const transient = models.filter(m => m.transient === true);

return { noTransient: transient.length === 0, count: models.length };
```

### `IntrospectionOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `includeTransient` | `boolean` | `false` | Include wizard/transient models |
| `modules` | `string[]` | all | Filter to models from these modules |
| `bypassCache` | `boolean` | `false` | Force fresh RPC call |

## Inspecting Fields

### `getFields(modelName, options?)`

Returns all fields for a model:

```typescript testable id="intro-get-fields" needs="introspector" expect="result.count > 0 && result.nameType === 'char'"
const fields = await introspector.getFields('res.partner');

const nameField = fields.find(f => f.name === 'name');
const emailField = fields.find(f => f.name === 'email');

console.log(`res.partner has ${fields.length} fields`);
console.log(`name: ${nameField?.ttype}, required: ${nameField?.required}`);

return { count: fields.length, nameType: nameField?.ttype };
```

Each `OdooField` object:

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Technical name: `'partner_id'` |
| `field_description` | `string` | Human label: `'Customer'` |
| `ttype` | `string` | Odoo type: `'char'`, `'many2one'`, etc. |
| `required` | `boolean` | Must be set on create |
| `readonly` | `boolean` | Computed field — cannot be written |
| `relation` | `string` | Target model for relational fields |
| `help` | `string` | Help text shown in UI |
| `selection` | `string` | Available options for selection fields |
| `compute` | `string` | Compute method name (if computed) |
| `model` | `string` | The model this field belongs to |

### Find Required Fields

Critical for `create()` — know what's mandatory:

```typescript testable id="intro-required-fields" needs="introspector" expect="result.count >= 0"
const fields = await introspector.getFields('crm.lead');
const required = fields.filter(f => f.required && !f.readonly);

for (const f of required) {
  console.log(`  ${f.name} (${f.ttype}) — ${f.field_description}`);
}

return { count: required.length };
```

### Find Relational Fields

```typescript testable id="intro-relational-fields" needs="introspector" expect="result.hasParentId === true"
const fields = await introspector.getFields('res.partner');

const many2one = fields.filter(f => f.ttype === 'many2one');
const one2many = fields.filter(f => f.ttype === 'one2many');
const many2many = fields.filter(f => f.ttype === 'many2many');

const parentId = many2one.find(f => f.name === 'parent_id');

// parentId.relation = 'res.partner'  — related model name
console.log(`Many2one: ${many2one.length}, O2M: ${one2many.length}, M2M: ${many2many.length}`);

return { hasParentId: !!parentId, relation: parentId?.relation };
```

### Find Computed (Readonly) Fields

These cannot be written — write the source field instead:

```typescript testable id="intro-computed-fields" needs="introspector" expect="result.hasDisplayName === true"
const fields = await introspector.getFields('res.partner');
const computed = fields.filter(f => f.readonly && f.compute);

const displayName = computed.find(f => f.name === 'display_name');
return { hasDisplayName: !!displayName, count: computed.length };
```

### Find Selection Options

```typescript testable id="intro-selection-fields" needs="introspector" expect="result.count >= 0"
const fields = await introspector.getFields('res.partner');
const selectionFields = fields.filter(f => f.ttype === 'selection');

const typeField = selectionFields.find(f => f.name === 'type');
if (typeField?.selection) {
  // selection is stored as a JSON-like string: "[['contact', 'Contact'], ...]"
  console.log(`type options: ${typeField.selection}`);
}

return { count: selectionFields.length };
```

## Getting Complete Model Metadata

`getModelMetadata(modelName)` fetches model info and fields together:

```typescript testable id="intro-model-metadata" needs="introspector" expect="result.fieldCount > 0"
const metadata = await introspector.getModelMetadata('res.partner');

console.log(`Model: ${metadata.model.name} (${metadata.model.model})`);
console.log(`Fields: ${metadata.fields.length}`);
console.log(`Modules: ${metadata.model.modules}`);

return { fieldCount: metadata.fields.length };
```

## Searching Fields Across Models

Query `ir.model.fields` directly when you need cross-model field discovery:

```typescript testable id="intro-cross-model" needs="client" expect="result.count > 0"
// Find all 'email' fields across all models
const emailFields = await client.searchRead('ir.model.fields', [
  ['name', 'ilike', 'email'],
], {
  fields: ['name', 'model', 'ttype', 'field_description'],
  limit: 20,
});

for (const f of emailFields) {
  console.log(`${f.model}.${f.name} (${f.ttype})`);
}

return { count: emailFields.length };
```

## Cache Management

Results are cached in-memory on the `Introspector` instance to minimize RPC calls. Clear the cache after installing or upgrading modules:

```typescript
// Clear all cached data
introspector.clearCache();

// Clear cache for a specific model
introspector.clearModelCache('res.partner');
```

## Direct Queries Without Introspector

For simple one-off queries, query `ir.model` and `ir.model.fields` directly:

```typescript testable id="intro-direct-models" needs="client" expect="result.count > 0"
const models = await client.searchRead('ir.model', [
  ['transient', '=', false],
], {
  fields: ['model', 'name', 'modules'],
  order: 'model asc',
  limit: 0,
});

return { count: models.length };
```

```typescript testable id="intro-direct-fields" needs="client" expect="result.hasName === true"
const fields = await client.searchRead('ir.model.fields', [
  ['model', '=', 'res.partner'],
], {
  fields: ['name', 'ttype', 'field_description', 'required', 'readonly', 'relation'],
  order: 'name asc',
  limit: 0,
});

const nameField = fields.find(f => f.name === 'name');
return { count: fields.length, hasName: !!nameField };
```

---

See also:
- [TypeScript Codegen](./codegen.md) — generate typed interfaces from the schema
- [Field Types](../client/field-types.md) — how Odoo types map to JavaScript

For agent-optimized CLI examples, see the [odoo skill](../skills/odoo/).
