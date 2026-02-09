# @marcfargas/odoo-state-manager Examples

Practical examples demonstrating drift detection, planning, and state management workflows.

## Quick Start

Each example is a standalone TypeScript file. Run them with:

```bash
npx ts-node packages/odoo-state-manager/examples/1-state-management.ts
```

## Prerequisites

- Node.js 18+
- Odoo instance running with project module enabled
- Valid credentials (default: admin/admin on localhost:8069)
- Some sample projects in your Odoo instance

## Examples

### 1. State Management - Drift Detection & Planning
**File**: [1-state-management.ts](./1-state-management.ts)

Learn how to:
- Define desired state declaratively
- Read actual state from Odoo
- Compare desired vs actual state
- Generate execution plans (like Terraform)
- Review plans in terraform-like format
- Perform dry-run validation
- Apply changes atomically
- Verify changes after application

**Key concepts**: State comparison, drift detection, execution plans, dry-run, apply, verification

**Use case**: Ensure project configuration is consistent across your Odoo instance

---

### 2. Planning Without Applying - CI/CD Validation
**File**: [2-ci-cd-validation.ts](./2-ci-cd-validation.ts)

Learn how to:
- Load desired configuration from code/files
- Generate audit reports
- Validate configuration without making changes
- Generate detailed change reports
- Create CI/CD-friendly output
- Exit with appropriate status codes
- Preserve validation for approval workflows

**Key concepts**: Dry-run, validation, audit reporting, CI/CD integration, approval workflows

**Use case**: Validate configuration in pipelines before human approval

---

## Running in Development

Run examples with:

```bash
npx ts-node packages/odoo-state-manager/examples/1-state-management.ts
```

Or with environment variables:

```bash
ODOO_URL=http://localhost:8069 ODOO_DB=odoo \
ODOO_USER=admin ODOO_PASSWORD=admin \
npx ts-node packages/odoo-state-manager/examples/1-state-management.ts
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

## Workflow: State Management

### Step 1: Define Desired State

```typescript
const desiredState = new Map([
  [1, { name: 'Project A', active: true }],
  [2, { name: 'Project B', active: true }],
]);
```

### Step 2: Read Actual State from Odoo

```typescript
const actualProjects = await client.searchRead('project.project', [
  ['id', 'in', Array.from(desiredState.keys())]
]);

const actualState = new Map(
  actualProjects.map(p => [p.id, p])
);
```

### Step 3: Compare

```typescript
const diffs = compareRecords('project.project', desiredState, actualState);
```

### Step 4: Generate Plan

```typescript
const plan = generatePlan(diffs, {
  autoReorder: true,
  validateDependencies: true,
});
```

### Step 5: Review Plan

```typescript
const formatted = formatPlanForConsole(plan);
console.log(formatted);
```

### Step 6: Dry-Run Validation

```typescript
const result = await dryRunPlan(plan, client, {
  validate: true,
});
```

### Step 7: Apply

```typescript
const applyResult = await applyPlan(plan, client, {
  dryRun: false,
  stopOnError: false,
});
```

### Step 8: Verify

```typescript
const verified = await client.searchRead('project.project', [...]);
// Confirm changes match desired state
```

## Plan Format

A plan looks like:

```
project.project[1]:
  ~ name = "Old Name" -> "New Name"
  ~ active = false -> true

project.project[2]:
  + create with { name: "Project B", active: true }

project.project[3]:
  - delete
```

Operations are ordered to respect dependencies automatically.

## CI/CD Integration

For CI/CD pipelines, use dry-run mode and exit codes:

```bash
#!/bin/bash
npx ts-node validate-config.ts

if [ $? -eq 0 ]; then
  echo "Configuration is valid"
  exit 0
else
  echo "Configuration validation failed"
  exit 1
fi
```

In your GitHub Actions / GitLab CI:

```yaml
- name: Validate Odoo Configuration
  run: npx ts-node packages/odoo-state-manager/examples/2-ci-cd-validation.ts

- name: Apply on Merge
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  run: npx ts-node apply-config.ts
```

## Atomic Operations

The state manager ensures atomicity where possible:

```typescript
// Good: Batched in one call
const diffs = compareRecords(model, desired, actual);
const plan = generatePlan(diffs);
const result = await applyPlan(plan, client);

// Bad: Manual loops
for (const [id, state] of desired) {
  await client.write(model, [id], state); // Multiple calls!
}
```

## Handling Failures

Apply with error handling:

```typescript
const result = await applyPlan(plan, client, {
  dryRun: false,
  stopOnError: true,  // Stop on first error
  onProgress: (current, total, opId) => {
    console.log(`[${current}/${total}] ${opId}`);
  },
  onOperationComplete: (opResult) => {
    if (!opResult.success) {
      console.error(`Failed: ${opResult.error?.message}`);
    }
  },
});

if (result.failed > 0) {
  console.log(`${result.failed} operations failed`);
  result.errors?.forEach(err => console.log(`  - ${err}`));
}
```

## Advanced: Custom Comparison Logic

You can customize field comparison:

```typescript
const diffs = compareRecords('project.project', desired, actual, {
  fieldMetadata: await client.getFieldMetadata('project.project', ['name', 'active']),
  ignoreFields: ['last_modified', 'modified_by'],
  customComparators: {
    tags: (desired, actual) => {
      // Custom comparison for tags
      const dSet = new Set(desired);
      const aSet = new Set(actual);
      return dSet.size === aSet.size && [...dSet].every(t => aSet.has(t));
    }
  }
});
```

## Next Steps

1. Start with **Example 1** to understand the full workflow
2. Move to **Example 2** for CI/CD integration
3. Build your own configuration management system
4. Integrate with:
   - **@marcfargas/odoo-client** - Low-level operations
   - **@marcfargas/odoo-introspection** - Schema discovery for validation

## Troubleshooting

**Connection refused?**
```bash
docker-compose up
```

**No projects found?**
- Ensure project module is installed
- Create sample projects: `INSERT INTO project_project (name) VALUES ('Test');`

**Plan won't apply?**
- Check field permissions
- Verify required fields are set
- Run with `stopOnError: false` to see all failures

**Changes not reflected?**
- Check Odoo browser cache (Hard refresh)
- Verify context didn't disable tracking/modifications
- Check for field constraints or onchange methods
