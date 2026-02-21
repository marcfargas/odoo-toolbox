# Odoo Introspection

Discover models and fields available in an Odoo instance.

## CLI

All introspection commands are **READ** — no confirmation required.

### List all models

```bash
# List all models (model name + description)
odoo schema models

# Filter by name substring
odoo schema models --search sale
odoo schema models --search res.partner

# Only models from installed modules
odoo schema models --installed

# JSON output — pipe to jq
odoo schema models --format json | jq '.[].model'
```

### List fields for a model

```bash
# All fields for a model
odoo schema fields crm.lead

# Filter by field type
odoo schema fields crm.lead --type many2one
odoo schema fields res.partner --type selection

# Show only required fields
odoo schema fields crm.lead --required

# Filter by name substring
odoo schema fields account.move --search amount

# Export as CSV
odoo schema fields sale.order --format csv > sale-order-fields.csv
```

### Human-readable model summary

```bash
# Field count, type distribution, required/readonly counts
odoo schema describe res.partner
odoo schema describe crm.lead
```

### Generate TypeScript interface

```bash
# Print to stdout
odoo schema codegen sale.order

# Write to file
odoo schema codegen sale.order --out ./types/sale-order.ts

# Mark computed fields as readonly
odoo schema codegen crm.lead --readonly --out ./types/crm-lead.ts
```

---

## Library API

```typescript
import { createClient } from '@marcfargas/odoo-client';
import { Introspector } from '@marcfargas/odoo-introspection';

const client = await createClient();
const introspector = new Introspector(client);
```

## Listing Models

```typescript testable id="introspect-list-models" needs="introspector" expect="result.count > 0 && result.hasPartner === true"
const models = await introspector.getModels();

console.log(`Found ${models.length} models`);

const partnerModel = models.find(m => m.model === 'res.partner');

return { count: models.length, hasPartner: !!partnerModel };
```

Model object properties: `id`, `model` (technical name), `name` (human label), `modules`, `transient`.

### Filter by Module

```typescript testable id="introspect-filter-module" needs="introspector" expect="result.count > 0"
const baseModels = await introspector.getModels({ modules: ['base'] });

return { count: baseModels.length };
```

### Exclude Transient (Wizard) Models

```typescript testable id="introspect-exclude-transient" needs="introspector" expect="result.noTransient === true"
const models = await introspector.getModels({
  includeTransient: false  // Default
});

const transientModels = models.filter(m => m.transient === true);

return { noTransient: transientModels.length === 0, count: models.length };
```

### Direct Query (Without Introspector)

```typescript testable id="introspect-direct-query" needs="client" expect="result.count > 0 && result.hasPartner === true"
const models = await client.searchRead(
  'ir.model',
  [['transient', '=', false]],
  {
    fields: ['model', 'name', 'modules'],
    order: 'model asc'
  }
);

const partnerModel = models.find(m => m.model === 'res.partner');

return { count: models.length, hasPartner: !!partnerModel };
```

## Analyzing Fields

Field metadata: `name`, `ttype`, `field_description`, `required`, `readonly`, `store`, `relation`, `selection`.

```typescript testable id="analyze-list-fields" needs="introspector" expect="result.count > 0 && result.hasName === true"
const fields = await introspector.getFields('res.partner');

const nameField = fields.find(f => f.name === 'name');

return { count: fields.length, hasName: !!nameField, nameType: nameField?.ttype };
```

### Find Required Fields

Critical for `create()` — know what's mandatory:

```typescript
const fields = await introspector.getFields('crm.lead');
const required = fields.filter(f => f.required);
required.forEach(f => console.log(`- ${f.name}: ${f.ttype}`));
```

### Find Relational Fields

```typescript testable id="analyze-relational-fields" needs="introspector" expect="result.hasMany2One === true && result.hasOne2Many === true"
const fields = await introspector.getFields('res.partner');

const many2oneFields = fields.filter(f => f.ttype === 'many2one');
const parentIdField = many2oneFields.find(f => f.name === 'parent_id');

const one2manyFields = fields.filter(f => f.ttype === 'one2many');
const childIdsField = one2manyFields.find(f => f.name === 'child_ids');

const many2manyFields = fields.filter(f => f.ttype === 'many2many');

return {
  hasMany2One: !!parentIdField && parentIdField.relation === 'res.partner',
  hasOne2Many: !!childIdsField && childIdsField.relation === 'res.partner',
  many2manyCount: many2manyFields.length
};
```

### Find Selection Options

```typescript testable id="analyze-selection-fields" needs="introspector" expect="result.hasSelection === true"
const fields = await introspector.getFields('res.partner');
const selectionFields = fields.filter(f => f.ttype === 'selection');
const typeField = selectionFields.find(f => f.name === 'type');

return {
  hasSelection: selectionFields.length > 0,
  typeFieldExists: !!typeField
};
```

### Find Computed (Readonly) Fields

Cannot be written directly — write the source field instead.

```typescript testable id="analyze-computed-fields" needs="introspector" expect="result.hasDisplayName === true"
const fields = await introspector.getFields('res.partner');
const readonlyFields = fields.filter(f => f.readonly);
const displayNameField = readonlyFields.find(f => f.name === 'display_name');

return {
  hasDisplayName: !!displayNameField,
  readonlyCount: readonlyFields.length
};
```

### Search Fields Across Models

```typescript testable id="analyze-search-fields" needs="client" expect="result.count > 0"
const emailFields = await client.searchRead(
  'ir.model.fields',
  [['name', 'ilike', 'email']],
  { fields: ['name', 'model', 'ttype', 'field_description'], limit: 20 }
);

return { count: emailFields.length };
```
