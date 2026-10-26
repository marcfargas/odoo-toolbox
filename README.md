# odoo-toolbox (retired)

This project is retired. The maintained libraries have moved to [Godoo](https://github.com/godoo-dev); the remaining tools have the explicit dispositions below. Existing npm versions remain downloadable. Source history and licenses are retained here, and no further Toolbox releases are planned.

## Migration

| Legacy package | Maintained replacement |
| --- | --- |
| `@marcfargas/odoo-client` | [`@godoo-dev/client@0.7.0`](https://www.npmjs.com/package/@godoo-dev/client) |
| `@marcfargas/odoo-introspection` | [`@godoo-dev/introspection@0.2.3`](https://www.npmjs.com/package/@godoo-dev/introspection) |
| `@marcfargas/odoo-testcontainers` | [`@godoo-dev/testcontainers@0.2.0`](https://www.npmjs.com/package/@godoo-dev/testcontainers) |
| `@marcfargas/odoo-state-manager` | [`@godoo-dev/stateman@0.1.0`](https://www.npmjs.com/package/@godoo-dev/stateman) |

Replace package dependencies and import specifiers, regenerate your lockfile and check ESM compatibility. The TypeScript libraries require Node 22.18+; Stateman requires Node 24+. Godoo supports Odoo 18 as its baseline; application migration needs its own verification.

Stateman is a redesign, not a package rename: migrate the CLI to `stateman`, review plan/apply/drift and durable recovery, and replace implicit unmanaged removal with explicit scoped intent. Follow the [Stateman guide](https://github.com/godoo-dev/godoo-stateman/blob/9ff36580da66e3167b5ea1acdb783296b33e7738/README.md).

## Retired tools and knowledge adoption

| Legacy package | Disposition |
| --- | --- |
| `@marcfargas/odoo-mcp` | Already deprecated in favor of [godoo-mcp-server on PyPI](https://pypi.org/project/godoo-mcp-server/). Transport, configuration and tools require migration. |
| `@marcfargas/odoo-cli` | Retired. No successor standalone Odoo CLI is planned. Agents use operational MCP or execute code with the Godoo libraries. |
| `@marcfargas/odoo-skills` | The npm skills bundle is retired. Its Odoo knowledge is being adopted into Godoo Atlas, preserving source, license and historical version caveats. |
| `@marcfargas/create-odoo-skills` | Retired. The Atlas knowledge direction supersedes scaffolding native skill projects; no replacement scaffolder is planned. |

Atlas adoption is separate work, not a drop-in npm skill installer. Future operational MCP knowledge guidance should defer to Atlas; that runtime integration is not available through this retirement. The [Godoo portfolio](https://github.com/godoo-dev) describes the maintained products. Existing focused Stateman and schema-generation commands retain their own interfaces.

The separate [n8n adapter](https://github.com/marcfargas/n8n-nodes-odoo), published as `@marcfargas/n8n-nodes-odoo`, is also retired. No successor n8n integration is planned; its repository is already archived.

Legacy release automation has been removed and no README-only npm version was published. The source, including the complete [`skills/odoo/`](./skills/odoo/) corpus and its license, remains available for reference and Atlas adoption. The documentation below is historical.

## Historical documentation

The following documentation preserves the old toolbox interfaces and Odoo 17 claims. It does not describe Godoo's current support policy.

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

### Option 0: Install via skills.sh (recommended)

If you're using the `skills` CLI (skills.sh), install directly from GitHub:

```bash
npx -y skills add marcfargas/odoo-toolbox --all
```

This will install the skills into your agent's skills directory (typically under `~/.pi/agent/skills/`).

### Option 1: Download Pre-built Skills

Download `odoo-skills.zip` from the [latest GitHub release](https://github.com/marcfargas/odoo-toolbox/releases) (recommended) or from the [latest CI build](https://github.com/marcfargas/odoo-toolbox/actions) artifacts.

```bash
unzip odoo-skills.zip
cd odoo-skills
cp .env.example .env  # Add your Odoo credentials
```

## TypeScript Packages

The skills are backed by tested TypeScript infrastructure. The monorepo splits into **libraries** (`packages/`) you import and **targets** (`targets/`) you run.

### Libraries

| Package | Description | Status |
|---------|-------------|--------|
| [@marcfargas/odoo-client](./packages/odoo-client) | Lightweight RPC client for Odoo | Moved to @godoo-dev/client |
| [@marcfargas/odoo-introspection](./packages/odoo-introspection) | Schema introspection and type generation | Moved to @godoo-dev/introspection |
| [@marcfargas/odoo-testcontainers](./packages/odoo-testcontainers) | Testcontainers-based Odoo testing infrastructure | Moved to @godoo-dev/testcontainers |
| [@marcfargas/odoo-state-manager](./packages/odoo-state-manager) | Drift detection and plan/apply (Terraform-style) | Moved to @godoo-dev/stateman |

### Targets

| Package | Description | Status |
|---------|-------------|--------|
| [@marcfargas/odoo-cli](./targets/odoo-cli) | CLI for Odoo ERP — 10 command groups (records, mail, modules, attendance, timesheets, accounting…) | Active |
| [@marcfargas/odoo-mcp](./targets/odoo-mcp) | MCP server for Odoo | Active |

## CLI Quick Start

Run Odoo operations directly from the terminal with `@marcfargas/odoo-cli`:

```bash
npx @marcfargas/odoo-cli --help

# Set credentials via environment or .env
export ODOO_URL=https://myodoo.example.com
export ODOO_DB=mydb
export ODOO_USERNAME=admin
export ODOO_PASSWORD=secret

# Search records
odoo records search res.partner --domain '[["is_company","=",true]]' --limit 5

# Install a module
odoo modules install sale_management

# Post a note on a record
odoo mail note crm.lead 42 "Called — follow-up scheduled"
```

The CLI provides 10 command groups: `records`, `mail`, `modules`, `attendance`, `timesheets`,
`accounting`, `config`, `state`, `schema`, and `run`.

## Prerequisites

- **Node.js** ≥ 24
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
See [`docs/`](./docs/) for developer documentation (architecture, service patterns, API guides).

## License

**Code** (`packages/`, `targets/`): [LGPL-3.0](./LICENSE)

**Skills** (`skills/`): [CC0 1.0 Universal](./skills/odoo/LICENSE) — **public domain**.
Use the knowledge freely in any project, commercial or not, with no attribution required.
AI agents, companies, competing projects — zero restrictions, zero friction.

## Bugs & Support

[GitHub Issues](https://github.com/marcfargas/odoo-toolbox/issues)
