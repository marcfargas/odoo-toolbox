# @odoo-toolbox/client

Lightweight TypeScript client for Odoo RPC operations.

## Features

- JSON-RPC support
- CRUD operations (create, read, search, write, delete)
- Context and domain filter support
- Batch operation support
- Full TypeScript support with generics
- Comprehensive error handling

## Installation

```bash
npm install @odoo-toolbox/client
```

## Quick Start

```typescript
import { OdooClient } from '@odoo-toolbox/client';

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

To generate TypeScript interfaces from your Odoo schema, use [@odoo-toolbox/introspection](../odoo-introspection):

```bash
npm install @odoo-toolbox/introspection

# Generate types
odoo-introspect generate \
  --url http://localhost:8069 \
  --db odoo_dev \
  --password admin \
  --output src/models
```

## Related Packages

- [@odoo-toolbox/introspection](../odoo-introspection) - Schema introspection and code generation
- [@odoo-toolbox/state-manager](../odoo-state-manager) - State management and drift detection

## License

LGPL-3.0
