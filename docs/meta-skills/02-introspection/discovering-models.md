# Discovering Odoo Models

How to find and understand models available in an Odoo instance.

## Overview

Before working with Odoo data, you need to know what models (tables) exist. The `@odoo-toolbox/introspection` package provides tools for this.

## Using the Introspector

```typescript
import { OdooClient } from '@odoo-toolbox/client';
import { Introspector } from '@odoo-toolbox/introspection';

const client = new OdooClient({...});
await client.authenticate();

const introspector = new Introspector(client);
```

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

### By Name Pattern

```typescript
// Find models with "sale" in the name
const saleModels = await client.searchRead(
  'ir.model',
  [['model', 'ilike', '%sale%']],
  { fields: ['model', 'name', 'modules'] }
);
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

## Checking Module Installation

Before using module-specific models, verify the module is installed:

```typescript testable id="introspect-module-check" needs="module-manager" expect="result.hasBase === true"
// Check if base module is installed (always true)
const hasBase = await moduleManager.isModuleInstalled('base');

// Check if a non-existent module is installed
const hasFake = await moduleManager.isModuleInstalled('fake_nonexistent_module');

return { hasBase, hasFake };
```

## Direct Query (Without Introspector)

You can also query models directly:

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

## Model Naming Conventions

Odoo follows these conventions:

| Pattern | Example | Description |
|---------|---------|-------------|
| `module.model` | `crm.lead` | Main model from module |
| `model.line` | `sale.order.line` | Line items |
| `model.tag` | `crm.tag` | Tags for categorization |
| `model.stage` | `crm.stage` | Stage definitions |
| `res.*` | `res.partner` | Resources (base entities) |
| `ir.*` | `ir.model` | Internal registry |

## Finding Custom Models

Custom/third-party models often have patterns:

```typescript
// Find custom models (x_ prefix)
const customModels = await client.searchRead(
  'ir.model',
  [['model', 'like', 'x_%']],
  { fields: ['model', 'name'] }
);

// Find models from specific vendor module
const vendorModels = await client.searchRead(
  'ir.model',
  [['modules', 'ilike', '%vendor_module%']],
  { fields: ['model', 'name'] }
);
```

## Practical Example: Discovering Available Features

```typescript
import { OdooClient, ModuleManager } from '@odoo-toolbox/client';
import { Introspector } from '@odoo-toolbox/introspection';

const client = new OdooClient({...});
await client.authenticate();

const moduleManager = new ModuleManager(client);
const introspector = new Introspector(client);

// Check what's available
const features = {
  crm: await moduleManager.isModuleInstalled('crm'),
  sales: await moduleManager.isModuleInstalled('sale'),
  inventory: await moduleManager.isModuleInstalled('stock'),
  accounting: await moduleManager.isModuleInstalled('account'),
  projects: await moduleManager.isModuleInstalled('project'),
};

console.log('Available features:', features);

// Get models for each installed feature
for (const [feature, installed] of Object.entries(features)) {
  if (installed) {
    const models = await introspector.getModels({ modules: [feature] });
    console.log(`\n${feature} models:`);
    models.forEach(m => console.log(`  - ${m.model}`));
  }
}

await client.logout();
```

## Related Documents

- [analyzing-fields.md](./analyzing-fields.md) - Understanding model fields
- [modules.md](../04-patterns/modules.md) - Module management
