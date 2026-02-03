# Connecting to Odoo

How to establish an authenticated connection to an Odoo instance.

> **MCP Tool**: Use `odoo_authenticate` for connection. The MCP server handles authentication automatically if environment variables are configured.

## Overview

All Odoo operations require an authenticated connection. When using the MCP server, authentication is handled via the `odoo_authenticate` tool or automatically through environment variables. The underlying `@odoo-toolbox/client` package provides `OdooClient` for direct JavaScript usage.

## Connection Parameters

| Parameter | Environment Variable | Description |
|-----------|---------------------|-------------|
| `url` | `ODOO_URL` | Odoo server URL (e.g., `http://localhost:8069`) |
| `database` | `ODOO_DB` or `ODOO_DATABASE` | Database name |
| `username` | `ODOO_USER` or `ODOO_USERNAME` | Login username |
| `password` | `ODOO_PASSWORD` | User password |

## Finding Credentials

### Priority Order

1. **`.odoo.env` file** - Check project root for this file
2. **Environment variables** - Check system environment
3. **`CLAUDE.md`** - Project documentation may contain connection info
4. **Ask the user** - If none found, request credentials

### .odoo.env Format

```bash
# Odoo Connection Configuration
ODOO_URL=http://localhost:8069
ODOO_DB=my_database
ODOO_USER=admin
ODOO_PASSWORD=my_secure_password
```

> **Security**: Always add `.odoo.env` to `.gitignore`

## Basic Connection

```typescript testable id="connection-basic" needs="none"
import { OdooClient } from '@odoo-toolbox/client';

const client = new OdooClient({
  url: process.env.ODOO_URL || 'http://localhost:8069',
  database: process.env.ODOO_DB || 'odoo',
  username: process.env.ODOO_USER || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
});

await client.authenticate();
console.log('Connected!');

// Always logout when done
client.logout();
```

## Connection with Environment Variables

```typescript testable id="connection-session-info" needs="none" expect="result !== null && result.uid > 0"
import { OdooClient } from '@odoo-toolbox/client';

const client = new OdooClient({
  url: process.env.ODOO_URL || 'http://localhost:8069',
  database: process.env.ODOO_DB || 'odoo',
  username: process.env.ODOO_USER || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
});

await client.authenticate();

// Get session information
const session = client.getSession();
console.log(`User ID: ${session?.uid}`);
console.log(`Database: ${session?.db}`);

client.logout();
return session; // Return session for testing
```

## Error Handling

The client throws specific error types:

| Error Type | Cause |
|------------|-------|
| `OdooAuthError` | Invalid username/password or user doesn't exist |
| `OdooNetworkError` | Cannot reach server, DNS failure, connection refused |
| `OdooError` | General Odoo errors (permissions, invalid operations) |

```typescript
import {
  OdooClient,
  OdooAuthError,
  OdooNetworkError
} from '@odoo-toolbox/client';

const client = new OdooClient({
  url: process.env.ODOO_URL || 'http://localhost:8069',
  database: process.env.ODOO_DB || 'odoo',
  username: process.env.ODOO_USER || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
});

try {
  await client.authenticate();
  // Perform operations...
} catch (error) {
  if (error instanceof OdooAuthError) {
    console.error('Authentication failed - check username/password');
  } else if (error instanceof OdooNetworkError) {
    console.error('Cannot reach Odoo - check URL and network');
  } else {
    console.error('Unexpected error:', error);
  }
} finally {
  await client.logout();
}
```

## Session Information

After authentication, you can access session details:

```typescript
const session = client.getSession();

// Available properties:
session?.uid        // User ID (number)
session?.db         // Database name (string)
session?.username   // Login username (string)
session?.context    // User context (language, timezone, etc.)
```

## Connection Lifecycle

```
┌──────────────┐
│ Create       │  new OdooClient({...})
│ OdooClient   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Authenticate │  await client.authenticate()
│              │  → Establishes session
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Perform      │  client.search(), client.create(), etc.
│ Operations   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Logout       │  await client.logout()
│              │  → Closes session
└──────────────┘
```

## Important Notes

1. **Always logout** - Clean up sessions to avoid resource leaks
2. **One database per client** - Create separate clients for different databases
3. **Session timeout** - Long-running scripts may need re-authentication
4. **HTTPS in production** - Always use HTTPS for remote connections

## Related Documents

- [field-types.md](./field-types.md) - Understanding Odoo field types
- [domains.md](./domains.md) - Query filters
