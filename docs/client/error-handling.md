# Error Handling

`@marcfargas/odoo-client` uses a typed error hierarchy that maps to the main failure modes when working with Odoo.

## Error Classes

| Class | Extends | When thrown |
|-------|---------|-------------|
| `OdooError` | `Error` | Base class. Also thrown for missing config / env vars. |
| `OdooAuthError` | `OdooError` | Invalid username or password; session expired. |
| `OdooNetworkError` | `OdooError` | Server unreachable; DNS failure; connection refused. |
| `OdooValidationError` | `OdooError` | Odoo rejected the operation (constraint violation, missing required field, business logic error). |

Import them from the main package:

```typescript
import {
  OdooError,
  OdooAuthError,
  OdooNetworkError,
  OdooValidationError,
} from '@marcfargas/odoo-client';
```

## Common Error Patterns

### Connection errors

```typescript
import { createClient, OdooAuthError, OdooNetworkError, OdooError } from '@marcfargas/odoo-client';

try {
  const client = await createClient();
} catch (error) {
  if (error instanceof OdooAuthError) {
    // Wrong credentials, account locked, or session expired
    console.error('Authentication failed — check ODOO_USER and ODOO_PASSWORD');
    process.exit(1);

  } else if (error instanceof OdooNetworkError) {
    // Odoo server is down, wrong URL, network firewall
    console.error('Cannot reach Odoo:', error.message);
    process.exit(1);

  } else if (error instanceof OdooError) {
    // Missing env vars: ODOO_URL, ODOO_DB, etc.
    console.error('Configuration error:', error.message);
    process.exit(1);
  }
}
```

### Record operation errors

```typescript
import { OdooValidationError, OdooError } from '@marcfargas/odoo-client';

try {
  await client.create('crm.lead', {
    // Intentionally omitting required 'name' field
    partner_id: 1,
  });
} catch (error) {
  if (error instanceof OdooValidationError) {
    // Odoo constraint or validation failure:
    // - Missing required field
    // - Unique constraint violation
    // - Python _check_* method raised UserError
    // - ORM access rights check failed
    console.error('Validation error:', error.message);

  } else if (error instanceof OdooError) {
    // Other Odoo-level errors (server error, JSON-RPC error)
    console.error('Odoo error:', error.message);
  }
}
```

### Checking model access

```typescript
try {
  await client.searchRead('project.task', [], { fields: ['name'], limit: 1 });
} catch (error) {
  if (error instanceof OdooValidationError) {
    // User lacks read access on project.task, or module is not installed
    console.error('Access denied or module not installed');
  }
}
```

## Graceful Degradation Pattern

When a feature depends on an optional module, check first:

```typescript
import { createClient } from '@marcfargas/odoo-client';

const client = await createClient();

// Check before using module-specific features
if (await client.modules.isModuleInstalled('hr_attendance')) {
  const status = await client.attendance.getStatus();
  console.log(`Attendance: ${status.checkedIn ? 'in' : 'out'}`);
} else {
  console.log('Attendance module not available');
}
```

## Retry Pattern

For transient network errors, a simple exponential backoff helps:

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delayMs = 500
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!(error instanceof OdooNetworkError)) {
        throw error; // Don't retry non-network errors
      }
      lastError = error;
      if (attempt < maxAttempts) {
        console.warn(`Attempt ${attempt} failed, retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
  }

  throw lastError!;
}

// Usage
const partners = await withRetry(() =>
  client.searchRead('res.partner', [], { fields: ['name'], limit: 10 })
);
```

## `OdooValidationError` vs Odoo Server Errors

`OdooValidationError` covers two distinct Odoo error types:

1. **ORM validation errors** — Python model `_check_*` methods, constraint violations, required fields
2. **Access rights errors** — user lacks read/write/create/unlink permission on a model or record

The error message (`.message`) comes directly from Odoo's server response and is usually human-readable and actionable.

## Safety: Check Before Destructive Operations

Before running destructive operations, validate inputs and check existence:

```typescript
async function safeUnlink(client: any, model: string, id: number): Promise<boolean> {
  // Check the record still exists before deleting
  const exists = await client.searchCount(model, [['id', '=', id]]);
  if (exists === 0) {
    console.warn(`Record ${model}#${id} not found — skipping`);
    return false;
  }

  try {
    await client.unlink(model, id);
    return true;
  } catch (error) {
    if (error instanceof OdooValidationError) {
      console.error(`Cannot delete ${model}#${id}: ${error.message}`);
      return false;
    }
    throw error;
  }
}
```

---

See also:
- [Connection](./connection.md) — `OdooAuthError` and `OdooNetworkError` on connect
- [CRUD Operations](./crud.md) — write/create/unlink error patterns

For agent-optimized CLI examples, see the [odoo skill](../skills/odoo/).
