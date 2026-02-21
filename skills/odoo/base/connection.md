# Connecting to Odoo

```typescript
import { createClient } from '@marcfargas/odoo-client';

const client = await createClient();  // reads ODOO_URL, ODOO_DB, ODOO_USER, ODOO_PASSWORD
```

### Multi-Instance

```typescript
const prod = await createClient('ODOO_PROD');     // reads ODOO_PROD_URL, ODOO_PROD_DB, ...
const staging = await createClient('ODOO_STG');    // reads ODOO_STG_URL, ODOO_STG_DB, ...
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ODOO_URL` | Server URL (e.g., `http://localhost:8069`) |
| `ODOO_DB` or `ODOO_DATABASE` | Database name |
| `ODOO_USER` or `ODOO_USERNAME` | Login username |
| `ODOO_PASSWORD` | User password |

With a prefix (e.g. `createClient('ODOO_PROD')`), all variables use that prefix:
`ODOO_PROD_URL`, `ODOO_PROD_DB`, `ODOO_PROD_USER`, `ODOO_PROD_PASSWORD`.

## Manual Connection

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

## Error Handling

| Error Type | Cause |
|------------|-------|
| `OdooError` | Missing environment variables |
| `OdooAuthError` | Invalid username/password |
| `OdooNetworkError` | Cannot reach server |

```typescript
import { createClient, OdooAuthError, OdooNetworkError, OdooError } from '@marcfargas/odoo-client';

try {
  const client = await createClient();
} catch (error) {
  if (error instanceof OdooAuthError) {
    console.error('Authentication failed — check username/password');
  } else if (error instanceof OdooNetworkError) {
    console.error('Cannot reach Odoo — check URL and network');
  } else if (error instanceof OdooError) {
    console.error('Config error:', error.message);
  }
}
```

Always call `client.logout()` when done.
