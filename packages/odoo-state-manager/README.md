# @marcfargas/odoo-state-manager

> ⚠️ **Experimental** — API may change between minor versions. Use in production at your own risk.

State management with drift detection and plan/apply workflow for Odoo. Think "Terraform for Odoo" — define desired state, detect drift, generate execution plans, and apply changes atomically.

## Features

- **Drift Detection** - Compare desired vs actual Odoo state with deep diff algorithm
- **Execution Plans** - Generate ordered operation lists before making changes
- **Terraform-like Output** - Color-coded console output showing what will change
- **Atomic Apply** - Execute changes with ID mapping and reference resolution
- **Validation** - Dry-run mode and dependency checking before execution
- **Odoo-Aware** - Handles Odoo field quirks (many2one tuples, relational arrays)

## Installation

```bash
npm install @marcfargas/odoo-state-manager @marcfargas/odoo-client
```

**Prerequisites**: Node.js ≥ 18, a running Odoo v17 instance.

## Quick Start

```typescript
import { createClient } from '@marcfargas/odoo-client';
import {
  compareRecords,
  generatePlan,
  formatPlanForConsole,
  applyPlan,
  dryRunPlan,
} from '@marcfargas/odoo-state-manager';

// 1. Connect to Odoo (reads ODOO_URL, ODOO_DB, ODOO_USER, ODOO_PASSWORD from env)
const client = await createClient();

// 2. Define desired state
const desired = new Map([
  [1, { name: 'Project A', active: true }],
  [2, { name: 'Project B', active: false }],
]);

// 3. Read actual state
const actual = await client.searchRead('project.project', [['id', 'in', [1, 2]]]);
const actualMap = new Map(actual.map(r => [r.id, r]));

// 4. Compare and plan
const diffs = compareRecords('project.project', desired, actualMap);
const plan = generatePlan(diffs);

// 5. Review
console.log(formatPlanForConsole(plan));

// 6. Apply (after validation)
const validation = await dryRunPlan(plan, client);
if (validation.success) {
  const result = await applyPlan(plan, client);
  console.log(`Applied ${result.applied} operations`);
}
```

## The Workflow: Compare -> Plan -> Apply

```
1. COMPARE   Read actual state from Odoo
             Compare to desired state
             Detect drift

2. PLAN      Generate ordered list of operations
             Resolve dependencies
             Validate safety

3. APPLY     Execute operations atomically
             Handle errors and rollback
             Generate report
```

---

## Compare Module

Detects drift between desired and actual Odoo state by performing deep comparisons with Odoo-specific field handling.

### compareRecord()

Compare a single record's desired vs actual state:

```typescript
import { compareRecord } from '@marcfargas/odoo-state-manager';

const changes = compareRecord(
  'project.task',
  1,
  { name: 'Updated Task', priority: 'high' },  // desired
  { name: 'Old Task', priority: 'medium' }      // actual
);

// Returns:
// [
//   { path: 'name', operation: 'update', newValue: 'Updated Task', oldValue: 'Old Task' },
//   { path: 'priority', operation: 'update', newValue: 'high', oldValue: 'medium' }
// ]
```

### compareRecords()

Compare multiple records at once:

```typescript
const desiredStates = new Map([
  [1, { name: 'Task 1', priority: 'high' }],
  [2, { name: 'Task 2', priority: 'low' }],
]);

const actualStates = new Map([
  [1, { name: 'Task 1', priority: 'medium' }],
  [2, { name: 'Task 2', priority: 'low' }],
]);

const diffs = compareRecords('project.task', desiredStates, actualStates);
// Returns diffs for record ID 1 only (record 2 has no changes)
```

### Odoo Field Type Handling

The module automatically normalizes Odoo-specific field formats:

**Many2One Fields**: Odoo returns `[id, display_name]` tuples, but accepts just ID:

```typescript
// Odoo returns: [5, 'ACME Corp']
// Desired state: 5
// Result: No change detected
const changes = compareRecord('project.task', 1, { project_id: 5 }, { project_id: [5, 'ACME Corp'] });
// changes.length === 0
```

**One2Many / Many2Many**: Arrays compared by content, not order:

```typescript
const changes = compareRecord('project.project', 1, { task_ids: [1, 2, 3] }, { task_ids: [3, 2, 1] });
// changes.length === 0 (same IDs, different order)
```

### Field Metadata Support

Provide field metadata to skip readonly and computed fields:

```typescript
const fieldMetadata = new Map([
  ['project.task', new Map([
    ['create_date', { readonly: true }],
    ['progress', { compute: '_compute_progress' }],
  ])],
]);

const changes = compareRecord('project.task', 1, desired, actual, { fieldMetadata });
// Readonly and computed fields are skipped
```

### Custom Comparators

For complex field types or custom comparison logic:

```typescript
const customComparators = new Map([
  ['tags', (desired, actual) => {
    const normalize = (s: string) => s.trim().toLowerCase();
    return normalize(desired) === normalize(actual);
  }],
]);

const changes = compareRecord('project.task', 1, desired, actual, { customComparators });
```

---

## Plan Module

Generates ordered execution plans from comparison results. Plans show what operations would be applied before actually applying them.

### generatePlan()

Convert comparison results into an ordered list of operations:

```typescript
import { generatePlan } from '@marcfargas/odoo-state-manager';

const plan = generatePlan(diffs, {
  autoReorder: true,
  validateDependencies: true,
});

console.log(plan.summary);
// {
//   totalOperations: 3,
//   creates: 1,
//   updates: 2,
//   deletes: 0,
//   isEmpty: false,
//   hasErrors: false
// }
```

### formatPlanForConsole()

Display plan in Terraform-like format:

```typescript
import { formatPlanForConsole } from '@marcfargas/odoo-state-manager';

console.log(formatPlanForConsole(plan));

// Output:
// + project.project[new:1]
//   + name = "Q1 Planning"
//
// ~ project.task[5]
//   ~ priority = "high" -> "urgent"
//
// Plan: 1 to add, 1 to change, 0 to destroy.
```

**Symbols:**
- `+` Create (green)
- `~` Update (yellow)
- `-` Delete (red)

### Operation Types

**Create** - New records:
```typescript
{
  type: 'create',
  model: 'project.task',
  id: 'project.task:temp_1',  // temporary ID
  values: { name: 'New Task', priority: 'high' }
}
```

**Update** - Existing records:
```typescript
{
  type: 'update',
  model: 'project.task',
  id: 'project.task:5',  // actual database ID
  values: { priority: 'urgent' }
}
```

**Delete** - Records to remove:
```typescript
{
  type: 'delete',
  model: 'project.task',
  id: 'project.task:5'
}
```

### Dependency Ordering

Plans automatically order operations to satisfy dependencies:

1. **Creates before updates** - All create operations first
2. **Parent before child** - Parent records created before children referencing them
3. **Updates before deletes** - Safe cleanup order

### Plan Options

```typescript
const plan = generatePlan(diffs, {
  autoReorder: true,          // Order by dependencies (default: true)
  validateDependencies: true, // Check for issues (default: true)
  enableBatching: true,       // Combine operations (reserved)
  maxOperations: 10000,       // Limit plan size
});
```

### Plan Validation

Check for errors before applying:

```typescript
if (plan.summary.hasErrors) {
  console.log('Plan has issues:');
  for (const error of plan.summary.errors!) {
    console.log(`  - ${error}`);
  }
}
```

Common errors:
- Circular dependencies
- Missing dependency references
- Too many operations
- Invalid operation structure

---

## Apply Module

Executes plans against Odoo, applying creates, updates, and deletes in safe order.

### applyPlan()

Execute an execution plan:

```typescript
import { applyPlan } from '@marcfargas/odoo-state-manager';

const result = await applyPlan(plan, client, {
  dryRun: false,
  stopOnError: true,
  onProgress: (current, total) => console.log(`${current}/${total}`),
});

console.log(`Applied ${result.applied}/${result.total} operations`);
if (result.failed > 0) {
  console.log('Errors:', result.errors);
}
```

### dryRunPlan()

Validate plan without making changes:

```typescript
import { dryRunPlan } from '@marcfargas/odoo-state-manager';

const validation = await dryRunPlan(plan, client);

if (!validation.success) {
  console.log('Validation errors:', validation.errors);
}
```

### ID Mapping & References

When creating records with relationships to other new records, the apply module resolves temporary IDs:

```typescript
const operations = [
  {
    type: 'create',
    model: 'project.project',
    id: 'project.project:temp_1',
    values: { name: 'New Project' }
  },
  {
    type: 'create',
    model: 'project.task',
    id: 'project.task:temp_1',
    values: {
      name: 'New Task',
      project_id: 'project.project:temp_1'  // Reference to parent
    }
  }
];

const result = await applyPlan(plan, client);
// result.idMapping: { 'project.project:temp_1' => 100, 'project.task:temp_1' => 101 }
```

### Apply Options

```typescript
await applyPlan(plan, client, {
  dryRun: false,           // Validate without changes
  stopOnError: true,       // Stop on first error
  onProgress: (cur, tot, opId) => { ... },
  onOperationComplete: (result) => { ... },
  context: {               // Base context for all operations
    tracking_disable: true,
    lang: 'es_ES',
  },
  maxOperations: 1000,     // Reject large plans
});
```

### ApplyResult

```typescript
interface ApplyResult {
  operations: OperationResult[];
  total: number;
  applied: number;
  failed: number;
  success: boolean;
  duration: number;
  idMapping: Map<string, number>;  // temp ID -> real ID
  errors?: string[];
}
```

---

## Configuration Files

Define desired state in YAML or JSON files:

### YAML Format

```yaml
project.project:
  - id: 1
    name: "Q1 Planning"
    active: true
    description: "Q1 2026 planning"

project.task:
  - id: 1
    name: "Research"
    project_id: 1
    priority: "high"
```

### JSON Format

```json
{
  "project.project": [
    { "id": 1, "name": "Q1 Planning", "active": true }
  ],
  "project.task": [
    { "id": 1, "name": "Research", "project_id": 1, "priority": "high" }
  ]
}
```

### Loading Configuration

```typescript
import * as yaml from 'yaml';
import * as fs from 'fs';

const content = fs.readFileSync('config.yaml', 'utf-8');
const config = yaml.parse(content);

for (const [model, records] of Object.entries(config)) {
  const desired = new Map(records.map(r => [r.id, r]));
  const actual = await client.searchRead(model, []);
  const actualMap = new Map(actual.map(r => [r.id, r]));

  const diffs = compareRecords(model, desired, actualMap);
  const plan = generatePlan(diffs);
  // ...
}
```

---

## Best Practices

1. **Always validate before applying** - Use dryRunPlan() to catch issues early
2. **Review formatted output** - Use formatPlanForConsole() to understand changes
3. **Test in staging first** - Validate against staging before production
4. **Implement approval workflow** - Require human approval for production changes
5. **Monitor execution** - Use onProgress callbacks for visibility
6. **Handle errors gracefully** - Check result.errors for production
7. **Use context for optimization** - Set tracking_disable, mail_create_nolog, etc.
8. **Version control configs** - Store configuration as code in Git

---

## Troubleshooting

### Plan is empty but should have changes

Check if comparison is working:
```typescript
const diffs = compareRecords(desired, actual);
console.log('Diffs:', diffs);
// May be empty because values match, readonly fields filtered, or type mismatch
```

### ID references not resolving

Check for unresolved temporary IDs:
```typescript
const plan = generatePlan(diffs, { validateDependencies: true });
if (plan.summary.hasErrors) {
  plan.summary.errors?.forEach(err => console.error(err));
}
```

### Apply fails on specific operation

```typescript
const result = await applyPlan(plan, client, { stopOnError: true });
result.operations
  .filter(r => !r.success)
  .forEach(r => {
    console.error(`Failed: ${r.operation.type} ${r.operation.model}`);
    console.error('Error:', r.error?.message);
  });
```

---

## Examples

See the [examples/](../../examples/) directory:
- [7-state-management.ts](../../examples/7-state-management.ts) - Complete workflow
- [8-ci-cd-validation.ts](../../examples/8-ci-cd-validation.ts) - CI/CD integration

---

## Tested Examples

For comprehensive, tested examples of Odoo patterns including CRUD operations, search, and field handling, see the [knowledge modules](../../skills/odoo/SKILL.md).

## Related Packages

- [@marcfargas/odoo-client](../odoo-client) — RPC client
- [@marcfargas/odoo-introspection](../odoo-introspection) — Schema introspection
- [@marcfargas/create-odoo-skills](../create-skills) — CLI for scaffolding AI agent skill projects

## Bugs & Support

[GitHub Issues](https://github.com/marcfargas/odoo-toolbox/issues)

## License

LGPL-3.0 — see [LICENSE](./LICENSE)
