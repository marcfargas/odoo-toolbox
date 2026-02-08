# @odoo-toolbox/create-skills

CLI to scaffold Odoo skill projects for AI agents.

## Overview

This package helps you create skill projects that teach AI agents (like Claude Code) how to interact with your specific Odoo instance. It provides:

- **Project scaffolding** - Generate a complete skill project structure
- **Tested examples** - Battle-tested code examples for common Odoo patterns
- **Progressive learning** - Base knowledge modules that build on each other

The knowledge modules live at the repository root in [`skills/odoo/`](../../skills/odoo/) and are copied into scaffolded projects by this CLI.

## Installation

```bash
# Run directly with npx
npx @odoo-toolbox/create-skills my-odoo-skills

# Or install globally
npm install -g @odoo-toolbox/create-skills
create-skills my-odoo-skills
```

## Usage

### Create a New Skill Project

```bash
npx @odoo-toolbox/create-skills my-project
cd my-project
```

This creates a project with:

```
my-project/
├── .env.example      # Odoo connection template
├── README.md         # Project setup instructions
├── SKILL.md          # Main entry point for AI agents
├── AGENTS.md         # Instructions for AI agents
├── base/             # Core Odoo knowledge modules
│   ├── connection.md
│   ├── field-types.md
│   ├── domains.md
│   ├── crud.md
│   ├── search.md
│   ├── properties.md
│   ├── modules.md
│   ├── introspection.md
│   └── skill-generation.md
├── mail/             # Mail system modules
│   ├── chatter.md
│   ├── activities.md
│   └── discuss.md
├── modules/          # Module-specific skills
│   └── timesheets.md
├── oca/              # OCA module skills
│   └── mis-builder.md
└── skills/           # Your instance-specific skills (you create these)
```

### Configure Odoo Connection

```bash
cp .env.example .env
# Edit .env with your Odoo credentials
```

### Use with Claude Code

Open your skill project in Claude Code. Ask Claude to:

- "Connect to Odoo and list available models"
- "Introspect the crm.lead model"
- "Generate a skill for creating sales orders"

## Knowledge Modules

The `skills/odoo/` directory at the repository root contains tested and validated documentation for Odoo patterns. All code examples are **tested against real Odoo instances** in CI. See [`skills/odoo/SKILL.md`](../../skills/odoo/SKILL.md) for the full module index.

## Related Packages

- [@odoo-toolbox/client](../odoo-client) - Lightweight RPC client for Odoo operations
- [@odoo-toolbox/introspection](../odoo-introspection) - Schema introspection and TypeScript code generation
- [@odoo-toolbox/state-manager](../odoo-state-manager) - Drift detection and plan/apply workflow

## License

- **Code**: LGPL-3.0
- **Skills content** (knowledge modules): [CC-BY-4.0](../../skills/odoo/LICENSE)
