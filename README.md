# odoo-toolbox

> TypeScript infrastructure-as-code toolkit for Odoo ERP

**odoo-toolbox** provides typed client libraries and state management for Odoo, enabling Infrastructure-as-Code workflows with drift detection and plan/apply capabilities - think Terraform, but for Odoo.

## ✨ Features

- 🔍 **Schema Introspection**: Generate TypeScript types from your live Odoo instance
- 🎯 **Type-Safe Client**: Fully typed Odoo operations with autocomplete
- 📊 **Drift Detection**: Compare desired state vs actual Odoo state
- 📋 **Plan/Apply Workflow**: Review changes before applying (like Terraform)
- 🔌 **Multi-Version**: Support for Odoo v14+ (starting with v17)
- 🎁 **Batteries Included**: Context management, batching, error handling built-in

## 🚀 Quick Start

### Installation

```bash
npm install @odoo-toolbox/client @odoo-toolbox/state-manager
```

### Generate Types

```bash
npx odoo-client generate \
  --url https://myodoo.com \
  --database mydb \
  --username admin \
  --password admin \
  --output ./src/generated
```

### Use Typed Client

```typescript
import { OdooClient } from '@odoo-toolbox/client';
import { ProjectProject } from './generated/models';

const client = new OdooClient({
  url: 'https://myodoo.com',
  database: 'mydb',
  username: 'admin',
  password: 'admin'
});

// Type-safe operations
const projects = await client.search<ProjectProject>('project.project', [
  ['active', '=', true]
]);

// Create with autocomplete
await client.create<ProjectProject>('project.project', {
  name: 'New Project',
  user_id: 1
});
```

### State Management

```typescript
import { StateManager } from '@odoo-toolbox/state-manager';
import { ProjectProject } from './generated/models';

const manager = new StateManager(client);

// Define desired state
const desiredState: ProjectProject = {
  name: 'Q1 Planning',
  active: true,
  task_ids: [
    { name: 'Research Phase', stage_id: { name: 'Todo' } },
    { name: 'Implementation', stage_id: { name: 'In Progress' } }
  ]
};

// Detect drift
const plan = await manager.plan('project.project', desiredState);

// Review changes
console.log(plan.changes);
// - Create task "Research Phase"
// - Update task "Implementation" stage: "Done" → "In Progress"

// Apply changes
if (plan.hasChanges) {
  await manager.apply(plan);
}
```

## 📦 Packages

This monorepo contains:

### @odoo-toolbox/client

RPC client with schema introspection and code generation.

- JSON-RPC and XML-RPC support
- Model introspection via `ir.model` and `ir.model.fields`
- TypeScript interface generation
- Context and domain filter support
- Batch operations

### @odoo-toolbox/state-manager

Declarative state management with plan/apply workflow.

- Deep diff algorithm for Odoo models
- Drift detection (current vs desired state)
- Execution plan generation
- Atomic apply operations
- Rollback support (planned)

## 🎯 Use Cases

- **Infrastructure as Code**: Define your Odoo configuration in TypeScript
- **Migration Scripts**: Type-safe data migrations between Odoo instances
- **CI/CD Integration**: Validate Odoo state in deployment pipelines
- **Testing**: Snapshot testing of Odoo configurations
- **Multi-Tenancy**: Manage multiple Odoo instances with code

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│   Your Application/Script          │
├─────────────────────────────────────┤
│  Generated Types (from your Odoo)   │
├─────────────────────────────────────┤
│  @odoo-toolbox/state-manager        │
│  - Compare, Plan, Apply             │
├─────────────────────────────────────┤
│  @odoo-toolbox/client               │
│  - RPC, Introspection, Codegen      │
├─────────────────────────────────────┤
│  Odoo Instance (v14+)               │
│  - JSON-RPC / XML-RPC               │
└─────────────────────────────────────┘
```

## 🛣️ Roadmap

- [x] Project setup and architecture
- [ ] Basic RPC client (JSON-RPC, XML-RPC)
- [ ] Schema introspection
- [ ] TypeScript code generation
- [ ] Basic CRUD operations
- [ ] Drift detection
- [ ] Plan generation
- [ ] Apply execution
- [ ] CI/CD with Odoo containers
- [ ] Multi-version support
- [ ] Rollback capabilities
- [ ] Plugin system
- [ ] VS Code extension

See [ROADMAP.md](./ROADMAP.md) for details.

## 🤝 Contributing

Contributions are welcome! This project follows a batteries-included philosophy:

- Comprehensive over minimal
- Type-safety first
- Pragmatic solutions
- Great developer experience

See [AGENTS.md](./AGENTS.md) for development guidelines.

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

## 🙏 Acknowledgments

- Inspired by Terraform's declarative approach
- Built for the Odoo Community Association (OCA) ecosystem
- Developed alongside the BGBL BizLang project
- Focused on Community Edition with OCA modules

---

**Status**: 🚧 Early Development - APIs will change

**Odoo Target**: OCA (Odoo Community Association) / Community Edition - focuses on open-source Odoo, with potential Enterprise compatibility

**Odoo Versions**: v17 (initially), v14+ (planned)

**TypeScript**: 5.0+

**Node.js**: 18+
