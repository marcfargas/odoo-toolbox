import { SkillDefinition } from '../../types';

/**
 * SKILL: odoo-search-translations
 *
 * Elementary SKILL for searching translated strings in Odoo.
 */
export const searchTranslationsSkill: SkillDefinition = {
  id: 'odoo-search-translations',
  shortName: 'search-translations',
  title: 'Search Odoo Translations',
  summary: 'Search for translated strings and labels in Odoo',

  description: `
This SKILL helps you find translated strings and labels in Odoo.

## What it does

1. Searches \`ir.translation\` (Odoo < 16) or model fields directly (Odoo 16+)
2. Finds labels, help text, and other translatable content
3. Useful for understanding what users see in the UI

## When to use

- Finding the technical field for a label you see in the UI
- Understanding what "Expected Revenue" maps to in the database
- Discovering all strings in a specific language
- Finding field help text

## Odoo Version Notes

In Odoo 16+, translations moved from \`ir.translation\` to inline storage.
For field labels, query \`ir.model.fields\` with \`field_description\`.
`.trim(),

  level: 'elementary',
  category: 'introspection',

  parameters: [
    {
      name: 'searchTerm',
      type: 'string',
      description: 'Text to search for (case-insensitive)',
      required: true,
      example: 'Expected Revenue',
    },
    {
      name: 'language',
      type: 'string',
      description: 'Language code to search in',
      required: false,
      default: 'en_US',
      example: 'es_ES',
    },
    {
      name: 'model',
      type: 'string',
      description: 'Limit search to specific model',
      required: false,
    },
  ],

  moduleDependencies: [],

  odooModels: ['ir.model.fields', 'ir.translation'],

  examples: [
    {
      title: 'Find Field by Label',
      description: 'Search for the technical field name by its UI label',
      code: `import { OdooClient } from '@odoo-toolbox/client';

const client = new OdooClient({
  url: process.env.ODOO_URL || 'http://localhost:8069',
  database: process.env.ODOO_DB || 'odoo',
  username: process.env.ODOO_USER || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
});

await client.authenticate();

// Search for fields by their display label
const searchTerm = 'Expected Revenue';

const fields = await client.searchRead(
  'ir.model.fields',
  [['field_description', 'ilike', searchTerm]],
  { fields: ['name', 'model', 'field_description', 'ttype'] }
);

console.log(\`Fields matching "\${searchTerm}":\`);
fields.forEach(f => {
  console.log(\`- \${f.model}.\${f.name} (\${f.ttype})\`);
  console.log(\`  Label: \${f.field_description}\`);
});

await client.logout();`,
      tested: true,
    },
    {
      title: 'Find Help Text',
      description: 'Search for fields with specific help text',
      code: `import { OdooClient } from '@odoo-toolbox/client';

const client = new OdooClient({
  url: process.env.ODOO_URL || 'http://localhost:8069',
  database: process.env.ODOO_DB || 'odoo',
  username: process.env.ODOO_USER || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
});

await client.authenticate();

// Find fields with help text containing a term
const fields = await client.searchRead(
  'ir.model.fields',
  [
    ['help', '!=', false],
    ['help', 'ilike', 'customer']
  ],
  { fields: ['name', 'model', 'field_description', 'help'], limit: 10 }
);

console.log('Fields with "customer" in help text:');
fields.forEach(f => {
  console.log(\`- \${f.model}.\${f.name}: \${f.field_description}\`);
  console.log(\`  Help: \${f.help}\`);
});

await client.logout();`,
      tested: true,
    },
  ],

  relatedSkills: ['odoo-introspect', 'odoo-search-fields'],

  odooReferences: [
    'https://github.com/odoo/odoo/blob/17.0/odoo/addons/base/models/ir_translation.py',
  ],

  tags: ['introspection', 'translations', 'labels', 'i18n', 'search'],
};
