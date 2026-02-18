# Module Management

Check, install, and uninstall Odoo modules.

```typescript
const client = await createClient();

const hasCRM = await client.modules.isModuleInstalled('crm');
```

## Check Module Installation

```typescript testable id="modules-check" needs="client" expect="result.hasBase === true"
const hasBase = await client.modules.isModuleInstalled('base');
const hasFake = await client.modules.isModuleInstalled('fake_nonexistent_module');

return { hasBase, hasFake };
```

```typescript testable id="modules-check-multiple" needs="client" expect="result.checkedCount === 3"
const modules = ['base', 'web', 'mail'];
const installed = {};

for (const mod of modules) {
  installed[mod] = await client.modules.isModuleInstalled(mod);
}

return { checkedCount: Object.keys(installed).length, hasBase: installed.base };
```

## Install Modules

**⚠️ DESTRUCTIVE — changes database schema irreversibly. Admin-only. Always confirm with user.**

```typescript
if (!await client.modules.isModuleInstalled('crm')) {
  await client.modules.installModule('crm');  // Auto-installs dependencies
}
```

## Uninstall Modules

**⚠️ DESTRUCTIVE — deletes ALL module data. Irreversible. Never do without explicit admin confirmation.**

```typescript
await client.modules.uninstallModule('lunch');
```

May fail if other installed modules depend on it.

## List Installed Modules

```typescript testable id="modules-list" needs="client" expect="result.hasBase === true"
const installed = await client.searchRead(
  'ir.module.module',
  [['state', '=', 'installed']],
  {
    fields: ['name', 'shortdesc', 'state'],
    order: 'name asc'
  }
);

const baseModule = installed.find(m => m.name === 'base');

return { count: installed.length, hasBase: !!baseModule };
```

Module states: `installed`, `uninstalled`, `to install`, `to remove`, `to upgrade`.

## Feature Detection

Check for models instead of module names — more robust:

```typescript testable id="modules-feature-detection" needs="client" expect="result.hasPartner === true && result.hasFake === false"
async function hasModel(client, model) {
  const count = await client.searchCount('ir.model', [['model', '=', model]]);
  return count > 0;
}

const hasPartner = await hasModel(client, 'res.partner');
const hasFake = await hasModel(client, 'fake.nonexistent.model');

return { hasPartner, hasFake };
```

## Direct Query

```typescript testable id="modules-direct-query" needs="client" expect="result.baseInstalled === true"
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
