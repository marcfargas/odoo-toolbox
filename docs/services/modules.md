# Modules Service — `client.modules.*`

Check, install, uninstall, and list Odoo modules (addons).

**Safety levels:**
- `isModuleInstalled()`, `listModules()`, `getModuleInfo()` → **READ**
- `installModule()`, `uninstallModule()`, `upgradeModule()` → **DESTRUCTIVE** (schema changes, data loss)

## Quick Reference

```typescript testable id="modules-quick" needs="client" expect="typeof result === 'boolean'"
import { createClient } from '@marcfargas/odoo-client';
const client = await createClient();

const hasCRM = await client.modules.isModuleInstalled('crm');
console.log(`CRM installed: ${hasCRM}`);
return hasCRM;
```

## `isModuleInstalled(moduleName)`

Check whether a module is installed. The most common operation — use it before accessing module-specific models or service methods:

```typescript testable id="modules-check" needs="client" expect="result.hasBase === true && result.hasFake === false"
const hasBase = await client.modules.isModuleInstalled('base');
const hasFake = await client.modules.isModuleInstalled('this_module_does_not_exist');

return { hasBase, hasFake };
```

Pattern for conditional feature usage:

```typescript
if (await client.modules.isModuleInstalled('hr_attendance')) {
  const status = await client.attendance.getStatus();
  // Use attendance features
} else {
  console.log('Attendance tracking not available in this Odoo instance');
}
```

## `listModules(options?)`

List modules with optional filtering. Useful for auditing what's installed:

```typescript testable id="modules-list" needs="client" expect="result.hasBase === true"
// All installed modules
const installed = await client.modules.listModules({ state: 'installed' });

const base = installed.find(m => m.name === 'base');
return { count: installed.length, hasBase: !!base };
```

### Options

| Option | Type | Description |
|--------|------|-------------|
| `state` | `string` | Filter by state: `'installed'`, `'uninstalled'`, `'to install'`, etc. |
| `application` | `boolean` | Filter to only application-level modules |
| `limit` | `number` | Max results |
| `offset` | `number` | Pagination offset |

Module states: `installed`, `uninstalled`, `to install`, `to remove`, `to upgrade`, `uninstallable`

## `getModuleInfo(moduleName)`

Get detailed information about a specific module:

```typescript testable id="modules-info" needs="client" expect="result.name === 'base'"
const info = await client.modules.getModuleInfo('base');

console.log(`${info.name}: ${info.shortdesc}`);
console.log(`Version: ${info.installed_version}`);
console.log(`Author: ${info.author}`);
console.log(`License: ${info.license}`);

return { name: info.name, state: info.state };
```

### `ModuleInfo` Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` | Record ID |
| `name` | `string` | Technical name (e.g., `'project'`) |
| `state` | `string` | Current state |
| `shortdesc` | `string` | Short human description |
| `summary` | `string` | One-line summary |
| `description` | `string` | Full description (only from `getModuleInfo`) |
| `author` | `string` | Module author |
| `installed_version` | `string` | Currently installed version |
| `latest_version` | `string` | Latest available version |
| `license` | `string` | License identifier |
| `application` | `boolean` | Is this a top-level application? |
| `category_id` | `[number, string]` | Module category tuple |

## `installModule(moduleName)` — DESTRUCTIVE

Install a module and all its dependencies. **Admin rights required.**

⚠️ **This modifies the database schema.** Module installation can add models, fields, and menu items. It is difficult to fully reverse — uninstalling a module deletes all its data.

```typescript
// Check first to avoid unnecessary installs
if (!await client.modules.isModuleInstalled('crm')) {
  console.log('Installing CRM module...');
  const result = await client.modules.installModule('crm');
  console.log(`Installed: ${result.name} (state: ${result.state})`);
}
```

Installation:
- Calls `ir.module.module#button_immediate_install` on the server
- Automatically installs dependencies
- Takes several seconds on most instances
- Returns updated `ModuleInfo`

## `uninstallModule(moduleName)` — DESTRUCTIVE

Uninstall a module. **⚠️ IRREVERSIBLE DATA LOSS.**

⚠️ **Uninstalling a module deletes ALL data associated with it.** This cannot be undone. The module's tables and records are removed from the database. Only use with explicit admin confirmation.

```typescript
// Only after explicit user confirmation
await client.modules.uninstallModule('lunch');
```

- Calls `ir.module.module#button_immediate_uninstall`
- Will fail if other installed modules depend on it
- Deletes all records in the module's models

## `upgradeModule(moduleName)`

Upgrade an already-installed module to its latest version:

```typescript
const upgraded = await client.modules.upgradeModule('project');
console.log(`Upgraded to ${upgraded.installed_version}`);
```

## Feature Detection Pattern

Checking model existence is more robust than checking module names (modules can be renamed across versions):

```typescript testable id="modules-feature-detect" needs="client" expect="result.hasPartner === true && result.hasFake === false"
async function modelExists(client: any, model: string): Promise<boolean> {
  const count = await client.searchCount('ir.model', [['model', '=', model]]);
  return count > 0;
}

const hasPartner = await modelExists(client, 'res.partner');      // always true
const hasFake = await modelExists(client, 'fake.nonexistent');    // false

return { hasPartner, hasFake };
```

Use `modelExists` when:
- The module might have different names in different Odoo distributions
- You depend on specific models from OCA modules
- You're writing code that must work across multiple Odoo versions

## Direct Query

For custom filtering beyond what the service methods support:

```typescript testable id="modules-direct" needs="client" expect="result.count > 0"
// All installed apps (not utility modules)
const apps = await client.searchRead('ir.module.module', [
  ['state', '=', 'installed'],
  ['application', '=', true],
], {
  fields: ['name', 'shortdesc', 'category_id'],
  order: 'name asc',
  limit: 50,
});

return { count: apps.length, names: apps.slice(0, 5).map(a => a.name) };
```

---

See also:
- [Getting Started](../getting-started.md) — first connection
- [Attendance](./attendance.md) — requires `hr_attendance` module
- [Timesheets](./timesheets.md) — requires `hr_timesheet` module

For agent-optimized CLI examples, see the [odoo skill](../skills/odoo/).
