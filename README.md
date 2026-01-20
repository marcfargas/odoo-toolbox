# odoo-toolbox

> TypeScript infrastructure-as-code toolkit for Odoo ERP

**odoo-toolbox** provides typed client libraries and state management for Odoo, enabling Infrastructure-as-Code workflows with drift detection and plan/apply capabilities—think **Terraform for Odoo**.

## ✨ Features

- 🔍 **Schema Introspection** - Generate TypeScript types from your live Odoo instance  
- 🎯 **Type-Safe Client** - Fully typed Odoo operations with autocomplete  
- 📊 **Drift Detection** - Compare desired state vs actual Odoo state  
- 📋 **Plan/Apply Workflow** - Review changes before applying (like Terraform)  
- 🔌 **Odoo v17 Ready** - Full support for v17, v14+ planned  
- 🎁 **Batteries Included** - Context, batching, error handling, Odoo field quirks  

## 🚀 Quick Start

### Installation

```bash
npm install @odoo-toolbox/client @odoo-toolbox/state-manager
```

### 1. Connect to Odoo

```typescript
import { OdooClient } from '@odoo-toolbox/client';

const client = new OdooClient({
  url: 'https://myodoo.com',
  database: 'mydb',
  username: 'admin',
  password: 'admin'
});

await client.authenticate();
```

### 2. Compare Desired vs Actual State

```typescript
import { compareRecords } from '@odoo-toolbox/state-manager';

const desired = new Map([
  [1, { name: 'Task 1', priority: 'high' }],
  [2, { name: 'Task 2', priority: 'medium' }],
]);

const actual = new Map([
  [1, { name: 'Task 1', priority: 'medium' }],  // Different
  [2, { name: 'Task 2', priority: 'medium' }],  // Same
]);

const diffs = compareRecords('project.task', desired, actual);
// Returns: Changes detected in record 1 only
```

### 3. Generate Execution Plan

```typescript
import { generatePlan, formatPlanForConsole } from '@odoo-toolbox/state-manager';

const plan = generatePlan(diffs, {
  autoReorder: true,
  validateDependencies: true,
});

console.log(formatPlanForConsole(plan));
// Output:
// ~ project.task[1]
//   ~ priority = "medium" -> "high"
//
// Plan: 0 to add, 1 to change, 0 to destroy.
```

### 4. Apply Changes

```typescript
// Review and apply
if (!plan.summary.hasErrors) {
  const result = await applyPlan(plan, client);
  console.log(`Applied ${result.applied} operations`);
}
```

## 📦 Packages

### @odoo-toolbox/client

RPC client with schema introspection and code generation.

- Typed RPC calls with context support
- Automatic schema introspection from ir.model
- TypeScript code generation for custom modules

[📖 Client Documentation](./packages/odoo-client/README.md)

### @odoo-toolbox/state-manager

State management with drift detection and plan/apply workflow.

- **Compare Module** - Deep diff algorithm for Odoo field types
- **Plan Module** - Execution plan generation with dependency ordering
- **Apply Module** - Atomic change execution (Phase 2)

#### Compare Module

Detect drift between desired and actual Odoo state:

```typescript
import { compareRecord } from '@odoo-toolbox/state-manager';

const changes = compareRecord(
  'project.task',
  1,
  { name: 'Updated', priority: 'high' },      // Desired
  { name: 'Old', priority: 'medium' }         // Actual
);
```

**Features:**
- Handles Odoo field quirks (many2one returns `[id, name]`, order-independent arrays)
- Skips readonly and computed fields
- Custom comparators for special types
- Works with field metadata from introspection

[📖 Compare Module Documentation](./packages/odoo-state-manager/src/compare/README.md)

#### Plan Module

Generate ordered execution plans from comparison results:

```typescript
import { generatePlan, formatPlanForConsole } from '@odoo-toolbox/state-manager';

const plan = generatePlan(diffs, { autoReorder: true });

console.log(formatPlanForConsole(plan));
// Terraform-style output with color-coded operations
// + green = create, ~ yellow = update, - red = delete
```

**Features:**
- Topological ordering (creates before updates before deletes)
- Dependency resolution for relational records
- Terraform-like console formatting with ANSI colors
- Operation validation and error reporting

[📖 Plan Module Documentation](./packages/odoo-state-manager/src/plan/README.md)

[📖 State Manager Documentation](./packages/odoo-state-manager/README.md)

## 🎯 Workflow: Compare → Plan → Apply

The typical workflow mirrors Terraform:

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

## 🎯 Use Cases

- **Infrastructure as Code for Odoo** - Define state declaratively
- **Type-Safe Migrations** - Generate types, safely transform data
- **Configuration Management** - Version control Odoo configuration
- **CI/CD Integration** - Validate configuration before deployment
- **Multi-Tenant Management** - Replicate setup across instances
- **Configuration Snapshot Testing** - Assert expected state in tests

## 📚 Documentation

- **[Examples](./examples/)** - Runnable code samples (8 examples covering all features)  
- **[Integration Guide](./INTEGRATION_GUIDE.md)** - Complete workflow guide with patterns  
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Setup, testing, contributing  
- **[TODO.md](./TODO.md)** - Implementation roadmap  
- **[ROADMAP.md](./ROADMAP.md)** - Long-term roadmap  
- **[AGENTS.md](./AGENTS.md)** - Architecture & patterns for contributors  

## 🧪 Testing

```bash
npm test                    # Run all tests
npm test -- packages/odoo-state-manager  # Test state manager
npm test -- packages/odoo-client         # Test client
```

Current test status: ✅ 128 tests passing
- 27 compare module tests (field types, edge cases)
- 19 plan generator tests (ordering, validation)
- 32 formatter tests (output styling)

## 🔧 Development

See [DEVELOPMENT.md](./DEVELOPMENT.md) for:
- Environment setup
- Docker test infrastructure
- Running against live Odoo instances
- Contributing guidelines

## 📄 License

MIT License - see [LICENSE](./LICENSE)

---

**Status**: 🚧 Early Development  
**Current Focus**: State Manager Foundation (Compare ✅, Plan ✅, Apply 🚧)  
**Odoo Versions**: v17 (v14+ planned)  
**TypeScript**: 5.0+ | **Node.js**: 18+
