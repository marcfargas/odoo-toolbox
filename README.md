# odoo-toolbox

> TypeScript infrastructure-as-code toolkit for Odoo ERP

**odoo-toolbox** provides typed client libraries and state management for Odoo, enabling Infrastructure-as-Code workflows with drift detection and plan/apply capabilities—think Terraform, but for Odoo.

## ✨ Features

- 🔍 **Schema Introspection** - Generate TypeScript types from your live Odoo instance
- 🎯 **Type-Safe Client** - Fully typed Odoo operations with autocomplete
- 📊 **Drift Detection** - Compare desired state vs actual Odoo state
- 📋 **Plan/Apply Workflow** - Review changes before applying (like Terraform)
- 🔌 **Multi-Version Support** - Odoo v14+, starting with v17
- 🎁 **Batteries Included** - Context, batching, error handling built-in

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

await client.authenticate();

// Type-safe search
const projects = await client.search('project.project', [
  ['active', '=', true]
]);

// Type-safe create
await client.create('project.project', {
  name: 'New Project',
  user_id: 1
});
```

### Declarative State Management

```typescript
import { StateManager } from '@odoo-toolbox/state-manager';

const manager = new StateManager(client);

// Define desired state
const desiredProject = {
  name: 'Q1 Planning',
  active: true,
  task_ids: [
    { name: 'Research', stage_id: 1 }
  ]
};

// Plan changes
const plan = await manager.plan('project.project', desiredProject);
console.log(plan.changes);

// Review and apply
if (plan.hasChanges) {
  await manager.apply(plan);
}
```

## 📦 Packages

- **@odoo-toolbox/client** - RPC client, schema introspection, code generation
- **@odoo-toolbox/state-manager** - Drift detection, plan/apply workflow

## 🎯 Use Cases

- Infrastructure as Code for Odoo
- Type-safe data migrations
- CI/CD configuration validation
- Multi-tenant Odoo management
- Configuration snapshot testing

## 📚 Documentation

- **[Examples](./examples/)** - Runnable code samples
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Setup, testing, contributing
- **[ROADMAP.md](./ROADMAP.md)** - Project roadmap
- **[AGENTS.md](./AGENTS.md)** - Architecture & implementation patterns

## 📄 License

MIT License - see [LICENSE](./LICENSE)

---

**Status**: 🚧 Early Development  
**Odoo Versions**: v17 (v14+ planned)  
**TypeScript**: 5.0+ | **Node.js**: 18+
