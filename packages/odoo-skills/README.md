# @marcfargas/odoo-skills

> Battle-tested Odoo knowledge modules for AI agents — 5,200+ lines validated against Odoo v17 in CI.

## What is this?

Ready-to-use knowledge that teaches AI agents (Claude Code, Cursor, etc.) how to work with Odoo ERP. Each module covers a specific topic with tested code examples.

## Installation

```bash
npm install @marcfargas/odoo-skills
```

Then point your AI agent to the skill files in `node_modules/@marcfargas/odoo-skills/skills/`.

Or use the scaffolding CLI for a standalone project:

```bash
npx @marcfargas/create-odoo-skills my-odoo-skills
```

## Modules

| Module | What it teaches |
|--------|-----------------|
| [SKILL.md](./skills/SKILL.md) | **Start here** — router and quick start |
| [connection](./skills/base/connection.md) | Authentication and session management |
| [field-types](./skills/base/field-types.md) | Odoo type system and read/write asymmetry |
| [domains](./skills/base/domains.md) | Query filter syntax and composition |
| [crud](./skills/base/crud.md) | Create, Read, Update, Delete operations |
| [search](./skills/base/search.md) | Search and filtering patterns |
| [introspection](./skills/base/introspection.md) | Discover models and fields dynamically |
| [properties](./skills/base/properties.md) | Dynamic user-defined fields |
| [modules](./skills/base/modules.md) | Module lifecycle management |

### Mail System

| Module | What it teaches |
|--------|-----------------|
| [chatter](./skills/mail/chatter.md) | Internal notes and public messages |
| [activities](./skills/mail/activities.md) | Activity scheduling and management |
| [discuss](./skills/mail/discuss.md) | Channels and direct messaging |

### Module-Specific

| Module | Required Odoo Modules | What it teaches |
|--------|----------------------|-----------------|
| [timesheets](./skills/modules/timesheets.md) | `hr_timesheet` | Time tracking on projects |
| [accounting](./skills/modules/accounting.md) | `account` | Accounting patterns |
| [mis-builder](./skills/oca/mis-builder.md) | `mis_builder` | OCA financial reports |

## Prerequisites

- **Node.js** ≥ 18 (for the `@marcfargas/odoo-client` library used in examples)
- **Odoo** v17 instance

## Related Packages

- [@marcfargas/odoo-client](https://www.npmjs.com/package/@marcfargas/odoo-client) — RPC client used in all examples
- [@marcfargas/odoo-introspection](https://www.npmjs.com/package/@marcfargas/odoo-introspection) — Schema discovery
- [@marcfargas/create-odoo-skills](https://www.npmjs.com/package/@marcfargas/create-odoo-skills) — Scaffold a skill project

## Bugs & Support

[GitHub Issues](https://github.com/marcfargas/odoo-toolbox/issues)

## License

[CC0 1.0 Universal](./skills/LICENSE) — **public domain**.
Use the knowledge freely in any project, commercial or not, with no attribution required.
