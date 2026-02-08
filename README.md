# odoo-toolbox

> Battle-tested Odoo knowledge for AI agents, validated against real Odoo v17 instances in CI.

**odoo-toolbox** teaches AI agents (Claude Code, Cursor, etc.) how to work with Odoo ERP. It provides tested knowledge modules, a TypeScript RPC client, and schema introspection tools.

## Knowledge Modules

The [`skills/`](./skills/) directory contains the core product — progressive, tested documentation that AI agents load on demand:

| Module | What it teaches |
|--------|-----------------|
| [connection](./skills/base/connection.md) | Authentication and session management |
| [field-types](./skills/base/field-types.md) | Odoo type system and read/write asymmetry |
| [domains](./skills/base/domains.md) | Query filter syntax and composition |
| [crud](./skills/base/crud.md) | Create, Read, Update, Delete operations |
| [search](./skills/base/search.md) | Search and filtering patterns |
| [introspection](./skills/base/introspection.md) | Discover models and fields dynamically |
| [properties](./skills/base/properties.md) | Dynamic user-defined fields |
| [modules](./skills/base/modules.md) | Module lifecycle management |

Plus: [mail system](./skills/mail/) (chatter, activities, discuss), [timesheets](./skills/modules/timesheets.md), [MIS Builder](./skills/oca/mis-builder.md).

All code examples are **extracted and tested against real Odoo v17** in CI.

## Quick Start

### Option 1: Download Pre-built Skills

Download `odoo-skills.zip` from the [latest CI build](https://github.com/marcfargas/odoo-toolbox/actions) (look for the "odoo-skills" artifact).

```bash
unzip odoo-skills.zip
cd odoo-skills
cp .env.example .env  # Add your Odoo credentials
```

### Option 2: Scaffold a Custom Skill Project

```bash
npx @odoo-toolbox/create-skills my-odoo-skills
cd my-odoo-skills
cp .env.example .env  # Configure your Odoo credentials
```

Then point your AI agent to the project and ask it to connect, introspect, and work with your Odoo instance.

## TypeScript Packages

The skills are backed by tested TypeScript infrastructure:

| Package | Description | Status |
|---------|-------------|--------|
| [@odoo-toolbox/client](./packages/odoo-client) | Lightweight RPC client for Odoo | Active |
| [@odoo-toolbox/introspection](./packages/odoo-introspection) | Schema introspection and type generation | Active |
| [@odoo-toolbox/create-skills](./packages/create-skills) | CLI to scaffold skill projects | Active |
| [@odoo-toolbox/state-manager](./packages/odoo-state-manager) | Drift detection and plan/apply (Terraform-style) | Experimental |

## Contributing

```bash
git clone https://github.com/marcfargas/odoo-toolbox.git
cd odoo-toolbox
npm install
npm test
```

See [DEVELOPMENT.md](./DEVELOPMENT.md) for setup, testing, and contribution guidelines.
See [AGENTS.md](./AGENTS.md) for AI assistant coding conventions.

## License

- **Code**: LGPL-3.0 — see [LICENSE](./LICENSE)
- **Knowledge modules** (`skills/`): [CC-BY-4.0](./skills/LICENSE)
