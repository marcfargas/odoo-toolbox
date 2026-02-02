import { SkillDefinition } from '../../types';

/**
 * SKILL: odoo-search-fields
 *
 * Elementary SKILL for searching fields by name pattern across all models.
 */
export const searchFieldsSkill: SkillDefinition = {
  id: 'odoo-search-fields',
  shortName: 'search-fields',
  title: 'Search Odoo Fields',
  summary: 'Search for fields by name pattern across all models',

  description: `
This SKILL helps you find fields across the entire Odoo schema.

## What it does

1. Searches \`ir.model.fields\` for fields matching a pattern
2. Returns field metadata including model, type, and description
3. Useful for discovering where specific data is stored

## When to use

- Finding all fields related to a concept (e.g., "email", "date")
- Discovering Properties fields (\`*_properties\`)
- Looking for computed fields
- Finding relational fields to a specific model

## Search Patterns

Use SQL ILIKE patterns:
- \`email\`: Contains "email" anywhere
- \`%_id\`: Ends with "_id" (many2one fields)
- \`date_%\`: Starts with "date_"
`.trim(),

  level: 'elementary',
  category: 'introspection',

  parameters: [
    {
      name: 'pattern',
      type: 'string',
      description: 'Field name pattern to search (case-insensitive)',
      required: true,
      example: 'properties',
    },
    {
      name: 'model',
      type: 'string',
      description: 'Limit search to specific model',
      required: false,
      example: 'crm.lead',
    },
    {
      name: 'fieldType',
      type: 'string',
      description: 'Filter by field type (ttype)',
      required: false,
      example: 'many2one',
    },
  ],

  moduleDependencies: [],

  odooModels: ['ir.model.fields'],

  examples: [
    {
      title: 'Search for Properties Fields',
      description: 'Find all properties fields in the system',
      code: `import { OdooClient } from '@odoo-toolbox/client';

const client = new OdooClient({
  url: process.env.ODOO_URL || 'http://localhost:8069',
  database: process.env.ODOO_DB || 'odoo',
  username: process.env.ODOO_USER || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
});

await client.authenticate();

const fields = await client.searchRead(
  'ir.model.fields',
  [['name', 'ilike', 'properties']],
  { fields: ['name', 'model', 'ttype', 'field_description'] }
);

console.log('Properties-related fields:');
fields.forEach(f => {
  console.log(\`- \${f.model}.\${f.name} (\${f.ttype}): \${f.field_description}\`);
});

await client.logout();`,
      tested: true,
    },
    {
      title: 'Find Many2One Fields to a Model',
      description: 'Find all fields that reference res.partner',
      code: `import { OdooClient } from '@odoo-toolbox/client';

const client = new OdooClient({
  url: process.env.ODOO_URL || 'http://localhost:8069',
  database: process.env.ODOO_DB || 'odoo',
  username: process.env.ODOO_USER || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
});

await client.authenticate();

const fields = await client.searchRead(
  'ir.model.fields',
  [
    ['ttype', '=', 'many2one'],
    ['relation', '=', 'res.partner']
  ],
  { fields: ['name', 'model', 'field_description'], limit: 20 }
);

console.log('Fields referencing res.partner:');
fields.forEach(f => {
  console.log(\`- \${f.model}.\${f.name}: \${f.field_description}\`);
});

await client.logout();`,
      tested: true,
    },
  ],

  relatedSkills: ['odoo-introspect', 'odoo-search-translations'],

  odooReferences: [
    'https://github.com/odoo/odoo/blob/17.0/odoo/addons/base/models/ir_model.py',
  ],

  tags: ['introspection', 'fields', 'search', 'discovery'],
};
