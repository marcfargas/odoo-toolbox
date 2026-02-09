# @marcfargas/odoo-client

Lightweight TypeScript client for Odoo RPC operations.

## Features

- JSON-RPC support
- CRUD operations (create, read, search, write, delete)
- Module management (install, uninstall, upgrade)
- Context and domain filter support
- Batch operation support
- Full TypeScript support with generics
- Comprehensive error handling

## Installation

```bash
npm install @marcfargas/odoo-client
```

## Quick Start

```typescript
import { OdooClient } from '@marcfargas/odoo-client';

// Create client
const client = new OdooClient({
  url: 'http://localhost:8069',
  database: 'odoo_dev',
  username: 'admin',
  password: 'admin',
});

// Authenticate
await client.authenticate();

// Search
const ids = await client.search('res.partner', [['name', 'ilike', 'John']]);

// Read
const records = await client.read('res.partner', ids, ['name', 'email']);

// Create
const newId = await client.create('res.partner', { name: 'Acme Corp' });

// Update
await client.write('res.partner', [newId], { email: 'info@acme.com' });

// Delete
await client.unlink('res.partner', [newId]);
```

## Module Management

```typescript
import { OdooClient, ModuleManager } from '@marcfargas/odoo-client';

const client = new OdooClient({ /* config */ });
await client.authenticate();

const moduleManager = new ModuleManager(client);

// List installed modules
const installed = await moduleManager.listModules({ state: 'installed' });

// Check if module is installed
const isInstalled = await moduleManager.isModuleInstalled('project');

// Get module information
const moduleInfo = await moduleManager.getModuleInfo('sale');
console.log(`${moduleInfo.name}: ${moduleInfo.summary}`);

// Install a module
await moduleManager.installModule('project');

// Uninstall a module
await moduleManager.uninstallModule('project');

// Upgrade a module
await moduleManager.upgradeModule('sale');
```

See [examples/5-module-management.ts](./examples/5-module-management.ts) for complete examples.

## Connection Configuration

```typescript
const client = new OdooClient({
  url: 'http://localhost:8069',           // Odoo base URL
  database: 'odoo_dev',                   // Database name
  username: 'admin',                      // Username
  password: 'admin',                      // Password
  context: { lang: 'en_US' },            // Default context (optional)
  timeoutMs: 30000,                      // Request timeout (optional)
  headers: { 'X-Custom': 'value' },      // Custom headers (optional)
});

await client.authenticate();
```

**Environment Variables** (recommended for scripts/CI):

```bash
export ODOO_URL=http://localhost:8069
export ODOO_DB=odoo_dev
export ODOO_USER=admin
export ODOO_PASSWORD=admin
```

## Code Generation

To generate TypeScript interfaces from your Odoo schema, use [@marcfargas/odoo-introspection](../odoo-introspection):

```bash
npm install @marcfargas/odoo-introspection

# Generate types
odoo-introspect generate \
  --url http://localhost:8069 \
  --db odoo_dev \
  --password admin \
  --output src/models
```

## Tested Examples

For comprehensive, tested examples of Odoo patterns including CRUD operations, search patterns, and field handling, see the knowledge base in [@marcfargas/create-odoo-skills](../create-skills/assets/base/).

## Related Packages

- [@marcfargas/odoo-introspection](../odoo-introspection) - Schema introspection and code generation
- [@marcfargas/odoo-state-manager](../odoo-state-manager) - State management and drift detection
- [@marcfargas/create-odoo-skills](../create-skills) - CLI for scaffolding AI agent skill projects

## License

LGPL-3.0
