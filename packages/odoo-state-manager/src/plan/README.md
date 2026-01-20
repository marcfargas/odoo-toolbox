# Plan Module

Generates ordered execution plans from comparison results. Plans show what operations would be applied to Odoo before actually applying them.

## Overview

The plan module is the second step in the state management workflow:
1. **Compare** - Detect drift (desired vs actual) ✅
2. **Plan** - Generate execution plan ← You are here
3. **Apply** - Execute changes atomically

## Core Functions

### `generatePlan()`

Convert comparison results into an ordered list of operations:

```typescript
import { generatePlan } from '@odoo-toolbox/state-manager';
import { compareRecords } from '@odoo-toolbox/state-manager';

// Compare first
const diffs = compareRecords('project.task', desiredStates, actualStates, {
  fieldMetadata: introspectedMetadata,
});

// Then plan
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

### `formatPlanForConsole()`

Display plan in Terraform-like format:

```typescript
import { generatePlan, formatPlanForConsole } from '@odoo-toolbox/state-manager';

const plan = generatePlan(diffs);
const formatted = formatPlanForConsole(plan);
console.log(formatted);

// Output:
// + project.project[new:1]
//   + name = "Q1 Planning"
// 
// ~ project.task[5]
//   ~ priority = "high" -> "urgent"
// 
// Plan: 1 to add, 1 to change, 0 to destroy.
```

## Operation Types

### Create

New records to be created in Odoo:

```typescript
{
  type: 'create',
  model: 'project.task',
  id: 'project.task:temp_1',  // temp ID for new records
  values: {
    name: 'New Task',
    priority: 'high',
    project_id: 5
  },
  reason: 'Create new record'
}
```

### Update

Existing records to be modified:

```typescript
{
  type: 'update',
  model: 'project.task',
  id: 'project.task:5',  // Actual database ID
  values: {
    name: 'Updated Task Name',
    priority: 'urgent'
  },
  reason: 'Update 2 field(s)'
}
```

### Delete

Records to be removed:

```typescript
{
  type: 'delete',
  model: 'project.task',
  id: 'project.task:5',
  // No values - all fields are deleted
}
```

## Dependency Ordering

Plans automatically order operations to satisfy dependencies:

### Rule 1: Creates Before Updates

All create operations happen first, then updates, then deletes:

```typescript
const diffs = [
  { model: 'task', id: 1, isNew: false, changes: [...] },  // Update
  { model: 'project', id: 1, isNew: true, changes: [...] }, // Create
];

const plan = generatePlan(diffs);

// plan.operations:
// [0] create project
// [1] update task
```

### Rule 2: Parent Creates Before Child Creates

When a child record depends on its parent, the parent creates first:

```typescript
const diffs = [
  {
    model: 'project.task',
    id: 1,
    isNew: true,
    changes: [{ path: 'project_id', newValue: 'project:temp_1' }],
    // References a newly created project
  },
  {
    model: 'project.project',
    id: 1,
    isNew: true,
    changes: [...],
  },
];

const plan = generatePlan(diffs);

// plan.operations:
// [0] create project (creates project:temp_1)
// [1] create task (depends on project:temp_1)
```

## Console Output Format

### Symbols

- `+` Create (green)
- `~` Update (yellow)
- `-` Delete (red)

### Example Plan

```
+ project.project[new:1]
  + name = "Q1 Planning"
  + active = true

~ project.task[5]
  ~ priority = "high" -> "urgent"
  ~ assigned_to = 1 -> 2

- project.comment[12]

Plan: 1 to add, 1 to change, 1 to destroy.
```

## Metadata & Summary

Every plan includes metadata:

```typescript
const plan = generatePlan(diffs);

console.log(plan.metadata);
// {
//   timestamp: Date,
//   affectedModels: Map {
//     'project.project' => { creates: 1, updates: 0, deletes: 0 },
//     'project.task' => { creates: 0, updates: 1, deletes: 0 }
//   },
//   totalChanges: 2
// }

console.log(plan.summary);
// {
//   totalOperations: 2,
//   creates: 1,
//   updates: 1,
//   deletes: 0,
//   isEmpty: false,
//   hasErrors: false
// }
```

## Options

### autoReorder

Automatically order operations by dependencies (default: true):

```typescript
const plan = generatePlan(diffs, {
  autoReorder: true  // Creates come before updates
});
```

### validateDependencies

Check for missing or circular dependencies (default: true):

```typescript
const plan = generatePlan(diffs, {
  validateDependencies: true  // Will set hasErrors if issues found
});

if (plan.summary.hasErrors) {
  console.log(plan.summary.errors);
}
```

### enableBatching

Combine multiple operations on same model (default: true, reserved for Phase 2):

```typescript
const plan = generatePlan(diffs, {
  enableBatching: true  // Could combine multiple writes
});
```

### maxOperations

Limit plan size (default: 10000):

```typescript
const plan = generatePlan(diffs, {
  maxOperations: 500  // Reject plans with > 500 ops
});
```

## Error Handling

Plans can fail validation with errors:

```typescript
const plan = generatePlan(diffs);

if (plan.summary.hasErrors) {
  console.log('Plan has issues:');
  for (const error of plan.summary.errors!) {
    console.log(`  - ${error}`);
  }

  // Even with errors, operations are still available
  // so you can inspect what was attempted
  console.log(`Attempted ${plan.operations.length} operations before error`);
}
```

Common errors:

- **Circular dependencies**: Operation A depends on B, B depends on A
- **Missing dependencies**: Operation references a non-existent dependency
- **Too many operations**: Plan exceeds maxOperations limit
- **Invalid dependency**: Trying to depend on a delete operation

## Return Types

### ExecutionPlan

```typescript
interface ExecutionPlan {
  operations: Operation[];        // Ordered list of operations
  metadata: PlanMetadata;         // Generation metadata
  summary: PlanSummary;           // Statistics
}
```

### Operation

```typescript
interface Operation {
  type: 'create' | 'update' | 'delete';
  model: string;                  // Odoo model name
  id: string;                     // Identifies record
  values?: Record<string, any>;   // Fields for create/update
  dependencies?: string[];        // Operation IDs this depends on
  reason?: string;                // Why this operation exists
}
```

## Integration with Compare & Apply

Typical workflow:

```typescript
// Step 1: Compare desired vs actual
const diffs = compareRecords(
  'project.task',
  desiredStates,
  actualStates,
  { fieldMetadata }
);

// Step 2: Plan the changes
const plan = generatePlan(diffs, {
  autoReorder: true,
  validateDependencies: true,
});

// Step 3: Review before applying
console.log(formatPlanForConsole(plan));

// Step 4: Apply if approved
if (!plan.summary.hasErrors) {
  const result = await applyPlan(plan, odooClient);
  console.log(`Applied ${result.applied} operations`);
}
```

## Testing

Run plan tests:

```bash
npm test -- packages/odoo-state-manager/tests/plan.test.ts
npm test -- packages/odoo-state-manager/tests/formatter.test.ts
```

Test coverage:
- 19 plan generator tests (operation generation, ordering, validation)
- 32 formatter tests (output styling, colors, value formatting)
- Edge cases (empty plans, errors, many fields)

## Performance

- **Plan generation**: O(n) where n = number of diffs
- **Dependency resolution**: O(n²) worst case (circular detection)
- **Formatting**: O(m) where m = total field values in plan

Typical performance:
- 100 diffs → ~5ms
- 1000 diffs → ~50ms
- 10000 diffs → ~500ms (might error due to maxOperations limit)

## Future Enhancements

- **Batching**: Combine multiple writes to same model
- **Dry-run visualization**: Show exact values before/after
- **Rollback planning**: If apply fails, how to rollback
- **External ID support**: Reference records by external IDs
- **Validation hooks**: Custom pre-apply validation
  - Handle dependencies
- **formatter.ts**: Plan formatting for console output
  - Terraform-like output format
  - Color coding (green add, yellow change, red delete)
  - Human-readable summary
- **validate.ts**: Plan validation

## Implementation Notes

- Read current state from Odoo using client
- Compare with desired state using compare module
- Generate ordered list of operations (create, update, delete)
- Handle dependencies (e.g., create parent before children)
- Provide clear output showing what will change
