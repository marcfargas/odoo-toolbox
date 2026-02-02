# SKILL Format

Structure and conventions for Claude Code SKILL Markdown files.

## Overview

When generating instance-specific SKILLs for Claude Code, follow this format to create consistent, useful command files in `.claude/commands/`.

## File Structure

```
.claude/
└── commands/
    ├── README.md           # Index of all SKILLs
    ├── odoo-connect.md     # Connection SKILL
    ├── odoo-create-lead.md # Create lead SKILL
    └── ...
```

## SKILL File Template

```markdown
# /odoo-{skill-name}

{Brief one-line description}

## Level

**{Elementary|User|Admin}** - {Brief level description}

## Prerequisites

- {List prerequisites}
- {Modules required}
- {Authenticated connection}

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `param1` | string | Yes | Description |
| `param2` | number | No | Description |

## Usage

### {Example Title}

{Brief description of what this example does}

```typescript
{TypeScript code example}
```

## Key Concepts

{Explain important concepts, gotchas, and behaviors}

## Related SKILLs

- `/odoo-related-skill`
- `/odoo-another-skill`

---

*Generated for {instance-name} by @odoo-toolbox*
```

## Section Details

### Title

Format: `# /odoo-{skill-name}`

- Always prefix with `odoo-`
- Use kebab-case
- Keep concise: `odoo-create-lead`, not `odoo-create-a-new-crm-lead`

### Level

Three levels indicate skill complexity and prerequisites:

| Level | Description | Example |
|-------|-------------|---------|
| **Elementary** | Basic operations, no additional modules | Connection, introspection |
| **User** | Business operations, may require modules | Creating leads, searching partners |
| **Admin** | Configuration, system changes | Installing modules, defining properties |

### Prerequisites

List what's needed before using this SKILL:

```markdown
## Prerequisites

- Authenticated OdooClient connection
- Module: **CRM** (required)
- Module: **Sales** (optional, for quotes)
- Admin permissions for configuration
```

### Parameters

Document each parameter the SKILL accepts:

```markdown
## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Lead name/title |
| `email_from` | string | No | Contact email |
| `expected_revenue` | number | No | Expected deal value |
| `partner_id` | number | No | Link to existing contact (res.partner ID) |
| `lead_properties` | object | No | Custom properties key-value pairs |
```

For instance-specific SKILLs, include actual field options:

```markdown
| `priority` | string | No | One of: `low`, `medium`, `high`, `critical` |
| `stage_id` | number | No | Stage ID. Available: 1 (New), 2 (Qualified), 3 (Proposition) |
```

### Usage Examples

Provide working TypeScript examples:

```markdown
## Usage

### Simple Lead Creation

Create a basic lead with minimal required fields.

```typescript
import { OdooClient } from '@odoo-toolbox/client';

const client = new OdooClient({
  url: process.env.ODOO_URL || 'http://localhost:8069',
  database: process.env.ODOO_DB || 'odoo',
  username: process.env.ODOO_USER || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
});

await client.authenticate();

const leadId = await client.create('crm.lead', {
  name: 'New Enterprise Deal',
  email_from: 'contact@example.com',
  expected_revenue: 50000,
});

console.log(`Created lead: ${leadId}`);
await client.logout();
```
```

### Key Concepts

Document important behaviors, especially:

1. **Read/Write asymmetry** for relational fields
2. **Properties behavior** - full replacement
3. **Required fields** and defaults
4. **Computed fields** that can't be written

```markdown
## Key Concepts

### Many2One Fields

When writing `partner_id`, pass just the ID. When reading, Odoo returns `[id, name]`:

```typescript
// Write
await client.create('crm.lead', { partner_id: 42 });

// Read
const lead = await client.read('crm.lead', id, ['partner_id']);
// lead.partner_id = [42, 'John Doe']
```

### Properties Warning

Writing properties **replaces all values**. Always read first:

```typescript
const lead = await client.read('crm.lead', id, ['lead_properties']);
const props = propertiesToWriteFormat(lead[0].lead_properties);
props.new_value = 'updated';
await client.write('crm.lead', id, { lead_properties: props });
```
```

### Related SKILLs

Link to related SKILLs for discoverability:

```markdown
## Related SKILLs

- `/odoo-search-partners` - Find existing contacts
- `/odoo-manage-properties` - Define custom properties
- `/odoo-introspect` - Discover model fields
```

## Instance-Specific Customization

When generating SKILLs for a specific instance, include:

### 1. Actual Field Values

```markdown
## Available Stages

| ID | Name |
|----|------|
| 1 | New |
| 2 | Qualified |
| 3 | Proposition |
| 4 | Won |
```

### 2. Custom Properties

```markdown
## Custom Properties

This instance has the following lead properties defined:

| Property | Type | Options |
|----------|------|---------|
| `priority_level` | selection | low, medium, high, critical |
| `lead_score` | integer | - |
| `requires_approval` | boolean | - |
```

### 3. Module-Specific Features

```markdown
## Available Features

This instance has:
- CRM ✓
- Sales ✓
- Marketing Automation ✗

Note: Marketing automation features are not available.
```

## Index File (README.md)

Create an index for all SKILLs:

```markdown
# Odoo SKILLs

Commands for interacting with Odoo at {instance-url}.

> Generated on {date} for {database-name}

## Elementary

| Command | Description |
|---------|-------------|
| `/odoo-connect` | Connect and authenticate |
| `/odoo-introspect` | Discover models and fields |

## User

| Command | Description |
|---------|-------------|
| `/odoo-create-lead` | Create CRM leads |
| `/odoo-search-partners` | Search contacts |

## Admin

| Command | Description |
|---------|-------------|
| `/odoo-install-module` | Install modules |
| `/odoo-manage-properties` | Define properties |

---

*Generated by @odoo-toolbox*
```

## Related Documents

- [workflow.md](./workflow.md) - SKILL generation workflow
- [analyzing-fields.md](../02-introspection/analyzing-fields.md) - Understanding fields
