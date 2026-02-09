# Connecting to Odoo

How to establish an authenticated connection to an Odoo instance.

## Quick Start

```typescript
import { createClient } from '@marcfargas/odoo-client';

const client = await createClient();  // reads ODOO_URL, ODOO_DB, ODOO_USER, ODOO_PASSWORD
```

That's it. `createClient()` reads environment variables, creates the client, and authenticates.
The returned client is ready to use — including service accessors like `client.mail.*` and `client.modules.*`.

### Multi-Instance

```typescript
const prod = await createClient('ODOO_PROD');     // reads ODOO_PROD_URL, ODOO_PROD_DB, ...
const staging = await createClient('ODOO_STG');    // reads ODOO_STG_URL, ODOO_STG_DB, ...
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ODOO_URL` | Odoo server URL (e.g., `http://localhost:8069`) |
| `ODOO_DB` or `ODOO_DATABASE` | Database name |
| `ODOO_USER` or `ODOO_USERNAME` | Login username |
| `ODOO_PASSWORD` | User password |

With a prefix (e.g. `createClient('ODOO_PROD')`), all variables use that prefix:
`ODOO_PROD_URL`, `ODOO_PROD_DB`, `ODOO_PROD_USER`, `ODOO_PROD_PASSWORD`.

### .env File Format

```bash
# .odoo.env or .env
ODOO_URL=http://localhost:8069
ODOO_DB=my_database
ODOO_USER=admin
ODOO_PASSWORD=my_secure_password
```

> **Security**: Always add `.odoo.env` / `.env` to `.gitignore`

### Finding Credentials

1. **`.odoo.env` file** — check project root
2. **Environment variables** — check system environment
3. **Ask the user** — if none found, request credentials

## Manual Connection (Advanced)

If you need control over the lifecycle (custom safety context, deferred auth):

```typescript testable id="connection-basic" needs="none"
import { OdooClient } from '@marcfargas/odoo-client';

const client = new OdooClient({
  url: process.env.ODOO_URL || 'http://localhost:8069',
  database: process.env.ODOO_DB || 'odoo',
  username: process.env.ODOO_USER || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
});
await client.authenticate();

const session = client.getSession();
console.log('Connected!');
console.log(`User ID: ${session?.uid}`);
console.log(`Database: ${session?.db}`);

client.logout();
```

## Session Information

After authentication:

```typescript
const session = client.getSession();

session?.uid        // User ID (number)
session?.db         // Database name (string)
session?.username   // Login username (string)
session?.context    // User context (language, timezone, etc.)
```

## Error Handling

| Error Type | Cause |
|------------|-------|
| `OdooError` | Missing environment variables in `createClient()`/`configFromEnv()` |
| `OdooAuthError` | Invalid username/password |
| `OdooNetworkError` | Cannot reach server |

```typescript
import { createClient, OdooAuthError, OdooNetworkError, OdooError } from '@marcfargas/odoo-client';

try {
  const client = await createClient();
  // ... work with Odoo ...
} catch (error) {
  if (error instanceof OdooAuthError) {
    console.error('Authentication failed — check username/password');
  } else if (error instanceof OdooNetworkError) {
    console.error('Cannot reach Odoo — check URL and network');
  } else if (error instanceof OdooError) {
    console.error('Config error:', error.message); // e.g. missing env vars
  }
}
```

## Connection Lifecycle

```
createClient()          ← recommended, does everything below in one call
  ├─ configFromEnv()    ← reads ODOO_* env vars
  ├─ new OdooClient()   ← creates transport
  └─ authenticate()     ← establishes session

client.mail.*           ← service accessors (lazy, created on first use)
client.modules.*
client.search/read/...  ← core CRUD

client.logout()         ← clean up when done
```

## Important Notes

1. **Always logout** — clean up sessions to avoid resource leaks
2. **One database per client** — create separate clients for different databases
3. **Session timeout** — long-running scripts may need re-authentication
4. **HTTPS in production** — always use HTTPS for remote connections

## Related Documents

- [field-types.md](./field-types.md) — Understanding Odoo field types
- [domains.md](./domains.md) — Query filters
