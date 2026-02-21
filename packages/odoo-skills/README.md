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
| [SKILL.md](./skills/odoo/SKILL.md) | **Start here** — router and quick start |
| [connection](./skills/odoo/base/connection.md) | Authentication and session management |
| [field-types](./skills/odoo/base/field-types.md) | Odoo type system and read/write asymmetry |
| [domains](./skills/odoo/base/domains.md) | Query filter syntax and composition |
| [crud](./skills/odoo/base/crud.md) | Create, Read, Update, Delete operations |
| [search](./skills/odoo/base/search.md) | Search and filtering patterns |
| [introspection](./skills/odoo/base/introspection.md) | Discover models and fields dynamically |
| [properties](./skills/odoo/base/properties.md) | Dynamic user-defined fields |
| [modules](./skills/odoo/base/modules.md) | Module lifecycle management |
| [skill-generation](./skills/odoo/base/skill-generation.md) | How to create new skills |

### Mail System

| Module | What it teaches |
|--------|-----------------|
| [chatter](./skills/odoo/mail/chatter.md) | Internal notes and public messages |
| [activities](./skills/odoo/mail/activities.md) | Activity scheduling and management |
| [discuss](./skills/odoo/mail/discuss.md) | Channels and direct messaging |

### Module-Specific

| Module | Required Odoo Modules | What it teaches |
|--------|----------------------|-----------------|
| [accounting](./skills/odoo/modules/accounting.md) | `account` | Accounting patterns, cash discovery, reconciliation, PnL, validation |
| [attendance](./skills/odoo/modules/attendance.md) | `hr_attendance` | Clock in/out, presence tracking |
| [contracts](./skills/odoo/modules/contracts.md) | `contract` (OCA) | Recurring contracts, billing schedules, revenue projection |
| [timesheets](./skills/odoo/modules/timesheets.md) | `hr_timesheet` | Time tracking on projects |
| [mis-builder](./skills/odoo/oca/mis-builder.md) | `mis_builder` | OCA financial reports (reading, computing, exporting) |
| [mis-builder-dev](./skills/odoo/oca/mis-builder-dev.md) | `mis_builder` | OCA financial reports (creating, editing, expression language) |

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

[CC0 1.0 Universal](./skills/odoo/LICENSE) — **public domain**.
Use the knowledge freely in any project, commercial or not, with no attribution required.
