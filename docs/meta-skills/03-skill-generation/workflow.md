# SKILL Generation Workflow

Step-by-step process for generating instance-specific SKILLs.

## Overview

This workflow guides you through generating customized SKILLs for a specific Odoo instance. The generated SKILLs will reflect the exact models, fields, and configuration available in that instance.

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

1. **`.odoo.env` file** in project root
2. **Environment variables**
3. **`CLAUDE.md`** documentation
4. **Ask the user** if not found

```typescript
// Example: Reading .odoo.env
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(process.cwd(), '.odoo.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const config = {
  url: process.env.ODOO_URL,
  database: process.env.ODOO_DB,
  username: process.env.ODOO_USER,
  password: process.env.ODOO_PASSWORD,
};
```

### Step 2: Connect and Validate

```typescript
import { OdooClient } from '@odoo-toolbox/client';

const client = new OdooClient(config);

try {
  await client.authenticate();
  console.log(`Connected to ${config.url}`);
  console.log(`Database: ${config.database}`);
} catch (error) {
  console.error('Connection failed:', error.message);
  // Ask user to verify credentials
}
```

### Step 3: Discover Installed Modules

```typescript
import { ModuleManager } from '@odoo-toolbox/client';

const moduleManager = new ModuleManager(client);

// Check common modules
const modules = {
  crm: await moduleManager.isModuleInstalled('crm'),
  sale: await moduleManager.isModuleInstalled('sale'),
  purchase: await moduleManager.isModuleInstalled('purchase'),
  stock: await moduleManager.isModuleInstalled('stock'),
  account: await moduleManager.isModuleInstalled('account'),
  project: await moduleManager.isModuleInstalled('project'),
  hr: await moduleManager.isModuleInstalled('hr'),
};

console.log('Installed modules:');
Object.entries(modules)
  .filter(([_, installed]) => installed)
  .forEach(([name]) => console.log(`  - ${name}`));
```

### Step 4: Introspect Key Models

```typescript
import { Introspector } from '@odoo-toolbox/introspection';

const introspector = new Introspector(client);

// Get models for installed modules
const modelsToIntrospect = [];

if (modules.crm) {
  modelsToIntrospect.push('crm.lead', 'crm.team');
}
if (modules.sale) {
  modelsToIntrospect.push('sale.order', 'sale.order.line');
}
// ... add more based on installed modules

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
    // Selection options are in the field metadata
    console.log(`${model}.${field.name} options:`);
    field.selection?.forEach(([value, label]) => {
      console.log(`  - ${value}: ${label}`);
    });
  }
}
```

### Step 6: Get Properties Definitions

```typescript
// For models with properties, get the definitions
if (modelInfo['crm.lead']?.properties.length > 0) {
  const teams = await client.searchRead('crm.team', [], {
    fields: ['name', 'lead_properties_definition']
  });

  teams.forEach(team => {
    console.log(`Team ${team.name} properties:`);
    team.lead_properties_definition?.forEach(prop => {
      console.log(`  - ${prop.name} (${prop.type}): ${prop.string}`);
    });
  });
}
```

### Step 7: Get Stage/Status Values

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

### Step 8: Generate SKILL Files

```typescript
import * as fs from 'fs';
import * as path from 'path';

const outputDir = path.join(process.cwd(), '.claude', 'commands');
fs.mkdirSync(outputDir, { recursive: true });

// Generate each SKILL file
function generateSkillFile(skillId, content) {
  const filepath = path.join(outputDir, `${skillId}.md`);
  fs.writeFileSync(filepath, content, 'utf-8');
  console.log(`Generated: ${filepath}`);
}

// Example: Generate odoo-create-lead.md
if (modules.crm) {
  const content = generateLeadSkill(modelInfo['crm.lead'], stagesInfo);
  generateSkillFile('odoo-create-lead', content);
}
```

### Step 9: Generate Index

```typescript
function generateIndex(generatedSkills, instanceInfo) {
  const lines = [
    '# Odoo SKILLs',
    '',
    `Commands for ${instanceInfo.url}`,
    `Database: ${instanceInfo.database}`,
    `Generated: ${new Date().toISOString()}`,
    '',
  ];

  // Group by level
  const elementary = generatedSkills.filter(s => s.level === 'elementary');
  const user = generatedSkills.filter(s => s.level === 'user');
  const admin = generatedSkills.filter(s => s.level === 'admin');

  if (elementary.length > 0) {
    lines.push('## Elementary', '', '| Command | Description |', '|---------|-------------|');
    elementary.forEach(s => {
      lines.push(`| [\`/${s.id}\`](./${s.id}.md) | ${s.summary} |`);
    });
    lines.push('');
  }

  // ... similar for user and admin

  return lines.join('\n');
}
```

## SKILL Categories to Generate

### Always Generate (Elementary)

| SKILL | Description |
|-------|-------------|
| `odoo-connect` | Connection and authentication |
| `odoo-introspect` | Schema discovery |

### Module-Dependent (User)

| Module | SKILLs |
|--------|--------|
| `crm` | `odoo-create-lead`, `odoo-manage-opportunities` |
| `sale` | `odoo-create-quotation`, `odoo-confirm-order` |
| `purchase` | `odoo-create-po` |
| `stock` | `odoo-check-inventory` |
| `project` | `odoo-create-task` |

### Admin SKILLs

| SKILL | Description |
|-------|-------------|
| `odoo-install-module` | Module management |
| `odoo-manage-properties` | Properties configuration |

## Customization Guidelines

### Include Instance-Specific Data

- Actual stage names and IDs
- Available properties and their types
- Selection field options
- Team/company names

### Document Limitations

- Note uninstalled modules
- Document permission requirements
- Warn about destructive operations

### Test Generated SKILLs

After generation, verify at least one SKILL works:

```typescript
// Quick test: Can we create and delete a record?
const testId = await client.create('res.partner', {
  name: 'SKILL Test Partner - Delete Me'
});
await client.unlink('res.partner', testId);
console.log('SKILLs validated successfully');
```

## Output Summary

After completion, inform the user:

```
Generated SKILLs for {database}@{url}

Files created in .claude/commands/:
  - README.md (index)
  - odoo-connect.md
  - odoo-create-lead.md
  - odoo-search-partners.md
  ... (N total)

Available modules: CRM, Sales, Project
Unavailable: Stock, Accounting

To use: /odoo-create-lead
```

## Related Documents

- [skill-format.md](./skill-format.md) - SKILL file structure
- [discovering-models.md](../02-introspection/discovering-models.md) - Model discovery
- [analyzing-fields.md](../02-introspection/analyzing-fields.md) - Field analysis
