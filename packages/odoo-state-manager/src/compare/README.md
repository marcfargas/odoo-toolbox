# Compare Module

Detects drift between desired and actual Odoo state by performing deep comparisons with Odoo-specific field handling.

## Overview

The compare module is the first step in the state management workflow:
1. **Compare** - Detect drift (desired vs actual)
2. **Plan** - Generate execution plan
3. **Apply** - Execute changes atomically

## Core Functions

### `compareRecord()`

Compare a single record's desired vs actual state:

```typescript
import { compareRecord } from '@odoo-toolbox/state-manager';

const changes = compareRecord(
  'project.task',
  1,
  { name: 'Updated Task', priority: 'high' },
  { name: 'Old Task', priority: 'medium' }
);

// Returns:
// [
//   {
//     path: 'name',
//     operation: 'update',
//     newValue: 'Updated Task',
//     oldValue: 'Old Task'
//   },
//   {
//     path: 'priority',
//     operation: 'update',
//     newValue: 'high',
//     oldValue: 'medium'
//   }
// ]
```

### `compareRecords()`

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

const diffs = compareRecords(
  'project.task',
  desiredStates,
  actualStates
);

// Returns diffs for record ID 1 only (record 2 has no changes)
```

## Odoo Field Type Handling

The module automatically normalizes Odoo-specific field formats for comparison:

### Many2One Fields

Odoo returns `many2one` fields as `[id, display_name]` tuples in `read()` operations, but accepts just the ID in `create()`/`write()` operations.

```typescript
// Odoo returns: [5, 'ACME Corp']
// Desired state: 5
// Result: No change detected ✓

const changes = compareRecord(
  'project.task',
  1,
  { project_id: 5 },
  { project_id: [5, 'ACME Corp'] }
);
// changes.length === 0
```

**Source**: [odoo/fields.py:Many2one.convert_to_read()](https://github.com/odoo/odoo/blob/17.0/odoo/fields.py#L2156)

### One2Many / Many2Many Fields

Relational arrays are compared by content, not order. Arrays with the same IDs but different order are considered equal:

```typescript
// Order-independent comparison
const changes = compareRecord(
  'project.project',
  1,
  { task_ids: [1, 2, 3] },
  { task_ids: [3, 2, 1] }
);
// changes.length === 0 (same IDs, different order)
```

### Null / Undefined Handling

Both `null` and `undefined` are normalized to `null` for consistent comparison:

```typescript
const changes = compareRecord(
  'project.task',
  1,
  { description: null },
  {} // undefined in actual state
);
// Changes detected because desired explicitly sets to null
```

## Field Metadata Support

Provide field metadata (from introspection) to skip readonly and computed fields:

```typescript
const fieldMetadata = new Map([
  [
    'project.task',
    new Map([
      [
        'create_date',
        {
          name: 'create_date',
          ttype: 'datetime',
          readonly: true, // ← Skip in comparison
          // ... other field properties
        },
      ],
      [
        'progress',
        {
          name: 'progress',
          ttype: 'float',
          compute: '_compute_progress', // ← Skip in comparison
          // ... other field properties
        },
      ],
    ]),
  ],
]);

const changes = compareRecord(
  'project.task',
  1,
  { create_date: '2024-01-01', progress: 50 },
  { create_date: '2024-01-02', progress: 25 },
  { fieldMetadata }
);
// changes.length === 0 (both fields skipped)
```

**Handled in Odoo source**:
- Readonly fields: [odoo/fields.py](https://github.com/odoo/odoo/blob/17.0/odoo/fields.py)
- Computed fields: [odoo/fields.py:compute parameter](https://github.com/odoo/odoo/blob/17.0/odoo/fields.py#L1234)

## Custom Comparators

For complex field types or custom comparison logic, provide custom comparators:

```typescript
const customComparators = new Map<string, (desired: any, actual: any) => boolean>([
  [
    'tags',
    (desired, actual) => {
      // Ignore whitespace and case in tag comparison
      const normalize = (s: string) => s.trim().toLowerCase();
      return normalize(desired) === normalize(actual);
    },
  ],
]);

const changes = compareRecord(
  'project.task',
  1,
  { tags: 'urgent, important' },
  { tags: 'URGENT, IMPORTANT' },
  { customComparators }
);
// changes.length === 0 (custom comparator says they're equal)
```

## Return Types

### FieldChange

Single field change detected:

```typescript
interface FieldChange {
  /** Field path (e.g., 'name', 'partner_id') */
  path: string;

  /** 'create' | 'update' | 'delete' */
  operation: 'create' | 'update' | 'delete';

  /** The desired value */
  newValue: any;

  /** The actual value from Odoo (null if didn't exist) */
  oldValue: any | null;
}
```

### ModelDiff

All changes for a single model instance:

```typescript
interface ModelDiff {
  /** Odoo model name */
  model: string;

  /** Record ID */
  id: number;

  /** All field changes for this record */
  changes: FieldChange[];

  /** Whether this is a new record (not in actual state) */
  isNew: boolean;

  /** Parent relationship (for one2many creates) - reserved for future use */
  parentReference?: {
    field: string;
    parentModel: string;
    parentId: number;
  };
}
```

## Edge Cases

### Null vs Undefined

```typescript
// Desired has explicit null
compareRecord('model', 1, { field: null }, {});
// → operation: 'create', newValue: null

// Desired has explicit value, actual is undefined
compareRecord('model', 1, { field: 'value' }, {});
// → operation: 'create', newValue: 'value'
```

### Empty Collections

```typescript
// Empty desired array vs non-empty actual
compareRecord('model', 1, { ids: [] }, { ids: [1, 2, 3] });
// → operation: 'update', newValue: [], oldValue: [1, 2, 3]
```

### Nested Objects

Deep comparison is recursive:

```typescript
compareRecord(
  'model',
  1,
  { metadata: { status: 'active', count: 5 } },
  { metadata: { status: 'inactive', count: 5 } }
);
// → Detects change in nested 'status' field
```

## Performance Notes

- **Array normalization for relational fields** is O(n log n) due to sorting, but relational arrays are typically small (< 100 items)
- **Deep equality** uses recursive comparison suitable for typical Odoo record sizes
- **Field metadata filtering** is O(1) with Map lookups

For large-scale comparisons (1000+ records), consider batching and parallel processing in the plan/apply layers.

## Integration with Plan/Apply

The compare module is used by the plan generator:

```typescript
// Typical workflow
const changes = compareRecords('project.task', desiredStates, actualStates, {
  fieldMetadata: introspectedMetadata,
});

// Plan generator processes diffs
const plan = generatePlan(changes);

// Apply executor validates and executes
await applyPlan(plan, odooClient);
```

See [../plan/README.md](../plan/README.md) for the next step.

## Testing

Full test coverage includes:
- Primitive field types (string, number, boolean)
- Odoo-specific types (many2one, one2many, many2many)
- Readonly and computed field filtering
- Custom comparators
- Multiple record comparison
- Edge cases (null, undefined, nested objects)

Run tests:
```bash
npm test -- packages/odoo-state-manager/tests/compare.test.ts
```
  - Handle one2many/many2many (array comparison)
  - Ignore readonly/computed fields
- **diff.ts**: Diff type and formatting
  - `Diff` interface (field path, old value, new value, change type)
  - Human-readable diff output
- **utils.ts**: Comparison utilities

## Implementation Notes

- Recursive comparison for nested objects
- Handle Odoo-specific types (many2one returns [id, name])
- Generate diffs at field level for granular changes
- Change types: create, update, delete
- Skip computed/readonly fields in comparison
