---
name: Odoo State Management
description: This skill should be used when the user asks to "manage Odoo state", "apply configuration to Odoo", "detect drift", "compare desired vs actual state", "plan/apply changes", "set up automations", "configure base.automation", "create server actions", or mentions infrastructure-as-code patterns for Odoo.
version: 0.1.0
---

# Odoo State Management

Declarative state management for Odoo using a Terraform-style compare/plan/apply workflow. Define desired state, detect drift from actual state, review a plan, and apply changes safely.

## Core Workflow

1. **Define desired state** — declare what records should exist across one or more models
2. **Read actual state** — fetch current records from the live Odoo instance
3. **Compare** — detect differences (creates, updates, deletes)
4. **Generate plan** — produce an ordered execution plan with dependency resolution
5. **Review** — inspect the plan in human-readable format before applying
6. **Validate** — check for reference integrity, circular dependencies, missing records
7. **Apply** — execute the plan against the Odoo instance (or dry-run first)
8. **Verify** — confirm the actual state matches the desired state

## Installation

```bash
npm install @marcfargas/odoo-state-manager @marcfargas/odoo-client
```

## Key Functions

```typescript
import {
  compareRecords,
  generatePlan,
  formatPlanForConsole,
  validatePlanReferences,
  applyPlan,
  dryRunPlan,
} from '@marcfargas/odoo-state-manager';
import { createClient } from '@marcfargas/odoo-client';
```

### Compare

```typescript
const diffs = compareRecords(desiredRecords, actualRecords, {
  fieldMetadata, // optional: skip readonly/computed fields
});
```

Handles Odoo field quirks: normalizes many2one `[id, name]` tuples, order-insensitive relational arrays.

### Plan

```typescript
const plan = generatePlan(diffs);
console.log(formatPlanForConsole(plan));
```

Output uses Terraform-like symbols: `+` create, `~` update, `-` delete. Operations are topologically sorted by dependencies.

### Validate and Apply

```typescript
const errors = await validatePlanReferences(plan, client);
if (errors.length === 0) {
  const result = await applyPlan(plan, client, {
    onProgress: (op, index, total) => console.log(`${index}/${total}: ${op.type} ${op.model}`),
  });
}
```

### Dry Run

```typescript
const result = await dryRunPlan(plan, client);
// Validates without making changes
```

## Temporary ID Resolution

When creating multiple related records, use temporary IDs:

```typescript
const desired = {
  'ir.actions.server': [
    { __temp_id: 'action_1', name: 'My Action', model_id: /* ... */ },
  ],
  'base.automation': [
    { name: 'My Rule', action_server_ids: ['ir.actions.server:action_1'] },
  ],
};
```

The apply step resolves `ir.actions.server:action_1` to the real database ID after creation.

## CLI Usage

```bash
# Dump current state
npx odoo state dump --model res.partner --domain '[["is_company","=",true]]'

# Compare desired vs actual
npx odoo state compare --file desired-state.json

# Load state from file
npx odoo state load --file desired-state.json
```

## Best Practices

- Always run `dryRunPlan` before `applyPlan` in production
- Use `formatPlanForConsole` to review changes before applying
- Pass `fieldMetadata` from introspection to skip computed/readonly fields
- Test state definitions against a staging instance first
- Use the `onProgress` callback for visibility during apply
