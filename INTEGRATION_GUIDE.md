# State Manager Integration Guide

Complete guide for integrating compare → plan → apply workflow into your projects.

## Overview

The state manager provides a Terraform-like workflow for Odoo:

```
Define Desired State
        ↓
Read Actual State from Odoo
        ↓
Compare & Detect Drift
        ↓
Generate Execution Plan
        ↓
Review Changes (formatted output)
        ↓
Validate with Dry-Run (no changes)
        ↓
Apply Changes to Odoo
        ↓
Verify Results
```

## Quick Start

### 1. Import State Manager

```typescript
import {
  compareRecords,
  generatePlan,
  formatPlanForConsole,
  applyPlan,
  dryRunPlan,
} from '@odoo-toolbox/state-manager';
```

### 2. Define Desired State

```typescript
const desiredProjects = new Map([
  [1, { name: 'Project A', active: true }],
  [2, { name: 'Project B', active: false }],
]);
```

### 3. Read Actual State

```typescript
const actualRecords = await client.searchRead('project.project', [
  ['id', 'in', [1, 2]],
]);

const actualState = new Map(
  actualRecords.map(r => [r.id, r])
);
```

### 4. Compare

```typescript
const diffs = compareRecords(
  'project.project',
  desiredProjects,
  actualState
);
```

### 5. Plan

```typescript
const plan = generatePlan(diffs);
```

### 6. Review

```typescript
console.log(formatPlanForConsole(plan));
```

### 7. Validate (Dry-Run)

```typescript
const validation = await dryRunPlan(plan, client);

if (!validation.success) {
  console.error('Validation failed:', validation.errors);
  return;
}
```

### 8. Apply

```typescript
const result = await applyPlan(plan, client);

if (result.success) {
  console.log(`Applied ${result.applied} changes`);
} else {
  console.error('Apply failed:', result.errors);
}
```

## Advanced Workflows

### Workflow 1: Safe Deployment (Staging → Production)

```typescript
async function deployConfiguration(config) {
  // Step 1: Read desired state from config file
  const desired = loadConfiguration(config);

  // Step 2: Read actual state from staging
  const staging = await stagingClient.searchRead('project.project', []);
  const stagingState = new Map(staging.map(r => [r.id, r]));

  // Step 3: Plan changes
  const plan = generatePlan(
    compareRecords('project.project', desired, stagingState)
  );

  // Step 4: Apply to staging with approval
  console.log('Staging deployment plan:');
  console.log(formatPlanForConsole(plan));

  const stagingApproved = await promptApproval();
  if (!stagingApproved) return;

  const stagingResult = await applyPlan(plan, stagingClient);
  if (!stagingResult.success) {
    console.error('Staging deployment failed, aborting production');
    return;
  }

  // Step 5: Same workflow for production
  const prod = await prodClient.searchRead('project.project', []);
  const prodState = new Map(prod.map(r => [r.id, r]));

  const prodPlan = generatePlan(
    compareRecords('project.project', desired, prodState)
  );

  console.log('Production deployment plan:');
  console.log(formatPlanForConsole(prodPlan));

  const prodApproved = await promptApproval();
  if (!prodApproved) return;

  const prodResult = await applyPlan(prodPlan, prodClient);
  console.log(`Production deployment: ${prodResult.applied} changes applied`);
}
```

### Workflow 2: Configuration Audit

```typescript
async function auditConfiguration(modelName, expectedConfig) {
  // Read actual state
  const actual = await client.searchRead(modelName, []);
  const actualState = new Map(actual.map(r => [r.id, r]));

  // Plan what changes would be needed
  const plan = generatePlan(
    compareRecords(modelName, expectedConfig, actualState)
  );

  // Generate audit report
  const report = {
    model: modelName,
    compliant: plan.summary.isEmpty,
    totalRecords: actualState.size,
    driftDetected: plan.summary.totalOperations,
    summary: plan.summary,
  };

  if (!plan.summary.isEmpty) {
    report.requiredChanges = plan.operations.map(op => ({
      type: op.type,
      record: op.id,
      details: op.values,
    }));
  }

  return report;
}
```

### Workflow 3: Batch Configuration with Validation

```typescript
async function batchConfigureProjects(projectConfigs) {
  const results = [];

  for (const [projectId, desiredConfig] of projectConfigs) {
    // Read project state
    const [actual] = await client.read('project.project', [projectId]);

    // Compare and plan
    const plan = generatePlan(
      compareRecords('project.project', new Map([[projectId, desiredConfig]]), 
                     new Map([[projectId, actual]]))
    );

    // Validate
    const validation = await dryRunPlan(plan, client);

    if (validation.success && !plan.summary.isEmpty) {
      // Apply
      const result = await applyPlan(plan, client);
      results.push({
        projectId,
        applied: result.applied,
        success: result.success,
      });
    } else {
      results.push({
        projectId,
        error: validation.errors,
      });
    }
  }

  return results;
}
```

### Workflow 4: Configuration as Code (File-Based)

```typescript
import * as yaml from 'yaml';

async function applyConfigurationFromFile(filePath) {
  // Load desired state from YAML/JSON
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const desiredConfig = yaml.parse(fileContent);

  // Read actual state for each model
  const results = [];

  for (const [modelName, desiredRecords] of Object.entries(desiredConfig)) {
    const actual = await client.searchRead(modelName, []);
    const actualState = new Map(actual.map(r => [r.id, r]));

    // Convert desired records to Map
    const desired = new Map(
      desiredRecords.map(r => [r.id, r])
    );

    // Compare and plan
    const plan = generatePlan(
      compareRecords(modelName, desired, actualState)
    );

    // Show plan
    console.log(`\nModel: ${modelName}`);
    console.log(formatPlanForConsole(plan));

    // Apply if approved
    const approved = await promptApproval(`Apply changes to ${modelName}?`);

    if (approved) {
      const result = await applyPlan(plan, client);
      results.push({
        model: modelName,
        ...result,
      });
    }
  }

  return results;
}
```

## Configuration File Format

### YAML Example

```yaml
project.project:
  - id: 1
    name: "Q1 Planning"
    active: true
    description: "Q1 2026 planning"
  
  - id: 2
    name: "Q2 Planning"
    active: true
    description: "Q2 2026 planning"

project.task:
  - id: 1
    name: "Research"
    project_id: 1
    priority: "high"
  
  - id: 2
    name: "Analysis"
    project_id: 1
    priority: "medium"
```

### JSON Example

```json
{
  "project.project": [
    {
      "id": 1,
      "name": "Q1 Planning",
      "active": true,
      "description": "Q1 2026 planning"
    },
    {
      "id": 2,
      "name": "Q2 Planning",
      "active": true,
      "description": "Q2 2026 planning"
    }
  ],
  "project.task": [
    {
      "id": 1,
      "name": "Research",
      "project_id": 1,
      "priority": "high"
    }
  ]
}
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Odoo Configuration Audit

on:
  pull_request:
    paths:
      - 'odoo-config/**'

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Audit configuration
        run: |
          npx ts-node scripts/audit-config.ts \
            --env staging \
            --config odoo-config/
        env:
          ODOO_URL: ${{ secrets.ODOO_STAGING_URL }}
          ODOO_DB: ${{ secrets.ODOO_STAGING_DB }}
          ODOO_USER: ${{ secrets.ODOO_USER }}
          ODOO_PASSWORD: ${{ secrets.ODOO_PASSWORD }}
```

### GitLab CI Example

```yaml
stages:
  - audit
  - deploy

audit:config:
  stage: audit
  script:
    - npm ci
    - npm run build
    - npx ts-node scripts/audit-config.ts --env staging
  variables:
    ODOO_URL: $ODOO_STAGING_URL
    ODOO_DB: $ODOO_STAGING_DB
    ODOO_USER: $ODOO_USER
    ODOO_PASSWORD: $ODOO_PASSWORD

deploy:config:
  stage: deploy
  script:
    - npm ci
    - npm run build
    - npx ts-node scripts/deploy-config.ts --env production
  variables:
    ODOO_URL: $ODOO_PROD_URL
    ODOO_DB: $ODOO_PROD_DB
    ODOO_USER: $ODOO_USER
    ODOO_PASSWORD: $ODOO_PASSWORD
  only:
    - main
```

## Error Handling

### Handling Validation Errors

```typescript
try {
  const validation = await dryRunPlan(plan, client);

  if (!validation.success) {
    validation.errors?.forEach(error => {
      if (error.includes('unresolved')) {
        console.error('ID reference not resolved:', error);
      } else if (error.includes('temporary')) {
        console.error('Invalid operation order:', error);
      } else {
        console.error('Validation error:', error);
      }
    });
    return false;
  }

  return true;
} catch (error) {
  console.error('Unexpected error during validation:', error);
  return false;
}
```

### Handling Apply Errors

```typescript
const result = await applyPlan(plan, client, {
  stopOnError: false, // Continue despite errors
  onOperationComplete: (opResult) => {
    if (!opResult.success) {
      console.warn(
        `Failed: ${opResult.operation.type} ${opResult.operation.model}`,
        opResult.error?.message
      );
    }
  },
});

// Report summary
console.log(`Applied: ${result.applied}/${result.total}`);

if (result.failed > 0) {
  result.errors?.forEach(err => console.error('  -', err));
  
  // Decide what to do:
  // - Retry failed operations
  // - Rollback applied changes
  // - Investigate and fix
}
```

## Performance Optimization

### Selective Field Comparison

```typescript
// Only compare fields that matter
const fieldMetadata = new Map([
  [
    'project.project',
    new Map([
      ['name', { readonly: false }],
      ['active', { readonly: false }],
      ['description', { readonly: false }],
      // Skip computed fields like 'task_count'
    ]),
  ],
]);

const diffs = compareRecords(
  'project.project',
  desired,
  actual,
  { fieldMetadata }
);
```

### Batching Operations

```typescript
// Apply plan with batching for performance
const result = await applyPlan(plan, client, {
  enableBatching: true, // Combine similar operations
  onProgress: (current, total) => {
    console.log(`Progress: ${current}/${total}`);
  },
});
```

### Limiting Plan Size

```typescript
const plan = generatePlan(diffs, {
  maxOperations: 1000, // Reject plans with > 1000 changes
  validateDependencies: true,
});

if (plan.summary.hasErrors) {
  console.error('Plan too large or has errors');
  process.exit(1);
}
```

## Best Practices

1. **Always validate before applying** - Use dry-run to catch issues early
2. **Review formatted output** - Use formatPlanForConsole() to understand changes
3. **Test in staging first** - Validate against staging environment before production
4. **Implement approval workflow** - Require human approval for production changes
5. **Monitor execution** - Use onProgress callbacks for visibility
6. **Handle errors gracefully** - Log and report failures clearly
7. **Track changes** - Keep audit trail of who applied what when
8. **Version control configs** - Store configuration as code in Git
9. **Incremental rollout** - Apply to staging first, then production
10. **Test rollback** - Know how to undo changes if needed

## Troubleshooting

### Plan is empty but should have changes

```typescript
// Check if comparison is working
const diffs = compareRecords(desired, actual);
console.log('Diffs:', diffs);

// Diffs might be empty because:
// - Values are already matching
// - Readonly fields are being filtered
// - Field types don't match exactly (e.g., many2one format)
```

### ID references not resolving

```typescript
// Check for unresolved temporary IDs
const plan = generatePlan(diffs, {
  validateDependencies: true, // This will catch unresolved refs
});

if (plan.summary.hasErrors) {
  plan.summary.errors?.forEach(err => {
    if (err.includes('Unresolved ID')) {
      console.error('Missing dependency:', err);
    }
  });
}
```

### Apply fails on specific operation

```typescript
const result = await applyPlan(plan, client, {
  stopOnError: true, // Stop and show which operation failed
});

// result.operations contains details of what failed
result.operations
  .filter(r => !r.success)
  .forEach(r => {
    console.error(`Failed operation: ${r.operation.type} ${r.operation.model}`);
    console.error('Error:', r.error?.message);
    console.error('Duration:', r.duration, 'ms');
  });
```

## Further Reading

- [Compare Module](../packages/odoo-state-manager/src/compare/README.md)
- [Plan Module](../packages/odoo-state-manager/src/plan/README.md)
- [Apply Module](../packages/odoo-state-manager/src/apply/README.md)
- [Example 7: State Management](../examples/7-state-management.ts)
- [Example 8: CI/CD Validation](../examples/8-ci-cd-validation.ts)
- [AGENTS.md](../AGENTS.md) - Architecture and patterns
