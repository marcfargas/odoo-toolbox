# Connection

How to connect to Odoo using `@marcfargas/odoo-client`.

## `createClient()` — Standard Connection

The recommended way to connect. Reads credentials from environment variables, authenticates, and returns a ready-to-use `OdooClient` instance:

```typescript testable id="conn-create-client" needs="none"
import { createClient } from '@marcfargas/odoo-client';

const client = await createClient();
// Session is active — ready to make RPC calls

const session = client.getSession();
console.log(`Connected: uid=${session?.uid}, db=${session?.db}`);

client.logout();
```

`createClient()` reads these environment variables:

| Variable | Aliases | Description |
|----------|---------|-------------|
| `ODOO_URL` | — | Server URL (e.g., `https://mycompany.odoo.com`) |
| `ODOO_DB` | `ODOO_DATABASE` | Database name |
| `ODOO_USER` | `ODOO_USERNAME` | Login username |
| `ODOO_PASSWORD` | — | User password |

## Multi-Instance Connections

Connect to multiple Odoo servers simultaneously using a prefix:

```typescript testable id="conn-multi-instance" needs="none"
import { createClient } from '@marcfargas/odoo-client';

// With prefix 'ODOO_PROD', reads ODOO_PROD_URL, ODOO_PROD_DB, ODOO_PROD_USER, ODOO_PROD_PASSWORD
const prod = await createClient('ODOO_PROD');

// With prefix 'ODOO_STG', reads ODOO_STG_URL, ODOO_STG_DB, etc.
const staging = await createClient('ODOO_STG');

// Both clients are independent, each with their own session
const prodPartners = await prod.searchRead('res.partner', [], { fields: ['name'], limit: 5 });
const stagingPartners = await staging.searchRead('res.partner', [], { fields: ['name'], limit: 5 });

console.log(`Prod: ${prodPartners.length} partners, Staging: ${stagingPartners.length} partners`);

prod.logout();
staging.logout();
```

**Example `.env` for multi-instance:**

```bash
# Production
ODOO_PROD_URL=https://prod.mycompany.com
ODOO_PROD_DB=mycompany_prod
ODOO_PROD_USER=admin@mycompany.com
ODOO_PROD_PASSWORD=prod-secret

# Staging
ODOO_STG_URL=https://staging.mycompany.com
ODOO_STG_DB=mycompany_staging
ODOO_STG_USER=admin@mycompany.com
ODOO_STG_PASSWORD=staging-secret
```

## Manual `OdooClient` Constructor

For dynamic credentials, use `OdooClient` directly instead of `createClient()`:

```typescript testable id="conn-manual" needs="none"
import { OdooClient } from '@marcfargas/odoo-client';

const client = new OdooClient({
  url: 'http://localhost:8069',
  database: 'odoo',
  username: 'admin',
  password: 'admin',
});

await client.authenticate();

const session = client.getSession();
console.log(`Connected as uid=${session?.uid}`);

client.logout();
```

### Constructor Options

| Option | Type | Description |
|--------|------|-------------|
| `url` | `string` | Server URL |
| `database` | `string` | Database name |
| `username` | `string` | Login username |
| `password` | `string` | User password |

## Session Management

After successful authentication, the session contains:

```typescript
const session = client.getSession();

console.log(session?.uid);       // User ID (number)
console.log(session?.db);        // Database name
console.log(session?.username);  // Username
```

`getSession()` returns `null` before `authenticate()` is called or after `logout()`.

### Logout

Always call `logout()` when done to clean up the session:

```typescript
// Synchronous — clears local session state
client.logout();
```

Logout does not make an RPC call; it simply clears the local session. The server session eventually expires on its own.

## Error Handling

Three error classes cover the main failure modes:

| Error Class | When thrown |
|-------------|-------------|
| `OdooError` | Missing or invalid configuration (env vars not set) |
| `OdooAuthError` | Wrong username/password, account locked |
| `OdooNetworkError` | Server unreachable, DNS failure, connection refused |

```typescript
import { createClient, OdooAuthError, OdooNetworkError, OdooError } from '@marcfargas/odoo-client';

try {
  const client = await createClient();
  // ... use client
} catch (error) {
  if (error instanceof OdooAuthError) {
    console.error('Authentication failed — check ODOO_USER and ODOO_PASSWORD');
  } else if (error instanceof OdooNetworkError) {
    console.error('Cannot reach Odoo — check ODOO_URL and network connectivity');
  } else if (error instanceof OdooError) {
    console.error('Configuration error:', error.message);
    // e.g., "ODOO_URL environment variable is not set"
  } else {
    throw error; // Unknown error — rethrow
  }
}
```

## Connection Tips

**Always specify explicit field lists** in `searchRead` — fetching all fields is slow:

```typescript
// ✅ Fast — fetch only what you need
const partners = await client.searchRead('res.partner', [], {
  fields: ['name', 'email'],
  limit: 100,
});

// ❌ Slow — fetches all 50+ fields per record
const partners = await client.searchRead('res.partner', []);
```

**The `base` module is always installed**, so `res.partner`, `res.users`, `ir.model`, etc. are always available.

---

See also:
- [Error Handling](./error-handling.md) — full error class reference and retry patterns
- [Getting Started](../getting-started.md) — environment variable setup

For agent-optimized CLI examples, see the [odoo skill](../skills/odoo/).
