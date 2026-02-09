# @marcfargas/odoo-client

Lightweight TypeScript client for Odoo RPC operations.

## Features

- `createClient()` one-liner: reads env vars, authenticates, ready to use
- CRUD operations: `searchRead`, `search`, `create`, `write`, `unlink`, `read`, `searchCount`
- Service accessors: `client.mail.*` (chatter), `client.modules.*` (module management)
- Safety guards for dangerous operations
- JSON-RPC transport with session management
- Comprehensive error types: `OdooAuthError`, `OdooNetworkError`, `OdooValidationError`

## Installation

```bash
npm install @marcfargas/odoo-client
```

**Prerequisites**: Node.js ≥ 18, a running Odoo v17 instance.

## Quick Start

```typescript
import { createClient } from '@marcfargas/odoo-client';

// Reads ODOO_URL, ODOO_DB, ODOO_USER, ODOO_PASSWORD from environment
const client = await createClient();

// Search
const partners = await client.searchRead('res.partner',
  [['name', 'ilike', 'John']],
  ['name', 'email']
);

// Create
const newId = await client.create('res.partner', { name: 'Acme Corp' });

// Update
await client.write('res.partner', [newId], { email: 'info@acme.com' });

// Delete (requires safety context)
await client.unlink('res.partner', [newId]);
```

**Environment variables** (required for `createClient()`):

```bash
export ODOO_URL=http://localhost:8069
export ODOO_DB=odoo_dev
export ODOO_USER=admin
export ODOO_PASSWORD=admin
```

## Service Accessors

### Mail (Chatter)

```typescript
// Internal note (visible only to internal users)
await client.mail.postInternalNote('res.partner', partnerId, {
  body: '<p>Customer called about invoice</p>',
});

// Public message (visible to followers including portal users)
await client.mail.postOpenMessage('res.partner', partnerId, {
  body: '<p>Your order has been shipped</p>',
});
```

### Module Management

```typescript
// Check if a module is installed
const hasCRM = await client.modules.isModuleInstalled('crm');

// List installed modules
const installed = await client.modules.listModules({ state: 'installed' });

// Get module info
const info = await client.modules.getModuleInfo('sale');
```

> ⚠️ `installModule()` and `uninstallModule()` are admin-only, irreversible operations.
> Never call them without explicit user confirmation.

## Advanced: Manual Client Construction

For custom configurations, use `OdooClient` directly:

```typescript
import { OdooClient } from '@marcfargas/odoo-client';

const client = new OdooClient({
  url: 'http://localhost:8069',
  database: 'odoo_dev',
  username: 'admin',
  password: 'admin',
  context: { lang: 'en_US' },
  timeoutMs: 30000,
});
await client.authenticate();
```

## Tested Examples

For comprehensive, tested examples of Odoo patterns — CRUD, search, domains, field types, and more — see the [knowledge modules](../../skills/odoo/SKILL.md).

## Related Packages

- [@marcfargas/odoo-introspection](../odoo-introspection) — Schema introspection and code generation
- [@marcfargas/odoo-state-manager](../odoo-state-manager) — State management and drift detection
- [@marcfargas/create-odoo-skills](../create-skills) — CLI for scaffolding AI agent skill projects

## Bugs & Support

[GitHub Issues](https://github.com/marcfargas/odoo-toolbox/issues)

## License

LGPL-3.0 — see [LICENSE](./LICENSE)
