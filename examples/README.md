# Examples

Practical examples demonstrating @odoo-toolbox features.

## Quick Start

Each example is a standalone TypeScript file showing a specific feature. They require a running Odoo instance with valid credentials.

### Prerequisites

- Node.js 18+
- Odoo instance running (e.g., `docker-compose up` to start test instance)
- Valid Odoo credentials (default: admin/admin on localhost:8069)

### Running Examples

```bash
# Run a single example
npx ts-node examples/1-basic-connection.ts

# Or compile and run
npm run build
node dist/examples/1-basic-connection.js
```

## Examples

### 1. Basic Connection & Authentication
**File**: [1-basic-connection.ts](./1-basic-connection.ts)

Learn how to:
- Create an OdooClient instance
- Authenticate with Odoo
- Handle connection errors
- Verify you're connected

**Key concepts**: Client initialization, authentication, session info, logout

---

### 2. Schema Introspection
**File**: [2-schema-introspection.ts](./2-schema-introspection.ts)

Learn how to:
- List all available Odoo models
- Inspect field metadata for a model
- Understand field types and properties
- Filter models by module
- Explore the schema dynamically

**Key concepts**: Models, fields, introspection, metadata, schema discovery

---

### 3. Generate TypeScript Types
**File**: [3-generate-types.ts](./3-generate-types.ts)

Learn how to:
- Generate TypeScript interfaces from Odoo schema
- Create typed clients with autocomplete
- Understand the code generation process
- Use generated types in your code

**Key concepts**: Type generation, CodeGenerator, interfaces, type safety, IDE support

---

### 4. CRUD Operations
**File**: [4-crud-operations.ts](./4-crud-operations.ts)

Learn how to:
- Create (POST) new records
- Read (GET) records by ID
- Update (PUT) records
- Delete (DELETE) records
- Batch operations for efficiency
- Handle responses and errors

**Key concepts**: Create, read, write, unlink (delete), batch operations, error handling

---

### 5. Search and Filtering
**File**: [5-search-and-filter.ts](./5-search-and-filter.ts)

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

### 6. Context Variables & Batch Operations
**File**: [6-context-and-batch.ts](./6-context-and-batch.ts)

Learn how to:
- Use Odoo context variables to control behavior
- Disable field tracking/audit trail
- Set default field values
- Control timezone and language settings
- Perform efficient batch operations
- Understand when and why to use context

**Key concepts**: Context, batch operations, tracking, defaults, multi-company, efficiency

---

### 7. State Management - Drift Detection & Planning ⭐
**File**: [7-state-management.ts](./7-state-management.ts)

Learn how to:
- Compare desired vs actual Odoo state
- Detect configuration drift
- Generate execution plans (like Terraform)
- Review changes before applying
- Apply changes safely with ID mapping
- Validate operations with dry-run

**Key concepts**: Drift detection, compare, plan, apply, validation, ID mapping

**This is the killer feature** - Infrastructure as Code for Odoo!

---

### 8. CI/CD Validation - Plan Without Applying ⭐
**File**: [8-ci-cd-validation.ts](./8-ci-cd-validation.ts)

Learn how to:
- Use planning for configuration audits
- Validate changes without applying them
- Generate reports for CI/CD pipelines
- Exit with appropriate codes
- Integrate with approval workflows
- Support staged deployments (staging → production)

**Key concepts**: Dry-run, validation, auditing, CI/CD, approvals

**Perfect for pipeline integration** - Review before applying!

---

## Common Patterns

### Pattern: Check Before Update
```typescript
// Read current state
const [current] = await client.read(modelName, [id], fields);

// Only update if different
if (current.field !== desiredValue) {
  await client.write(modelName, [id], { field: desiredValue });
}
```

### Pattern: Search with Pagination
```typescript
const pageSize = 100;
for (let offset = 0; offset < total; offset += pageSize) {
  const ids = await client.search(modelName, domain, {
    limit: pageSize,
    offset: offset,
    order: 'id ASC'
  });
  if (ids.length === 0) break;
  // Process batch
}
```

### Pattern: Safe Batch Operations
```typescript
// Create many in one call (faster than loop)
const ids = await Promise.all(
  records.map(r => client.create(modelName, r))
);

// Or use batch write if updating
await client.write(modelName, ids, { status: 'done' });
```

### Pattern: State Management Workflow
```typescript
import {
  compareRecords,
  generatePlan,
  formatPlanForConsole,
  applyPlan,
  dryRunPlan,
} from '@odoo-toolbox/state-manager';

// Step 1: Compare
const diffs = compareRecords(modelName, desired, actual);

// Step 2: Plan
const plan = generatePlan(diffs);

// Step 3: Review
console.log(formatPlanForConsole(plan));

// Step 4: Validate (without changes)
const dryRun = await dryRunPlan(plan, client);

// Step 5: Apply (if validated)
if (dryRun.success) {
  const result = await applyPlan(plan, client);
  console.log(`Applied ${result.applied} operations`);
}
```

### Pattern: Error Handling
```typescript
try {
  const result = await client.search(modelName, domain);
} catch (error) {
  if (error.message.includes('access_denied')) {
    console.error('No read access to model');
  } else if (error.message.includes('domain_error')) {
    console.error('Invalid search domain');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Tips & Best Practices

- **Authenticate first**: All RPC calls require `authenticate()` to be called first
- **Use batch operations**: Avoid loops of create/write/delete - use arrays instead
- **Cache schema**: Call `getFields()` once and reuse, don't call repeatedly
- **Select fields**: When reading, specify fields you need to reduce data transfer
- **Use searchRead**: More efficient than separate search + read calls
- **Context matters**: Context controls important Odoo behavior - see AGENTS.md
- **Handle errors**: Always wrap client calls in try/catch
- **Plan before applying**: Always use dry-run validation before applying changes
- **Test locally**: Run examples against local Odoo before running in production

## Environment Variables

Override connection defaults with environment variables:

```bash
ODOO_URL=http://localhost:8069          # Odoo server URL
ODOO_DB=odoo                            # Database name
ODOO_USER=admin                         # Login username
ODOO_PASSWORD=admin                     # Login password
```

Example:
```bash
ODOO_URL=https://myodoo.com ODOO_DB=production npx ts-node examples/1-basic-connection.ts
```

## Troubleshooting

**"Cannot find module"**
- Run `npm install` in the root directory
- Make sure examples are in `examples/` directory

**"Connection refused"**
- Is Odoo running? Try `docker-compose up` to start test instance
- Check ODOO_URL environment variable

**"invalid_credentials"**
- Check username/password
- Verify database name (ODOO_DB)

**"Access denied"**
- Your user doesn't have permission for that model
- Try with admin user
- Check model-level access control in Odoo

**Example times out**
- Odoo instance might be slow - increase timeout
- Check Odoo logs: `docker-compose logs odoo`

## Next Steps

- Read [DEVELOPMENT.md](../DEVELOPMENT.md) for testing and contributing
- Check [AGENTS.md](../AGENTS.md) for architecture and design patterns
- See [README.md](../README.md) for the main project overview
- Look at package READMEs:
  - [packages/odoo-client/README.md](../packages/odoo-client/README.md)
  - [packages/odoo-state-manager/README.md](../packages/odoo-state-manager/README.md)

## Quick Start

Each example is a standalone TypeScript file showing a specific feature. They require a running Odoo instance with valid credentials.

### Prerequisites

- Node.js 18+
- Odoo instance running (e.g., `docker-compose up` to start test instance)
- Valid Odoo credentials (default: admin/admin on localhost:8069)

### Running Examples

```bash
# Run a single example
npx ts-node examples/1-basic-connection.ts

# Or compile and run
npm run build
node dist/examples/1-basic-connection.js
```

## Examples

### 1. Basic Connection & Authentication
**File**: [1-basic-connection.ts](./1-basic-connection.ts)

Learn how to:
- Create an OdooClient instance
- Authenticate with Odoo
- Handle connection errors
- Verify you're connected

**Key concepts**: Client initialization, authentication, session info, logout

---

### 2. Schema Introspection
**File**: [2-schema-introspection.ts](./2-schema-introspection.ts)

Learn how to:
- List all available Odoo models
- Inspect field metadata for a model
- Understand field types and properties
- Filter models by module
- Explore the schema dynamically

**Key concepts**: Models, fields, introspection, metadata, schema discovery

---

### 3. Generate TypeScript Types
**File**: [3-generate-types.ts](./3-generate-types.ts)

Learn how to:
- Generate TypeScript interfaces from Odoo schema
- Create typed clients with autocomplete
- Understand the code generation process
- Use generated types in your code

**Key concepts**: Type generation, CodeGenerator, interfaces, type safety, IDE support

---

### 4. CRUD Operations
**File**: [4-crud-operations.ts](./4-crud-operations.ts)

Learn how to:
- Create (POST) new records
- Read (GET) records by ID
- Update (PUT) records
- Delete (DELETE) records
- Batch operations for efficiency
- Handle responses and errors

**Key concepts**: Create, read, write, unlink (delete), batch operations, error handling

---

### 5. Search and Filtering
**File**: [5-search-and-filter.ts](./5-search-and-filter.ts)

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

### 6. Context Variables & Batch Operations
**File**: [6-context-and-batch.ts](./6-context-and-batch.ts)

Learn how to:
- Use Odoo context variables to control behavior
- Disable field tracking/audit trail
- Set default field values
- Control timezone and language settings
- Perform efficient batch operations
- Understand when and why to use context

**Key concepts**: Context, batch operations, tracking, defaults, multi-company, efficiency

---

## Common Patterns

### Pattern: Check Before Update
```typescript
// Read current state
const [current] = await client.read(modelName, [id], fields);

// Only update if different
if (current.field !== desiredValue) {
  await client.write(modelName, [id], { field: desiredValue });
}
```

### Pattern: Search with Pagination
```typescript
const pageSize = 100;
for (let offset = 0; offset < total; offset += pageSize) {
  const ids = await client.search(modelName, domain, {
    limit: pageSize,
    offset: offset,
    order: 'id ASC'
  });
  if (ids.length === 0) break;
  // Process batch
}
```

### Pattern: Safe Batch Operations
```typescript
// Create many in one call (faster than loop)
const ids = await Promise.all(
  records.map(r => client.create(modelName, r))
);

// Or use batch write if updating
await client.write(modelName, ids, { status: 'done' });
```

### Pattern: Error Handling
```typescript
try {
  const result = await client.search(modelName, domain);
} catch (error) {
  if (error.message.includes('access_denied')) {
    console.error('No read access to model');
  } else if (error.message.includes('domain_error')) {
    console.error('Invalid search domain');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Tips & Best Practices

- **Authenticate first**: All RPC calls require `authenticate()` to be called first
- **Use batch operations**: Avoid loops of create/write/delete - use arrays instead
- **Cache schema**: Call `getFields()` once and reuse, don't call repeatedly
- **Select fields**: When reading, specify fields you need to reduce data transfer
- **Use searchRead**: More efficient than separate search + read calls
- **Context matters**: Context controls important Odoo behavior - see AGENTS.md
- **Handle errors**: Always wrap client calls in try/catch
- **Test locally**: Run examples against local Odoo before running in production

## Environment Variables

Override connection defaults with environment variables:

```bash
ODOO_URL=http://localhost:8069          # Odoo server URL
ODOO_DB_NAME=odoo                       # Database name
ODOO_DB_USER=admin                      # Login username
ODOO_DB_PASSWORD=admin                  # Login password
```

Example:
```bash
ODOO_URL=https://myodoo.com ODOO_DB_NAME=production npx ts-node examples/1-basic-connection.ts
```

## Troubleshooting

**"Cannot find module"**
- Run `npm install` in the root directory
- Make sure examples are in `examples/` directory

**"Connection refused"**
- Is Odoo running? Try `docker-compose up` to start test instance
- Check ODOO_URL environment variable

**"invalid_credentials"**
- Check username/password
- Verify database name (ODOO_DB_NAME)

**"Access denied"**
- Your user doesn't have permission for that model
- Try with admin user
- Check model-level access control in Odoo

**Example times out**
- Odoo instance might be slow - increase timeout
- Check Odoo logs: `docker-compose logs odoo`

## Next Steps

- Read [DEVELOPMENT.md](../DEVELOPMENT.md) for testing and contributing
- Check [AGENTS.md](../AGENTS.md) for architecture and design patterns
- See [README.md](../README.md) for the main project overview
- Look at package READMEs:
  - [packages/odoo-client/README.md](../packages/odoo-client/README.md)
  - [packages/odoo-state-manager/README.md](../packages/odoo-state-manager/README.md)
