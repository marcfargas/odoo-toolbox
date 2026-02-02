# Odoo Meta-Skills

Documentation for AI agents to learn how to interact with Odoo instances and generate instance-specific SKILLs.

## What are Meta-Skills?

Meta-Skills are not traditional commands or scripts. They are **knowledge documents** that teach AI agents:

1. **How Odoo works** - Field types, domains, relationships
2. **How to introspect** - Discover models and fields in any instance
3. **How to generate SKILLs** - Create instance-specific automation commands
4. **Best practices** - Patterns for CRUD, search, properties, modules

## How to Use

### For end users (Skill creators)

Deploy this SKILL set on your AI agent, then point the agent to your Odoo instance to create your instance specific SKILL set.

We recommend to do this in a project folder with a coding agent (like Claude Code):

1. `mkdir my-odoo-skills`
2. Create `.env` with `ODOO_URL`, `ODOO_DB`, `ODOO_USER`, `ODOO_PASSWORD`
3. Install this skill set (unpack into `.claude/commands` for example)
4. Launch your agent and see that it works:

    Welcome, we are going to create a set of Odoo SKILLs for other agents to interact
    with our company ERP.

    You should find a several SKILLs available to you to help you in that task.

    Please verify you can connect to Odoo given those skills, try to get details of the
    module `res.partner` and its `name` field.

    We will create all our skills under `skills/` and you should keep a README.md on the
    root folder documenting each skill and anything important.

    At the end we will package our skills for deployment.

    Never ever ever commit the .env file.


### For AI Agents (Claude Desktop, Claude Code)

Read these documents to understand Odoo fundamentals, then:
- **Claude Desktop**: Work directly with Odoo without generating files
- **Claude Code**: Generate `.claude/commands/` with instance-specific SKILLs

### For Developers

Use these as reference documentation when building Odoo integrations.

## Document Structure

### [01-fundamentals/](./01-fundamentals/)

Core Odoo concepts every agent must understand:

| Document | Description |
|----------|-------------|
| [connection.md](./01-fundamentals/connection.md) | Connecting and authenticating with Odoo |
| [field-types.md](./01-fundamentals/field-types.md) | Odoo field types and their read/write behaviors |
| [domains.md](./01-fundamentals/domains.md) | Odoo domain filter syntax |

### [02-introspection/](./02-introspection/)

How to discover what's available in an Odoo instance:

| Document | Description |
|----------|-------------|
| [discovering-models.md](./02-introspection/discovering-models.md) | Finding and filtering models |
| [analyzing-fields.md](./02-introspection/analyzing-fields.md) | Understanding field metadata |

### [03-skill-generation/](./03-skill-generation/)

How to generate instance-specific SKILLs:

| Document | Description |
|----------|-------------|
| [skill-format.md](./03-skill-generation/skill-format.md) | Structure of a SKILL .md file |
| [workflow.md](./03-skill-generation/workflow.md) | Steps to generate SKILLs for an instance |

### [04-patterns/](./04-patterns/)

Common patterns for Odoo operations:

| Document | Description |
|----------|-------------|
| [crud-operations.md](./04-patterns/crud-operations.md) | Create, read, update, delete patterns |
| [search-patterns.md](./04-patterns/search-patterns.md) | Search and filtering patterns |
| [properties.md](./04-patterns/properties.md) | Dynamic properties fields |
| [modules.md](./04-patterns/modules.md) | Module management patterns |

## Required Packages

These meta-skills use the following packages from `@odoo-toolbox`:

```typescript
import { OdooClient } from '@odoo-toolbox/client';
import { Introspector } from '@odoo-toolbox/introspection';
```

Install with:

```bash
npm install @odoo-toolbox/client @odoo-toolbox/introspection
```

## Quick Start for Agents

### Step 1: Get Credentials

Look for credentials in:
1. `.odoo.env` file in project root
2. Environment variables (`ODOO_URL`, `ODOO_DB`, `ODOO_USER`, `ODOO_PASSWORD`)
3. `CLAUDE.md` documentation
4. Ask the user if not found

### Step 2: Connect

```typescript
import { OdooClient } from '@odoo-toolbox/client';

const client = new OdooClient({
  url: process.env.ODOO_URL || 'http://localhost:8069',
  database: process.env.ODOO_DB || 'odoo',
  username: process.env.ODOO_USER || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
});

await client.authenticate();
```

### Step 3: Introspect

```typescript
import { Introspector } from '@odoo-toolbox/introspection';

const introspector = new Introspector(client);
const models = await introspector.getModels();
const fields = await introspector.getFields('crm.lead');
```

### Step 4: Perform Operations

Use patterns from [04-patterns/](./04-patterns/) to create, read, update, delete records.

### Step 5: Generate SKILLs (Claude Code only)

Follow [03-skill-generation/workflow.md](./03-skill-generation/workflow.md) to generate instance-specific commands.

---

*Part of the [Odoo Toolbox](https://github.com/telenieko/odoo-toolbox) project*
