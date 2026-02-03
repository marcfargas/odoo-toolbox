# odoo-toolbox

> Teach AI agents to work with your Odoo instance

**odoo-toolbox** provides an MCP server and tested skills that enable AI agents (Claude Code, Cursor, etc.) to interact with Odoo ERP.

## Quick Start

### Option 1: MCP Server (Recommended)

Add the MCP server to your Claude Desktop or Claude Code configuration:

```json
{
  "mcpServers": {
    "odoo": {
      "command": "npx",
      "args": ["@odoo-toolbox/mcp"],
      "env": {
        "ODOO_URL": "http://localhost:8069",
        "ODOO_DB_NAME": "odoo",
        "ODOO_DB_USER": "admin",
        "ODOO_DB_PASSWORD": "admin"
      }
    }
  }
}
```

Then ask your AI agent to:
- "Connect to Odoo and list available models"
- "Introspect the crm.lead model"
- "Create a new sales order"

### Option 2: Download Pre-built Skills

Download `odoo-skills.zip` from the [latest CI build](https://github.com/telenieko/odoo-toolbox/actions) (look for the "odoo-skills" artifact).

```bash
unzip odoo-skills.zip
cd odoo-skills
cp .env.example .env  # Add your Odoo credentials
```

### Option 3: Create a Custom Skill Project

For instance-specific skills with your Odoo configuration:

```bash
npx @odoo-toolbox/create-skills my-odoo-skills
cd my-odoo-skills
cp .env.example .env  # Configure your Odoo credentials
```

## Knowledge Modules

All examples are **tested against real Odoo v17 instances** in CI:

| Module | What it teaches |
|--------|-----------------|
| `connection.md` | Authentication and session management |
| `crud.md` | Create, Read, Update, Delete operations |
| `search.md` | Domain filters and search patterns |
| `introspection.md` | Discover models and fields dynamically |
| `field-types.md` | Handle Odoo's type system and quirks |
| `properties.md` | Work with dynamic user-defined fields |

## Packages

| Package | Description |
|---------|-------------|
| **[@odoo-toolbox/mcp](./packages/odoo-mcp)** | MCP server for AI agent integration |
| [@odoo-toolbox/create-skills](./packages/create-skills) | CLI to scaffold Odoo skill projects |
| [@odoo-toolbox/client](./packages/odoo-client) | TypeScript RPC client for Odoo |
| [@odoo-toolbox/introspection](./packages/odoo-introspection) | Schema introspection and type generation |

## Future: Infrastructure as Code

We're building toward **Terraform for Odoo** - declare desired state, detect drift, plan and apply changes:

| Package | Status |
|---------|--------|
| [@odoo-toolbox/state-manager](./packages/odoo-state-manager) | In Development |

See [ROADMAP.md](./ROADMAP.md) for the full vision.

## Status

**Stage**: Early Development
**Odoo**: v17 (v14+ planned) | **Node.js**: 18+ | **TypeScript**: 5.0+

## Resources

- [DEVELOPMENT.md](./DEVELOPMENT.md) - Setup, testing, contributing
- [AGENTS.md](./AGENTS.md) - For AI assistants working on this codebase
- [ROADMAP.md](./ROADMAP.md) - Future plans and design decisions

## License

LGPL-3.0 - see [LICENSE](./LICENSE)

Skill templates in [`packages/create-skills/assets/`](./packages/create-skills/assets/) are licensed under [CC-BY-4.0](./packages/create-skills/assets/LICENSE).
