# Module Management

Working with Odoo modules: checking, installing, and dependencies.

> **MCP Tools**: Use `odoo_module_list`, `odoo_module_info`, `odoo_module_install`, `odoo_module_uninstall`, `odoo_module_upgrade` for module operations.

## Overview

Odoo functionality is organized into modules. Before using module-specific features (CRM, Sales, etc.), you must verify the module is installed. When using the MCP server, module operations are available through dedicated tools.

## Using ModuleManager

```typescript
import { OdooClient, ModuleManager } from '@odoo-toolbox/client';

const client = new OdooClient({...});
await client.authenticate();

const moduleManager = new ModuleManager(client);
```

## Checking Module Installation

### Single Module

```typescript testable id="modules-check" needs="module-manager" expect="result.hasBase === true"
// 'base' module is always installed
const hasBase = await moduleManager.isModuleInstalled('base');

// Check for a module that likely doesn't exist
const hasFake = await moduleManager.isModuleInstalled('fake_nonexistent_module');

return { hasBase, hasFake };
```

### Multiple Modules

```typescript testable id="modules-check-multiple" needs="module-manager" expect="result.checkedCount === 3"
const modules = ['base', 'web', 'mail'];  // Common modules
const installed = {};

for (const mod of modules) {
  installed[mod] = await moduleManager.isModuleInstalled(mod);
}

// base should always be installed
return { checkedCount: Object.keys(installed).length, hasBase: installed.base };
```

## Installing Modules

### Basic Installation

```typescript
const moduleName = 'crm';

const isInstalled = await moduleManager.isModuleInstalled(moduleName);

if (!isInstalled) {
  console.log(`Installing ${moduleName}...`);
  await moduleManager.installModule(moduleName);
  console.log(`${moduleName} installed successfully`);
}
```

### Installing Multiple Modules

```typescript
const requiredModules = ['crm', 'sale', 'project'];

for (const moduleName of requiredModules) {
  const isInstalled = await moduleManager.isModuleInstalled(moduleName);

  if (!isInstalled) {
    console.log(`Installing ${moduleName}...`);
    await moduleManager.installModule(moduleName);
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

await moduleManager.installModule('sale');
```

## Uninstalling Modules

### Basic Uninstallation

```typescript
const moduleName = 'lunch';  // Example module

try {
  const isInstalled = await moduleManager.isModuleInstalled(moduleName);

  if (!isInstalled) {
    console.log(`${moduleName} is not installed`);
  } else {
    console.log(`Uninstalling ${moduleName}...`);
    await moduleManager.uninstallModule(moduleName);
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
async function safeOperation(client: OdooClient) {
  const moduleManager = new ModuleManager(client);

  // Check CRM before using it
  if (await moduleManager.isModuleInstalled('crm')) {
    const leads = await client.searchRead('crm.lead', [], {
      fields: ['name', 'partner_id'],
      limit: 10
    });
    return { crm: leads };
  } else {
    return { crm: null, message: 'CRM module not available' };
  }
}
```

## Feature Detection

Instead of checking module names, you can check for models:

```typescript testable id="modules-feature-detection" needs="client" expect="result.hasPartner === true && result.hasFake === false"
// Check if a model exists (feature detection)
async function hasModel(client, model) {
  const count = await client.call('ir.model', 'search_count', [[
    ['model', '=', model]
  ]]);
  return count > 0;
}

// res.partner always exists
const hasPartner = await hasModel(client, 'res.partner');

// Non-existent model
const hasFake = await hasModel(client, 'fake.nonexistent.model');

return { hasPartner, hasFake };
```

## Direct Query (Without ModuleManager)

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

await moduleManager.installModule('sale');

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`Installation completed in ${elapsed}s`);
```

## Error Handling

```typescript
try {
  await moduleManager.installModule('nonexistent_module');
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

- [discovering-models.md](../02-introspection/discovering-models.md) - Finding models
- [connection.md](../01-fundamentals/connection.md) - Connecting to Odoo
