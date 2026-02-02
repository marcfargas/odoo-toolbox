# odoo-toolbox

> TypeScript infrastructure-as-code toolkit for Odoo ERP

**odoo-toolbox** provides typed client libraries and state management for Odoo, enabling Infrastructure-as-Code workflows with drift detection and plan/apply capabilities - think **Terraform for Odoo**.

## Features

- **Schema Introspection** - Generate TypeScript types from your live Odoo instance
- **Type-Safe Client** - Fully typed Odoo operations with autocomplete
- **Drift Detection** - Compare desired state vs actual Odoo state
- **Plan/Apply Workflow** - Review changes before applying (like Terraform)
- **Odoo v17 Ready** - Full support for v17, v14+ planned
- **Batteries Included** - Context, batching, error handling, Odoo field quirks

## Packages

| Package | Description | Docs |
|---------|-------------|------|
| **@odoo-toolbox/client** | Lightweight RPC client for Odoo operations | [README](./packages/odoo-client/README.md) |
| **@odoo-toolbox/introspection** | Schema introspection and TypeScript code generation | [README](./packages/odoo-introspection/README.md) |
| **@odoo-toolbox/state-manager** | Drift detection and plan/apply workflow | [README](./packages/odoo-state-manager/README.md) |

## Installation

```bash
# Core packages
npm install @odoo-toolbox/client @odoo-toolbox/state-manager

# For code generation (dev dependency)
npm install --save-dev @odoo-toolbox/introspection
```

## Quick Start

See each package README for detailed usage:

1. **[Client](./packages/odoo-client/README.md)** - Connect to Odoo, CRUD operations, module management
2. **[Introspection](./packages/odoo-introspection/README.md)** - Generate TypeScript types from schema
3. **[State Manager](./packages/odoo-state-manager/README.md)** - Compare, plan, apply workflow

Or explore the examples in each package:

- **[odoo-client examples](./packages/odoo-client/examples/)** - Connection, CRUD, search, context, module management
- **[odoo-introspection examples](./packages/odoo-introspection/examples/)** - Schema introspection, type generation
- **[odoo-state-manager examples](./packages/odoo-state-manager/examples/)** - State management, CI/CD validation

## Managing Odoo Modules

The client package now includes module management capabilities:

```bash
# Install a module
npm run addon:install project

# Uninstall a module
npm run addon:uninstall project

# List installed modules
npm run addon:list installed

# Get module information
npm run addon:info sale
```

For programmatic usage:

```typescript
import { OdooClient, ModuleManager } from '@odoo-toolbox/client';

const client = new OdooClient({ /* config */ });
await client.authenticate();

const moduleManager = new ModuleManager(client);
await moduleManager.installModule('project');
await moduleManager.uninstallModule('project');
```

See [packages/odoo-client/examples/5-module-management.ts](./packages/odoo-client/examples/5-module-management.ts) for complete examples.

## Use Cases

- **Infrastructure as Code for Odoo** - Define state declaratively
- **Type-Safe Migrations** - Generate types, safely transform data
- **Configuration Management** - Version control Odoo configuration
- **CI/CD Integration** - Validate configuration before deployment
- **Multi-Tenant Management** - Replicate setup across instances

## Documentation

| Document | Audience | Purpose |
|----------|----------|---------|
| [docs/meta-skills/](./docs/meta-skills/) | AI Agents | Meta-skills for learning Odoo patterns and generating instance-specific commands |
| [packages/odoo-client/examples](./packages/odoo-client/examples/) | Users | Client examples: connection, CRUD, search, context, modules |
| [packages/odoo-introspection/examples](./packages/odoo-introspection/examples/) | Users | Introspection examples: schema discovery, type generation |
| [packages/odoo-state-manager/examples](./packages/odoo-state-manager/examples/) | Users | State manager examples: drift detection, plan/apply |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Contributors | Setup, testing, contributing |
| [AGENTS.md](./AGENTS.md) | AI Assistants | Coding patterns, Odoo knowledge |
| [ROADMAP.md](./ROADMAP.md) | All | Future vision and design decisions |
| [TODO.md](./TODO.md) | Contributors | Implementation tasks |

## Status

**Stage**: Early Development
**Current Focus**: State Manager Foundation (Compare, Plan, Apply)
**Odoo Versions**: v17 (v14+ planned)
**TypeScript**: 5.0+ | **Node.js**: 18+

## License

LGPL-3.0 - see [LICENSE](./LICENSE)
