# Getting Started

This guide walks you through installing `@marcfargas/odoo-client`, configuring your environment, and making your first connection to an Odoo instance.

## Installation

```bash
npm install @marcfargas/odoo-client
```

## Environment Variables

The client reads connection settings from environment variables. The simplest way to configure these is via a `.env` file at your project root.

| Variable | Aliases | Description | Example |
|----------|---------|-------------|---------|
| `ODOO_URL` | — | Server URL including scheme and port | `http://localhost:8069` |
| `ODOO_DB` | `ODOO_DATABASE` | Database name | `mycompany` |
| `ODOO_USER` | `ODOO_USERNAME` | Login username | `admin` |
| `ODOO_PASSWORD` | — | User password | `admin` |

**Example `.env` file:**

```bash
ODOO_URL=https://mycompany.odoo.com
ODOO_DB=mycompany
ODOO_USER=admin@mycompany.com
ODOO_PASSWORD=your-password-here
```

> Never commit `.env` files to source control. Add `.env` to your `.gitignore`.

## First Connection

`createClient()` reads the environment variables, authenticates, and returns a ready-to-use client:

```typescript testable id="gs-first-connection" needs="none"
import { createClient } from '@marcfargas/odoo-client';

const client = await createClient();
// Client is now authenticated — session is active

const session = client.getSession();
console.log(`Connected as user ID ${session?.uid} on ${session?.db}`);

client.logout();
```

The `createClient()` call handles:
1. Reading `ODOO_URL`, `ODOO_DB`, `ODOO_USER`, `ODOO_PASSWORD` from environment
2. Authenticating via `authenticate()` (XML-RPC `/web/session/authenticate`)
3. Storing the session for all subsequent RPC calls

## First Query

Once connected, use `searchRead` to query any model:

```typescript testable id="gs-first-query" needs="client" expect="result.length >= 0"
// Get the first 10 companies in your Odoo instance
const companies = await client.searchRead('res.partner', [
  ['is_company', '=', true],
], {
  fields: ['name', 'email', 'phone'],
  limit: 10,
  order: 'name asc',
});

for (const company of companies) {
  console.log(`${company.name} — ${company.email ?? 'no email'}`);
}

return companies;
```

Key points:
- The second argument is a **domain** (filter array). Empty `[]` matches all records.
- Always specify `fields` — omitting it fetches every field (slow).
- Always pass `limit` — the default limit is 100 and can silently truncate results.

## Quick Examples

### Create a record

```typescript testable id="gs-create" needs="client" creates="res.partner" expect="id > 0"
import { createClient } from '@marcfargas/odoo-client';

const client = await createClient();

const id = await client.create('res.partner', {
  name: 'Acme Corp',
  email: 'contact@acme.com',
  is_company: true,
});

console.log(`Created partner with ID ${id}`);
return id;
```

### Update a record

```typescript testable id="gs-update" needs="client" creates="res.partner"
const id = await client.create('res.partner', { name: 'Test Partner' });

await client.write('res.partner', id, {
  phone: '+1 555-0100',
  website: 'https://example.com',
});
```

### Post an internal note

```typescript testable id="gs-note" needs="client" creates="res.partner"
const id = await client.create('res.partner', { name: 'Note Test' });

await client.mail.postInternalNote(
  'res.partner',
  id,
  '<p>Called customer — follow up next week.</p>'
);
```

### Check a module

```typescript testable id="gs-module-check" needs="client" expect="typeof result === 'boolean'"
const hasCRM = await client.modules.isModuleInstalled('crm');
console.log(`CRM installed: ${hasCRM}`);
return hasCRM;
```

## Safety Model Overview

Operations are classified by their potential for data loss:

| Level | What it means | Examples |
|-------|--------------|---------|
| **READ** | Safe, no side effects | `search`, `searchRead`, `read`, `searchCount` |
| **WRITE** | Creates or modifies data | `create`, `write`, `postInternalNote` |
| **DESTRUCTIVE** | Permanent or has external effects | `unlink`, `postOpenMessage` (sends email), `installModule` |

Always use `unlink` (delete) carefully — Odoo has no built-in undo. Prefer archiving:

```typescript
// Prefer archiving over deletion — it's reversible
await client.write('res.partner', id, { active: false }); // archive

// To restore
await client.write('res.partner', id, { active: true });

// Only use unlink when you truly mean permanent deletion
await client.unlink('res.partner', id); // ⚠️ permanent
```

## Next Steps

- [Connection guide](./client/connection.md) — multi-instance connections, error handling
- [CRUD operations](./client/crud.md) — full create/read/write/unlink patterns
- [Search patterns](./client/search.md) — filtering, pagination, sorting
- [Field types](./client/field-types.md) — understanding Odoo's type system

---

For agent-optimized CLI examples, see the [odoo skill](../skills/odoo/).
