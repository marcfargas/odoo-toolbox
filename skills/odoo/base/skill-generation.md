# Skill Generation

How to generate instance-specific skills for Odoo.

## Overview

This document covers the format and workflow for creating instance-specific SKILLs that reflect the exact models, fields, and configuration available in an Odoo instance.

---

# Part 1: SKILL Format

## File Structure

```
skills/
├── create-lead.md      # Create CRM leads
├── search-partners.md  # Search contacts
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

## Related Skills

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

### Key Concepts

Document important behaviors, especially:

1. **Read/Write asymmetry** for relational fields
2. **Properties behavior** - full replacement
3. **Required fields** and defaults
4. **Computed fields** that can't be written

---

# Part 2: Generation Workflow

## When to Generate SKILLs

Generate SKILLs when the user:
- Says "Generate SKILLs for my Odoo"
- Asks for "Odoo commands" for their project
- Wants to automate Odoo operations
- Is setting up a new integration project

## Prerequisites

1. Odoo credentials (URL, database, username, password)
2. Network access to the Odoo instance
3. User with sufficient permissions (admin recommended)

## Step-by-Step Workflow

### Step 1: Obtain Credentials

Check for credentials in this order:

1. **`.env` file** in project root
2. **Environment variables**
3. **Ask the user** if not found

### Step 2: Connect and Validate

```typescript
import { createClient } from '@marcfargas/odoo-client';

try {
  const client = await createClient();
  const session = client.getSession();
  console.log(`Connected! User ID: ${session?.uid}`);
} catch (error) {
  console.error('Connection failed:', error.message);
  // Ask user to verify credentials
}
```

### Step 3: Discover Installed Modules

```typescript
// Check common modules via the service accessor
const modules = {
  crm: await client.modules.isModuleInstalled('crm'),
  sale: await client.modules.isModuleInstalled('sale'),
  purchase: await client.modules.isModuleInstalled('purchase'),
  stock: await client.modules.isModuleInstalled('stock'),
  account: await client.modules.isModuleInstalled('account'),
  project: await client.modules.isModuleInstalled('project'),
};

console.log('Installed modules:');
Object.entries(modules)
  .filter(([_, installed]) => installed)
  .forEach(([name]) => console.log(`  - ${name}`));
```

### Step 4: Introspect Key Models

```typescript
import { Introspector } from '@marcfargas/odoo-introspection';

const introspector = new Introspector(client);  // client from createClient()

// Get models for installed modules
const modelsToIntrospect = [];

if (modules.crm) {
  modelsToIntrospect.push('crm.lead', 'crm.team');
}
if (modules.sale) {
  modelsToIntrospect.push('sale.order', 'sale.order.line');
}

const modelInfo = {};
for (const model of modelsToIntrospect) {
  const fields = await introspector.getFields(model);
  modelInfo[model] = {
    required: fields.filter(f => f.required && !f.readonly),
    optional: fields.filter(f => !f.required && !f.readonly),
    relations: fields.filter(f => ['many2one', 'one2many', 'many2many'].includes(f.ttype)),
    properties: fields.filter(f => f.ttype === 'properties'),
    selections: fields.filter(f => f.ttype === 'selection'),
  };
}
```

### Step 5: Gather Selection Options

```typescript
// For selection fields, get actual options
for (const [model, info] of Object.entries(modelInfo)) {
  for (const field of info.selections) {
    console.log(`${model}.${field.name} options:`);
    field.selection?.forEach(([value, label]) => {
      console.log(`  - ${value}: ${label}`);
    });
  }
}
```

### Step 6: Get Stage/Status Values

```typescript
// Get actual stages for CRM
if (modules.crm) {
  const stages = await client.searchRead('crm.stage', [], {
    fields: ['id', 'name', 'sequence'],
    order: 'sequence asc'
  });
  console.log('CRM Stages:', stages);
}
```

### Step 7: Generate SKILL Files

Create skills in the `skills/` directory following the format above.

### Step 8: Update SKILL.md

Add references to new skills in the main SKILL.md router.

## SKILL Categories to Generate

### Always Generate (Elementary)

| SKILL | Description |
|-------|-------------|
| Connection | Connection and authentication |
| Introspection | Schema discovery |

### Module-Dependent (User)

| Module | SKILLs |
|--------|--------|
| `crm` | Create leads, manage opportunities |
| `sale` | Create quotations, confirm orders |
| `purchase` | Create purchase orders |
| `stock` | Check inventory |
| `project` | Create tasks |

### Admin SKILLs

| SKILL | Description |
|-------|-------------|
| Module management | Install/uninstall modules |
| Properties configuration | Define custom properties |

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

## Related Documents

- [introspection.md](./introspection.md) - Model and field discovery
- [crud.md](./crud.md) - CRUD patterns
- [modules.md](./modules.md) - Module management
