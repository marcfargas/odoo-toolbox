import { SkillDefinition } from '../../types';

/**
 * SKILL: odoo-introspect
 *
 * Elementary SKILL for discovering Odoo models and fields.
 * Essential for understanding the schema before performing operations.
 */
export const introspectSkill: SkillDefinition = {
  id: 'odoo-introspect',
  shortName: 'introspect',
  title: 'Introspect Odoo Schema',
  summary: 'Discover models, fields, and their metadata from Odoo',

  description: `
This SKILL helps you discover and understand Odoo's data model through introspection.

## What it does

1. Lists all available models in Odoo
2. Gets field definitions for any model
3. Returns metadata including types, relations, and constraints

## When to use

- Before working with an unfamiliar model
- To understand required fields before creating records
- To discover relational fields and their target models
- To check if a model exists in the instance

## Key Concepts

### Models

Odoo models are queried from \`ir.model\`. Each model has:
- **model**: Technical name (e.g., \`crm.lead\`)
- **name**: Human-readable name (e.g., "Lead/Opportunity")
- **modules**: Comma-separated list of modules that define/extend it

### Fields

Field information comes from \`ir.model.fields\`:
- **name**: Technical field name
- **ttype**: Field type (char, integer, many2one, etc.)
- **required**: Whether the field is mandatory
- **readonly**: Whether the field is computed/read-only
- **relation**: For relational fields, the target model

### Field Types

Common Odoo field types:
- \`char\`, \`text\`: String values
- \`integer\`, \`float\`: Numeric values
- \`boolean\`: True/False
- \`date\`, \`datetime\`: Date/time values
- \`many2one\`: Link to single record (returns \`[id, name]\` on read)
- \`one2many\`, \`many2many\`: Links to multiple records
- \`selection\`: Dropdown with predefined options
- \`properties\`: Dynamic user-defined fields
`.trim(),

  level: 'elementary',
  category: 'introspection',

  parameters: [
    {
      name: 'model',
      type: 'string',
      description: 'Model name to introspect (e.g., crm.lead)',
      required: false,
      example: 'crm.lead',
    },
    {
      name: 'moduleFilter',
      type: 'string',
      description: 'Filter models by module name',
      required: false,
      example: 'crm',
    },
    {
      name: 'includeTransient',
      type: 'boolean',
      description: 'Include transient (wizard) models',
      required: false,
      default: false,
    },
  ],

  moduleDependencies: [],

  odooModels: ['ir.model', 'ir.model.fields'],

  examples: [
    {
      title: 'List All Models',
      description: 'Get all non-transient models in the system',
      code: `import { OdooClient } from '@odoo-toolbox/client';
import { Introspector } from '@odoo-toolbox/introspection';

const client = new OdooClient({
  url: process.env.ODOO_URL || 'http://localhost:8069',
  database: process.env.ODOO_DB || 'odoo',
  username: process.env.ODOO_USER || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
});

await client.authenticate();

const introspector = new Introspector(client);
const models = await introspector.getModels();

console.log(\`Found \${models.length} models\`);
models.slice(0, 10).forEach(m => {
  console.log(\`- \${m.model}: \${m.name}\`);
});

await client.logout();`,
      tested: true,
    },
    {
      title: 'Inspect Model Fields',
      description: 'Get all fields for a specific model',
      code: `import { OdooClient } from '@odoo-toolbox/client';
import { Introspector } from '@odoo-toolbox/introspection';

const client = new OdooClient({
  url: process.env.ODOO_URL || 'http://localhost:8069',
  database: process.env.ODOO_DB || 'odoo',
  username: process.env.ODOO_USER || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
});

await client.authenticate();

const introspector = new Introspector(client);
const fields = await introspector.getFields('res.partner');

console.log('res.partner fields:');
fields.forEach(f => {
  const relation = f.relation ? \` -> \${f.relation}\` : '';
  const required = f.required ? ' (required)' : '';
  console.log(\`- \${f.name}: \${f.ttype}\${relation}\${required}\`);
});

await client.logout();`,
      tested: true,
    },
    {
      title: 'Filter Models by Module',
      description: 'Find models defined by a specific module',
      code: `import { OdooClient } from '@odoo-toolbox/client';
import { Introspector } from '@odoo-toolbox/introspection';

const client = new OdooClient({
  url: process.env.ODOO_URL || 'http://localhost:8069',
  database: process.env.ODOO_DB || 'odoo',
  username: process.env.ODOO_USER || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
});

await client.authenticate();

const introspector = new Introspector(client);

// Get models from the 'base' module
const models = await introspector.getModels({ modules: ['base'] });

console.log(\`Models from 'base' module: \${models.length}\`);
models.forEach(m => {
  console.log(\`- \${m.model}\`);
});

await client.logout();`,
      tested: true,
    },
  ],

  relatedSkills: ['odoo-connect', 'odoo-search-fields', 'odoo-explore-modules'],

  odooReferences: [
    'https://github.com/odoo/odoo/blob/17.0/odoo/addons/base/models/ir_model.py',
    'https://github.com/odoo/odoo/blob/17.0/odoo/fields.py',
  ],

  tags: ['introspection', 'schema', 'models', 'fields', 'discovery'],
};
