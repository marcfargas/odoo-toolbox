# Apply Module

Executes plans against Odoo, applying creates, updates, and deletes in safe order.

## Overview

The apply module is the final step in the state management workflow:
1. **Compare** - Detect drift (desired vs actual) ✅
2. **Plan** - Generate execution plan ✅
3. **Apply** - Execute changes atomically ← You are here

## Core Functions

### `applyPlan()`

Execute an execution plan against Odoo:

```typescript
import { applyPlan } from '@odoo-toolbox/state-manager';

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

**Features:**
- Executes operations in order (respecting dependencies)
- Maps temporary IDs to real database IDs
- Resolves ID references in operation values
- Supports progress callbacks
- Validates operations before execution
- Error handling with optional continuation
- Tracks execution timing and results

### `dryRunPlan()`

Validate plan without making actual changes:

```typescript
import { dryRunPlan } from '@odoo-toolbox/state-manager';

const dryRunResult = await dryRunPlan(plan, client, {
  validate: true,
});

console.log(`Would apply ${dryRunResult.applied} operations`);
if (!dryRunResult.success) {
  console.log('Validation errors:', dryRunResult.errors);
}
```

## Operation Execution

### Create Operations

Creates new records in Odoo:

```typescript
{
  type: 'create',
  model: 'project.task',
  id: 'project.task:temp_1',
  values: {
    name: 'New Task',
    priority: 'high',
    project_id: 100
  }
}
```

**Process:**
1. Validates operation structure
2. Resolves any ID references in values
3. Calls `OdooClient.create(model, values, context)`
4. Maps temporary ID to returned database ID
5. Returns created ID for use in dependent operations

**Handled in Odoo source:**
- [odoo/models.py:BaseModel.create()](https://github.com/odoo/odoo/blob/17.0/odoo/models.py#L3800)

### Update Operations

Updates existing records:

```typescript
{
  type: 'update',
  model: 'project.task',
  id: 'project.task:5',
  values: {
    priority: 'urgent',
    assigned_to: 2
  }
}
```

**Process:**
1. Validates record ID exists (no temp IDs allowed)
2. Resolves ID references in values
3. Calls `OdooClient.write(model, id, values, context)`
4. Returns true on success

**Handled in Odoo source:**
- [odoo/models.py:BaseModel.write()](https://github.com/odoo/odoo/blob/17.0/odoo/models.py#L4100)

### Delete Operations

Removes records from Odoo:

```typescript
{
  type: 'delete',
  model: 'project.task',
  id: 'project.task:5'
}
```

**Process:**
1. Validates record ID exists
2. Calls `OdooClient.unlink(model, id)`
3. Returns true on success

**Handled in Odoo source:**
- [odoo/models.py:BaseModel.unlink()](https://github.com/odoo/odoo/blob/17.0/odoo/models.py#L4400)

## ID Mapping & References

When creating records with relationships to other new records, the apply module resolves temporary IDs:

### Example: Create Parent then Child

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

// result.idMapping:
// {
//   'project.project:temp_1' => 100,  // Real DB ID
//   'project.task:temp_1' => 101      // Real DB ID
// }

// When creating task, project_id is resolved to 100
```

**How it works:**
1. First operation creates project, returns ID 100
2. ID mapping stores: `'project.project:temp_1' => 100`
3. Second operation has value `project_id: 'project.project:temp_1'`
4. Apply module resolves to `project_id: 100` before calling create
5. Task is created with correct project reference

### Resolving References

References are resolved recursively through:
- Top-level field values
- Nested objects
- Arrays of values

Only references in `model:id` format matching mapped temp IDs are resolved.

## Return Types

### ApplyResult

```typescript
interface ApplyResult {
  operations: OperationResult[];     // All operation results
  total: number;                     // Total operations
  applied: number;                   // Successful operations
  failed: number;                    // Failed operations
  success: boolean;                  // All succeeded?
  duration: number;                  // Total time in ms
  startTime: Date;                   // Start timestamp
  endTime: Date;                     // End timestamp
  idMapping: Map<string, number>;    // Temp ID to real ID mapping
  errors?: string[];                 // Error messages if any
}
```

### OperationResult

```typescript
interface OperationResult {
  operation: Operation;       // Original operation
  success: boolean;          // Did it succeed?
  result?: any;              // Return value (ID, true, etc)
  error?: Error;             // Error if failed
  duration: number;          // Time in ms
  actualId?: number;         // Real ID after execution
}
```

## Options

### dryRun

Run validation without making changes (default: false):

```typescript
const result = await applyPlan(plan, client, {
  dryRun: true  // No changes to Odoo
});
```

### stopOnError

Stop execution on first error (default: true):

```typescript
// Stop on first failure
await applyPlan(plan, client, { stopOnError: true });

// Continue despite errors
await applyPlan(plan, client, { stopOnError: false });
```

### onProgress

Progress callback after each operation:

```typescript
await applyPlan(plan, client, {
  onProgress: (current, total, operationId) => {
    console.log(`Progress: ${current}/${total}`);
    updateProgressBar(current / total);
  }
});
```

### onOperationComplete

Callback after each operation completes:

```typescript
await applyPlan(plan, client, {
  onOperationComplete: (result) => {
    if (!result.success) {
      console.log(`Failed: ${result.error?.message}`);
    }
  }
});
```

### validate

Validate operations before execution (default: true):

```typescript
// Check for errors without executing
const result = await dryRunPlan(plan, client, {
  validate: true
});

if (!result.success) {
  console.log('Validation errors:', result.errors);
}
```

### context

Base context for all operations:

```typescript
await applyPlan(plan, client, {
  context: {
    lang: 'es_ES',
    tracking_disable: true,
  }
});
```

Context from plan operations is merged with base context, with operation context taking precedence.

### maxOperations

Limit plan size (default: no limit):

```typescript
// Reject plans with > 1000 operations
await applyPlan(plan, client, {
  maxOperations: 1000
});
```

## Error Handling

Operations can fail for various reasons:

### Validation Errors

Caught before execution:

- Invalid operation structure
- Temporary IDs in update/delete operations
- Unresolved ID references
- Too many operations

### Execution Errors

Caught from Odoo:

- Permission denied
- Invalid field value
- Constraint violation
- Missing required field
- Record not found

### Error Results

```typescript
const result = await applyPlan(plan, client);

if (!result.success) {
  console.log(`Applied ${result.applied}/${result.total}`);
  console.log('Errors:', result.errors);
  
  // Inspect individual operation failures
  result.operations
    .filter(op => !op.success)
    .forEach(op => {
      console.log(`${op.operation.type} ${op.operation.model}: ${op.error?.message}`);
    });
}
```

## Progress Monitoring

For long-running apply operations:

```typescript
const result = await applyPlan(plan, client, {
  onProgress: (current, total, opId) => {
    console.log(`[${current}/${total}] ${opId}`);
  },
  onOperationComplete: (opResult) => {
    if (!opResult.success) {
      console.error(`Failed: ${opResult.error?.message}`);
    } else {
      console.log(`✓ ${opResult.operation.type} took ${opResult.duration}ms`);
    }
  }
});
```

## Integration with Compare & Plan

Typical complete workflow:

```typescript
import {
  compareRecords,
  generatePlan,
  formatPlanForConsole,
  applyPlan,
} from '@odoo-toolbox/state-manager';

// Step 1: Compare desired vs actual
const diffs = compareRecords(
  'project.task',
  desiredStates,
  actualStates,
  { fieldMetadata }
);

// Step 2: Generate plan
const plan = generatePlan(diffs, { autoReorder: true });

// Step 3: Review
console.log(formatPlanForConsole(plan));

// Step 4: Dry-run to validate
const dryRun = await applyPlan(plan, client, { dryRun: true });
if (!dryRun.success) {
  console.log('Validation failed:', dryRun.errors);
  process.exit(1);
}

// Step 5: Apply for real
const result = await applyPlan(plan, client, {
  stopOnError: false,
  onProgress: (current, total) => {
    console.log(`Applied ${current}/${total}`);
  }
});

console.log(`Success: ${result.applied}/${result.total}`);
console.log('ID mappings:', result.idMapping);
```

## Limitations & Future Enhancements

### Current (Phase 2)

- ✅ Sequential operation execution
- ✅ ID reference resolution
- ✅ Dry-run validation
- ✅ Error handling with continuation option
- ✅ Progress callbacks

### Future (Phase 3+)

- Batch operations for performance (multi-write, multi-create)
- Transaction rollback on failure
- Operation cancellation/pause
- Retry logic for transient failures
- Conflict resolution for concurrent changes
- External ID support for record matching
- Custom validators and hooks

## Testing

Run apply tests:

```bash
npm test -- packages/odoo-state-manager/tests/apply.test.ts
```

Test coverage (41 tests):
- Operation execution (create, update, delete)
- ID mapping and reference resolution
- Error handling (stop/continue on error)
- Validation
- Dry-run mode
- Callbacks and progress tracking
- Timing and metadata
- Edge cases (unresolved references, invalid IDs)

## Performance

- **Sequential execution**: O(n) where n = number of operations
- **ID resolution**: O(m) where m = total field values
- **Typical performance**: 100 operations ~5-10 seconds (depending on Odoo)

For faster execution, consider:
1. Batch operations in plan (coming Phase 3)
2. Reduce number of fields in updates
3. Disable validation in dry-run if not needed
4. Use context variables for bulk behavior (tracking_disable, etc)

## Best Practices

1. **Always dry-run first** - Validate plan structure before applying
2. **Use stopOnError for safety** - Stop at first problem (default)
3. **Review plan output** - Use formatPlanForConsole before applying
4. **Handle errors gracefully** - Check result.errors for production
5. **Monitor progress** - Use onProgress for visibility in long operations
6. **Validate input** - Ensure desired state makes sense before comparing
7. **Use context for optimization** - Set tracking_disable, mail_create_nolog, etc
8. **Test against staging** - Always validate against staging Odoo first
