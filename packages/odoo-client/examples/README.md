# @marcfargas/odoo-client Examples

Practical examples demonstrating the Odoo RPC client features.

## Quick Start

Each example is a standalone TypeScript file. Run them with:

```bash
npx ts-node packages/odoo-client/examples/1-basic-connection.ts
```

## Prerequisites

- Node.js 18+
- Odoo instance running (e.g., `docker-compose up` for test instance)
- Valid credentials (default: admin/admin on localhost:8069)

## Examples

### 1. Basic Connection & Authentication
**File**: [1-basic-connection.ts](./1-basic-connection.ts)

Learn how to:
- Create an OdooClient instance
- Authenticate with Odoo
- Handle connection errors
- Verify connection status

**Key concepts**: Client initialization, authentication, session info, logout

---

### 2. CRUD Operations
**File**: [2-crud-operations.ts](./2-crud-operations.ts)

Learn how to:
- Create (POST) new records
- Read (GET) records by ID
- Update (PUT) records
- Delete (DELETE) records
- Batch operations for efficiency
- Handle responses and errors

**Key concepts**: Create, read, write, unlink (delete), batch operations, error handling

---

### 3. Search and Filtering
**File**: [3-search-and-filter.ts](./3-search-and-filter.ts)

Learn how to:
- Search with Odoo domain filters
- Use comparison operators (=, !=, >, <, in, etc.)
- Combine conditions with AND/OR logic
- Paginate results (limit, offset)
- Order results by fields
- Use searchRead for efficient combined operations
- Filter by relationships

**Key concepts**: Domains, search, filtering, pagination, ordering, searchRead, relational filters

---

### 4. Context Variables & Batch Operations
**File**: [4-context-and-batch.ts](./4-context-and-batch.ts)

Learn how to:
- Use Odoo context variables to control behavior
- Disable field tracking/audit trail
- Set default field values
- Control timezone and language settings
- Perform efficient batch operations
- Understand when to use context

**Key concepts**: Context variables, batch operations, multi-company, language/timezone, tracking

---

## Running in Development

If you want to run examples during development with automatic reloading:

```bash
npm run dev -- packages/odoo-client/examples/1-basic-connection.ts
```

## Integration Tests

Each example has corresponding integration tests in [../tests/examples.integration.test.ts](../tests/examples.integration.test.ts)

Run tests:

```bash
npm run test:integration
```

## Environment Variables

Configure your Odoo instance:

```bash
export ODOO_URL=http://localhost:8069
export ODOO_DB=odoo
export ODOO_USER=admin
export ODOO_PASSWORD=admin
```

## Common Patterns

### Error Handling

All examples include proper error handling:

```typescript
try {
  await client.authenticate();
  // ... your code ...
} catch (error) {
  if (error instanceof Error) {
    console.error('Error:', error.message);
  }
  process.exit(1);
}
```

### Batch Operations

Always prefer batching for efficiency:

```typescript
// ❌ Inefficient: N RPC calls
for (const id of ids) {
  await client.delete(id);
}

// ✅ Efficient: 1 RPC call
await client.unlink(ids);
```

### Context Usage

Context controls Odoo behavior:

```typescript
await client.create(
  'res.partner',
  { name: 'Acme' },
  { lang: 'en_US', tz: 'UTC' }
);
```

## Next Steps

1. Start with **Example 1** to authenticate
2. Move to **Example 2** for CRUD operations
3. Try **Example 3** to practice searching
4. Explore **Example 4** for advanced context features

Then check out the other packages:
- **@marcfargas/odoo-introspection** - Generate types from schema
- **@marcfargas/odoo-state-manager** - Drift detection and state management

## Troubleshooting

**Connection refused?**
```bash
# Start the test Odoo instance
docker-compose up
```

**Authentication failed?**
- Check ODOO_USER and ODOO_PASSWORD
- Verify ODOO_DB matches your Odoo database name

**Module not found?**
```bash
# Ensure dependencies are installed
npm install

# Rebuild if needed
npm run build
```
