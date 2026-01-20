# @odoo-toolbox/client

TypeScript client for Odoo with schema introspection and code generation.

## Features

- JSON-RPC and XML-RPC support
- Schema introspection
- TypeScript code generation
- Context and domain filter support
- Batch operations

## Connection

Provide connection details when creating `OdooClient`:

```typescript
import { OdooClient } from '@odoo-toolbox/client';

const client = new OdooClient({
	url: process.env.ODOO_URL || 'http://localhost:8069',
	database: process.env.ODOO_DB_NAME || 'odoo',
	username: process.env.ODOO_DB_USER || 'admin',
	password: process.env.ODOO_DB_PASSWORD || 'admin',
	// Optional: timeoutMs, headers, context
});

await client.authenticate();
```

### Options

- `url`: Odoo base URL (HTTP/HTTPS)
- `database`: Database name
- `username` / `password`: Credentials
- `context`: Default context for all calls (overridable per call)
- `timeoutMs` (optional): Request timeout
- `headers` (optional): Additional HTTP headers

Environment variable overrides (recommended for scripts/CI):

```
ODOO_URL=http://localhost:8069
ODOO_DB_NAME=odoo
ODOO_DB_USER=admin
ODOO_DB_PASSWORD=admin
```

## Installation

```bash
npm install @odoo-toolbox/client
```

## Usage

See main [README](../../README.md) and [examples/](../../examples/README.md) for runnable samples.

### Generated Types (Overview)

Types are generated from your live Odoo schema. Fields marked required remain required; optional fields are `type | undefined`. Relational fields map to IDs/arrays of IDs.

```typescript
// Odoo model: res.partner
export interface ResPartner {
	id: number;
	name: string;
	email?: string | undefined;
	is_company?: boolean | undefined;
	country_id?: number | undefined; // many2one -> number
	category_id?: number[] | undefined; // many2many -> number[]
}
```

Generated helper types:

```typescript
export interface SearchOptions {
	domain?: any[];
	order?: string;
	limit?: number;
	offset?: number;
	context?: Record<string, any>;
}

export interface ReadOptions {
	fields?: string[];
	context?: Record<string, any>;
}
```

Run generator via CLI (see main README) or programmatically with `CodeGenerator`.

### Error Handling (practical patterns)

Wrap calls in `try/catch` and branch on message/HTTP errors:

```typescript
try {
	const ids = await client.search('res.partner', [['is_company', '=', true]]);
	const records = await client.read('res.partner', ids, ['id', 'name']);
	console.log(records);
} catch (error) {
	if (error instanceof Error) {
		if (error.message.includes('access')) {
			console.error('Access denied: check user permissions');
		} else if (error.message.includes('connect')) {
			console.error('Connection failed: is Odoo running?');
		} else {
			console.error('Unexpected error:', error.message);
		}
	}
}
```

### Troubleshooting (quick checks)

- **Connection refused**: Is Odoo up? Check `ODOO_URL` and Docker status.
- **Invalid credentials**: Verify username/password/database.
- **Access denied**: User lacks model permission; try admin or adjust ACLs.
- **Slow/timeout**: Increase `timeoutMs`; inspect Odoo logs.
- **Schema mismatch**: Regenerate types after changing Odoo modules/fields.

For end-to-end runnable examples, see [examples/](../../examples/README.md).
