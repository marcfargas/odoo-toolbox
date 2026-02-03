# Odoo Introspection

How to discover and understand models and fields available in an Odoo instance.

> **MCP Tools**: Use `odoo_get_models`, `odoo_get_fields`, `odoo_get_model_metadata`, and `odoo_generate_types` for introspection.

## Overview

Before working with Odoo data, you need to know what models (tables) exist and what fields they have. When using the MCP server, introspection tools are available directly. The underlying `@odoo-toolbox/introspection` package provides these capabilities.

## Using the Introspector

```typescript
import { OdooClient } from '@odoo-toolbox/client';
import { Introspector } from '@odoo-toolbox/introspection';

const client = new OdooClient({...});
await client.authenticate();

const introspector = new Introspector(client);
```

---

# Part 1: Discovering Models

## Listing All Models

```typescript testable id="introspect-list-models" needs="introspector" expect="result.count > 0 && result.hasPartner === true"
const models = await introspector.getModels();

console.log(`Found ${models.length} models`);

// Verify core model exists
const partnerModel = models.find(m => m.model === 'res.partner');

return { count: models.length, hasPartner: !!partnerModel };
```

Each model object contains:

| Property | Description |
|----------|-------------|
| `id` | Model ID in ir.model |
| `model` | Technical name (e.g., `crm.lead`) |
| `name` | Human-readable name (e.g., "Lead/Opportunity") |
| `modules` | Comma-separated modules that define/extend it |
| `transient` | Whether it's a wizard (temporary) model |

## Filtering Models

### By Module

```typescript testable id="introspect-filter-module" needs="introspector" expect="result.count > 0"
// Get models from the base module (always available)
const baseModels = await introspector.getModels({ modules: ['base'] });

console.log(`Found ${baseModels.length} base models`);

return { count: baseModels.length };
```

### Excluding Transient Models

Transient models are wizards - temporary data not worth querying:

```typescript testable id="introspect-exclude-transient" needs="introspector" expect="result.noTransient === true"
const models = await introspector.getModels({
  includeTransient: false  // Default is false
});

// Verify no transient models
const transientModels = models.filter(m => m.transient === true);

return { noTransient: transientModels.length === 0, count: models.length };
```

## Understanding Model Categories

### Core Models

These exist in every Odoo installation:

| Model | Description |
|-------|-------------|
| `res.partner` | Contacts and companies |
| `res.users` | System users |
| `res.company` | Companies (multi-company) |
| `res.country` | Countries |
| `res.currency` | Currencies |

### Module-Specific Models

Installed modules add their models:

| Module | Key Models |
|--------|------------|
| `crm` | `crm.lead`, `crm.team`, `crm.stage` |
| `sale` | `sale.order`, `sale.order.line` |
| `purchase` | `purchase.order`, `purchase.order.line` |
| `stock` | `stock.picking`, `stock.move` |
| `account` | `account.move`, `account.account` |
| `project` | `project.project`, `project.task` |

### Technical Models

These are for internal Odoo operations:

- `ir.*` - Internal registry (models, fields, actions, menus)
- `mail.*` - Messaging system
- `base.*` - Base functionality

## Model Naming Conventions

| Pattern | Example | Description |
|---------|---------|-------------|
| `module.model` | `crm.lead` | Main model from module |
| `model.line` | `sale.order.line` | Line items |
| `model.tag` | `crm.tag` | Tags for categorization |
| `model.stage` | `crm.stage` | Stage definitions |
| `res.*` | `res.partner` | Resources (base entities) |
| `ir.*` | `ir.model` | Internal registry |

## Direct Query (Without Introspector)

```typescript testable id="introspect-direct-query" needs="client" expect="result.count > 0 && result.hasPartner === true"
// Get all non-transient models
const models = await client.searchRead(
  'ir.model',
  [['transient', '=', false]],
  {
    fields: ['model', 'name', 'modules'],
    order: 'model asc'
  }
);

// Verify res.partner exists
const partnerModel = models.find(m => m.model === 'res.partner');

return { count: models.length, hasPartner: !!partnerModel };
```

---

# Part 2: Analyzing Fields

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

```typescript testable id="analyze-search-fields" needs="client" expect="result.count > 0"
// Find all fields with 'email' in the name
const emailFields = await client.searchRead(
  'ir.model.fields',
  [['name', 'ilike', '%email%']],
  { fields: ['name', 'model', 'ttype', 'field_description'], limit: 20 }
);

return { count: emailFields.length };
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

- [field-types.md](./field-types.md) - Field type behaviors
- [properties.md](./properties.md) - Properties fields
- [modules.md](./modules.md) - Module management
