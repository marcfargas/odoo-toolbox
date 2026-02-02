import { SkillDefinition } from '../../types';

/**
 * SKILL: odoo-search-partners
 *
 * User-level SKILL for searching contacts and companies.
 */
export const searchPartnersSkill: SkillDefinition = {
  id: 'odoo-search-partners',
  shortName: 'search-partners',
  title: 'Search Contacts and Companies',
  summary: 'Search for contacts and companies in Odoo',

  description: `
This SKILL helps you search for partners (contacts and companies) in Odoo.

## What it does

1. Searches \`res.partner\` with various filters
2. Supports pagination for large result sets
3. Can filter by company, type, or custom criteria

## Key Concepts

### Partner Types

In Odoo, \`res.partner\` represents both:
- **Companies**: \`is_company = true\`
- **Individuals**: \`is_company = false\`

Individuals can be linked to companies via \`parent_id\`.

### Domain Filters

Use Odoo domain syntax for filtering:
\`\`\`typescript
// Simple equality
[['is_company', '=', true]]

// Multiple conditions (AND)
[['is_company', '=', true], ['country_id', '=', 233]]

// OR conditions
['|', ['email', 'ilike', '@gmail'], ['email', 'ilike', '@yahoo']]

// Common operators: =, !=, >, <, >=, <=, ilike, in, not in
\`\`\`

### Pagination

Use \`limit\` and \`offset\` for pagination:
\`\`\`typescript
await client.searchRead('res.partner', domain, {
  limit: 20,
  offset: 0,  // First page
});
\`\`\`
`.trim(),

  level: 'user',
  category: 'contacts',

  parameters: [
    {
      name: 'searchTerm',
      type: 'string',
      description: 'Text to search in name or email',
      required: false,
      example: 'acme',
    },
    {
      name: 'isCompany',
      type: 'boolean',
      description: 'Filter for companies only',
      required: false,
    },
    {
      name: 'limit',
      type: 'number',
      description: 'Maximum results to return',
      required: false,
      default: 100,
    },
  ],

  moduleDependencies: [],

  odooModels: ['res.partner'],

  examples: [
    {
      title: 'Search All Companies',
      description: 'Find all company records',
      code: `import { OdooClient } from '@odoo-toolbox/client';

const client = new OdooClient({
  url: process.env.ODOO_URL || 'http://localhost:8069',
  database: process.env.ODOO_DB || 'odoo',
  username: process.env.ODOO_USER || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
});

await client.authenticate();

const companies = await client.searchRead(
  'res.partner',
  [['is_company', '=', true]],
  {
    fields: ['name', 'email', 'phone', 'city', 'country_id'],
    limit: 20,
    order: 'name',
  }
);

console.log(\`Found \${companies.length} companies:\`);
companies.forEach(c => {
  const country = c.country_id ? c.country_id[1] : 'N/A';
  console.log(\`- \${c.name} (\${c.city || 'N/A'}, \${country})\`);
});

await client.logout();`,
      tested: true,
    },
    {
      title: 'Search by Name or Email',
      description: 'Find partners matching a search term',
      code: `import { OdooClient } from '@odoo-toolbox/client';

const client = new OdooClient({
  url: process.env.ODOO_URL || 'http://localhost:8069',
  database: process.env.ODOO_DB || 'odoo',
  username: process.env.ODOO_USER || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
});

await client.authenticate();

const searchTerm = 'admin';

// Search in name OR email
const partners = await client.searchRead(
  'res.partner',
  [
    '|',
    ['name', 'ilike', searchTerm],
    ['email', 'ilike', searchTerm],
  ],
  {
    fields: ['name', 'email', 'is_company', 'parent_id'],
    limit: 10,
  }
);

console.log(\`Partners matching "\${searchTerm}":\`);
partners.forEach(p => {
  const type = p.is_company ? 'Company' : 'Contact';
  const parent = p.parent_id ? \` (at \${p.parent_id[1]})\` : '';
  console.log(\`- [\${type}] \${p.name}\${parent}\`);
  console.log(\`  Email: \${p.email || 'N/A'}\`);
});

await client.logout();`,
      tested: true,
    },
    {
      title: 'Create and Find Partner',
      description: 'Create a new contact and search for it',
      code: `import { OdooClient } from '@odoo-toolbox/client';

const client = new OdooClient({
  url: process.env.ODOO_URL || 'http://localhost:8069',
  database: process.env.ODOO_DB || 'odoo',
  username: process.env.ODOO_USER || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
});

await client.authenticate();

// Create a new contact
const partnerId = await client.create('res.partner', {
  name: 'John Doe - Test Contact',
  email: 'john.doe.test@example.com',
  phone: '+1 555-0123',
  is_company: false,
});

console.log(\`Created partner with ID: \${partnerId}\`);

// Search for the created partner
const [partner] = await client.read('res.partner', [partnerId], [
  'name', 'email', 'phone', 'create_date'
]);

console.log(\`Found: \${partner.name}\`);
console.log(\`Email: \${partner.email}\`);
console.log(\`Created: \${partner.create_date}\`);

// Cleanup
await client.unlink('res.partner', partnerId);
await client.logout();`,
      tested: true,
    },
  ],

  relatedSkills: ['odoo-create-lead', 'odoo-introspect'],

  odooReferences: [
    'https://github.com/odoo/odoo/blob/17.0/odoo/addons/base/models/res_partner.py',
  ],

  tags: ['contacts', 'partners', 'companies', 'search', 'crm'],
};
