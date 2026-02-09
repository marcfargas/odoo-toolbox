# Module Management

Working with Odoo modules: checking, installing, and dependencies.

## Overview

Odoo functionality is organized into modules. Before using module-specific features (CRM, Sales, etc.), you must verify the module is installed.

## Using the Module Service Accessor

```typescript
import { createClient } from '@marcfargas/odoo-client';

const client = await createClient();

// Check if a module is installed
const hasCRM = await client.modules.isModuleInstalled('crm');

// Install a module (admin only)
await client.modules.installModule('sale');
```

## Checking Module Installation

### Single Module

```typescript testable id="modules-check" needs="client" expect="result.hasBase === true"
// 'base' module is always installed
const hasBase = await client.modules.isModuleInstalled('base');

// Check for a module that likely doesn't exist
const hasFake = await client.modules.isModuleInstalled('fake_nonexistent_module');

return { hasBase, hasFake };
```

### Multiple Modules

```typescript testable id="modules-check-multiple" needs="client" expect="result.checkedCount === 3"
const modules = ['base', 'web', 'mail'];  // Common modules
const installed = {};

for (const mod of modules) {
  installed[mod] = await client.modules.isModuleInstalled(mod);
}

// base should always be installed
return { checkedCount: Object.keys(installed).length, hasBase: installed.base };
```

## Installing Modules

> ⚠️ **Admin-only operation.** Module installation changes the database schema irreversibly.
> Agents must NEVER install modules without explicit user/admin confirmation.
> Use `isModuleInstalled()` freely to check status; call `installModule()` only when
> the user has explicitly requested it.

### Basic Installation

```typescript
const moduleName = 'crm';

const isInstalled = await client.modules.isModuleInstalled(moduleName);

if (!isInstalled) {
  console.log(`Installing ${moduleName}...`);
  await client.modules.installModule(moduleName);
  console.log(`${moduleName} installed successfully`);
}
```

### Installing Multiple Modules

```typescript
const requiredModules = ['crm', 'sale', 'project'];

for (const moduleName of requiredModules) {
  const isInstalled = await client.modules.isModuleInstalled(moduleName);

  if (!isInstalled) {
    console.log(`Installing ${moduleName}...`);
    await client.modules.installModule(moduleName);
    console.log(`${moduleName} installed`);
  } else {
    console.log(`${moduleName} already installed`);
  }
}
```

### Handling Dependencies

Installing a module automatically installs its dependencies:

```typescript
// Installing 'sale' will also install:
// - product
// - account (if not already installed)
// - other dependencies

await client.modules.installModule('sale');
```

## Uninstalling Modules

> 🔴 **Destructive, irreversible operation.** Uninstalling removes the module AND all its data
> (records, fields, views). There is no undo. Agents must NEVER uninstall modules without
> explicit admin confirmation. Always confirm with the user first.

### Basic Uninstallation

```typescript
const moduleName = 'lunch';  // Example module

try {
  const isInstalled = await client.modules.isModuleInstalled(moduleName);

  if (!isInstalled) {
    console.log(`${moduleName} is not installed`);
  } else {
    console.log(`Uninstalling ${moduleName}...`);
    await client.modules.uninstallModule(moduleName);
    console.log(`${moduleName} uninstalled`);
  }
} catch (error) {
  console.error(`Cannot uninstall: ${error.message}`);
  console.log('The module may have dependencies that prevent uninstallation');
}
```

### Uninstallation Warnings

- **Data Loss**: Uninstalling removes related data
- **Dependencies**: Cannot uninstall if other modules depend on it
- **Core Modules**: Some modules cannot be uninstalled

## Listing Modules

### All Installed Modules

```typescript testable id="modules-list" needs="client" expect="result.hasBase === true"
const installed = await client.searchRead(
  'ir.module.module',
  [['state', '=', 'installed']],
  {
    fields: ['name', 'shortdesc', 'state'],
    order: 'name asc'
  }
);

// 'base' should always be in the list
const baseModule = installed.find(m => m.name === 'base');

return { count: installed.length, hasBase: !!baseModule };
```

### Available (Not Installed) Modules

```typescript
const available = await client.searchRead(
  'ir.module.module',
  [['state', '=', 'uninstalled']],
  {
    fields: ['name', 'shortdesc'],
    order: 'name asc'
  }
);

console.log('Available modules:');
available.forEach(m => {
  console.log(`- ${m.name}: ${m.shortdesc}`);
});
```

### Module States

| State | Description |
|-------|-------------|
| `installed` | Module is installed and active |
| `uninstalled` | Module is available but not installed |
| `to install` | Scheduled for installation |
| `to remove` | Scheduled for removal |
| `to upgrade` | Scheduled for upgrade |

## Common Module Groups

### Sales & CRM

| Module | Technical Name | Key Models |
|--------|----------------|------------|
| CRM | `crm` | `crm.lead`, `crm.team`, `crm.stage` |
| Sales | `sale` | `sale.order`, `sale.order.line` |
| Quotations | `sale_management` | Templates, options |

### Operations

| Module | Technical Name | Key Models |
|--------|----------------|------------|
| Inventory | `stock` | `stock.picking`, `stock.move` |
| Purchase | `purchase` | `purchase.order` |
| Manufacturing | `mrp` | `mrp.production` |

### Finance

| Module | Technical Name | Key Models |
|--------|----------------|------------|
| Invoicing | `account` | `account.move`, `account.account` |
| Expenses | `hr_expense` | `hr.expense` |

### Productivity

| Module | Technical Name | Key Models |
|--------|----------------|------------|
| Project | `project` | `project.project`, `project.task` |
| Calendar | `calendar` | `calendar.event` |
| Notes | `note` | `note.note` |

## Module-Aware Code Pattern

```typescript
// Check CRM before using it
if (await client.modules.isModuleInstalled('crm')) {
  const leads = await client.searchRead('crm.lead', [], {
    fields: ['name', 'partner_id'],
    limit: 10
  });
  console.log(`Found ${leads.length} leads`);
} else {
  console.log('CRM module not available');
}
```

## Feature Detection

Instead of checking module names, you can check for models:

```typescript testable id="modules-feature-detection" needs="client" expect="result.hasPartner === true && result.hasFake === false"
// Check if a model exists (feature detection)
async function hasModel(client, model) {
  const count = await client.searchCount('ir.model', [
    ['model', '=', model]
  ]);
  return count > 0;
}

// res.partner always exists
const hasPartner = await hasModel(client, 'res.partner');

// Non-existent model
const hasFake = await hasModel(client, 'fake.nonexistent.model');

return { hasPartner, hasFake };
```

## Direct Query (Without Service Accessor)

```typescript testable id="modules-direct-query" needs="client" expect="result.baseInstalled === true"
// Check if 'base' module is installed (always true)
const modules = await client.searchRead(
  'ir.module.module',
  [
    ['name', '=', 'base'],
    ['state', '=', 'installed']
  ],
  { fields: ['name', 'state'] }
);

const baseInstalled = modules.length > 0;

return { baseInstalled, moduleName: modules[0]?.name };
```

## Installation Time Considerations

Module installation can take from seconds to minutes depending on:
- Module complexity
- Database size
- Dependencies being installed
- Server resources

```typescript
console.log('Installing sale module (this may take a minute)...');
const startTime = Date.now();

await client.modules.installModule('sale');

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`Installation completed in ${elapsed}s`);
```

## Error Handling

```typescript
try {
  await client.modules.installModule('nonexistent_module');
} catch (error) {
  if (error.message.includes('not found')) {
    console.log('Module does not exist');
  } else if (error.message.includes('already installed')) {
    console.log('Module is already installed');
  } else {
    console.error('Installation failed:', error.message);
  }
}
```

## Related Documents

- [introspection.md](./introspection.md) - Finding models
- [connection.md](./connection.md) - Connecting to Odoo
