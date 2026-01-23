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

1. **[Client](./packages/odoo-client/README.md)** - Connect to Odoo, CRUD operations
2. **[Introspection](./packages/odoo-introspection/README.md)** - Generate TypeScript types from schema
3. **[State Manager](./packages/odoo-state-manager/README.md)** - Compare, plan, apply workflow

Or explore the [examples/](./examples/) directory for runnable code samples.

## Use Cases

- **Infrastructure as Code for Odoo** - Define state declaratively
- **Type-Safe Migrations** - Generate types, safely transform data
- **Configuration Management** - Version control Odoo configuration
- **CI/CD Integration** - Validate configuration before deployment
- **Multi-Tenant Management** - Replicate setup across instances

## Documentation

| Document | Audience | Purpose |
|----------|----------|---------|
| [examples/](./examples/) | Users | Runnable code samples (8 examples) |
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

MIT - see [LICENSE](./LICENSE)
