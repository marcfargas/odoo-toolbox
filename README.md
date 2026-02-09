# odoo-toolbox

> Battle-tested Odoo knowledge for AI agents, validated against real Odoo v17 instances in CI.

**odoo-toolbox** teaches AI agents (Claude Code, Cursor, etc.) how to work with Odoo ERP. It provides tested knowledge modules, a TypeScript RPC client, and schema introspection tools.

## Knowledge Modules

The [`skills/odoo/`](./skills/odoo/) directory contains the core product — progressive, tested documentation that AI agents load on demand:

| Module | What it teaches |
|--------|-----------------|
| [connection](./skills/odoo/base/connection.md) | Authentication and session management |
| [field-types](./skills/odoo/base/field-types.md) | Odoo type system and read/write asymmetry |
| [domains](./skills/odoo/base/domains.md) | Query filter syntax and composition |
| [crud](./skills/odoo/base/crud.md) | Create, Read, Update, Delete operations |
| [search](./skills/odoo/base/search.md) | Search and filtering patterns |
| [introspection](./skills/odoo/base/introspection.md) | Discover models and fields dynamically |
| [properties](./skills/odoo/base/properties.md) | Dynamic user-defined fields |
| [modules](./skills/odoo/base/modules.md) | Module lifecycle management |

Plus: [mail system](./skills/odoo/mail/) (chatter, activities, discuss), [timesheets](./skills/odoo/modules/timesheets.md), [MIS Builder](./skills/odoo/oca/mis-builder.md).

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
npx @marcfargas/create-odoo-skills my-odoo-skills
cd my-odoo-skills
cp .env.example .env  # Configure your Odoo credentials
```

Then point your AI agent to the project and ask it to connect, introspect, and work with your Odoo instance.

## TypeScript Packages

The skills are backed by tested TypeScript infrastructure:

| Package | Description | Status |
|---------|-------------|--------|
| [@marcfargas/odoo-client](./packages/odoo-client) | Lightweight RPC client for Odoo | Active |
| [@marcfargas/odoo-introspection](./packages/odoo-introspection) | Schema introspection and type generation | Active |
| [@marcfargas/create-odoo-skills](./packages/create-skills) | CLI to scaffold skill projects | Active |
| [@marcfargas/odoo-state-manager](./packages/odoo-state-manager) | Drift detection and plan/apply (Terraform-style) | Experimental |

## Prerequisites

- **Node.js** ≥ 18
- **Odoo** v17 instance (for integration tests / real usage)

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

**Code** (`packages/`): [LGPL-3.0](./LICENSE)

**Skills** (`skills/`): [CC0 1.0 Universal](./skills/odoo/LICENSE) — **public domain**.
Use the knowledge freely in any project, commercial or not, with no attribution required.
AI agents, companies, competing projects — zero restrictions, zero friction.

## Bugs & Support

[GitHub Issues](https://github.com/marcfargas/odoo-toolbox/issues)
