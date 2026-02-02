import { SkillDefinition } from '../../types';

/**
 * SKILL: odoo-create-lead
 *
 * User-level SKILL for creating CRM leads with optional properties.
 */
export const createLeadSkill: SkillDefinition = {
  id: 'odoo-create-lead',
  shortName: 'create-lead',
  title: 'Create CRM Lead',
  summary: 'Create a new lead in Odoo CRM with optional properties',

  description: `
This SKILL helps you create CRM leads in Odoo, including support for:
- Basic lead information (name, contact, expected revenue)
- Custom properties fields (dynamic user-defined fields)
- Linking to existing contacts
- Team assignment

## Prerequisites

- CRM module must be installed
- Authenticated OdooClient connection

## Key Concepts

### Many2One Fields

When writing many2one fields (like \`partner_id\`, \`team_id\`), pass just the numeric ID.
When reading, Odoo returns \`[id, display_name]\` tuples.

\`\`\`typescript
// Writing: pass just the ID
await client.create('crm.lead', { partner_id: 42 });

// Reading: returns [id, name]
const lead = await client.read('crm.lead', id, ['partner_id']);
// lead.partner_id = [42, 'John Doe']
\`\`\`

### Properties Fields

CRM leads support dynamic properties defined at the team level (\`crm.team.lead_properties_definition\`).

When writing properties:
- Use simple key-value format: \`{ priority: 'high', score: 85 }\`
- **IMPORTANT**: Writing properties REPLACES ALL values
- Unspecified properties become \`false\`
- Always read first to preserve existing values

\`\`\`typescript
// Read current properties
const lead = await client.read('crm.lead', id, ['lead_properties']);
const props = propertiesToWriteFormat(lead[0].lead_properties);

// Modify and write ALL properties
props.score = 90;
await client.write('crm.lead', id, { lead_properties: props });
\`\`\`
`.trim(),

  level: 'user',
  category: 'crm',

  parameters: [
    {
      name: 'name',
      type: 'string',
      description: 'Lead/opportunity name',
      required: true,
      example: 'Enterprise Software License Deal',
    },
    {
      name: 'email_from',
      type: 'string',
      description: 'Contact email address',
      required: false,
      example: 'contact@example.com',
    },
    {
      name: 'phone',
      type: 'string',
      description: 'Contact phone number',
      required: false,
      example: '+1 555-0123',
    },
    {
      name: 'expected_revenue',
      type: 'number',
      description: 'Expected revenue amount',
      required: false,
      example: 50000,
    },
    {
      name: 'partner_id',
      type: 'number',
      description: 'Link to existing contact (res.partner ID)',
      required: false,
    },
    {
      name: 'team_id',
      type: 'number',
      description: 'Sales team ID',
      required: false,
    },
    {
      name: 'lead_properties',
      type: 'object',
      description: 'Custom properties (key-value pairs)',
      required: false,
      example: { priority: 'high', score: 85 },
    },
  ],

  moduleDependencies: [
    {
      name: 'crm',
      displayName: 'CRM',
      required: true,
    },
  ],

  odooModels: ['crm.lead', 'crm.team', 'res.partner'],

  examples: [
    {
      title: 'Simple Lead Creation',
      description: 'Create a basic lead with name and contact info',
      code: `import { OdooClient } from '@odoo-toolbox/client';

const client = new OdooClient({
  url: process.env.ODOO_URL || 'http://localhost:8069',
  database: process.env.ODOO_DB || 'odoo',
  username: process.env.ODOO_USER || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
});

await client.authenticate();

const leadId = await client.create('crm.lead', {
  name: 'Enterprise Software License Deal',
  email_from: 'contact@example.com',
  phone: '+1 555-0123',
  expected_revenue: 50000,
});

console.log(\`Created lead with ID: \${leadId}\`);

// Read back the lead
const [lead] = await client.read('crm.lead', [leadId], [
  'name', 'stage_id', 'partner_id'
]);

console.log(\`Lead: \${lead.name}\`);
console.log(\`Stage: \${lead.stage_id ? lead.stage_id[1] : 'None'}\`);

// Cleanup
await client.unlink('crm.lead', leadId);
await client.logout();`,
      tested: true,
    },
    {
      title: 'Lead with Properties',
      description: 'Create lead with custom properties fields',
      code: `import { OdooClient, propertiesToWriteFormat, getPropertyValue } from '@odoo-toolbox/client';

const client = new OdooClient({
  url: process.env.ODOO_URL || 'http://localhost:8069',
  database: process.env.ODOO_DB || 'odoo',
  username: process.env.ODOO_USER || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
});

await client.authenticate();

// Get a CRM team (properties are defined per-team)
const teams = await client.searchRead('crm.team', [], { limit: 1 });
if (teams.length === 0) {
  console.log('No CRM teams found');
  process.exit(1);
}
const teamId = teams[0].id;

// Create lead with properties
const leadId = await client.create('crm.lead', {
  name: 'High Priority Opportunity',
  team_id: teamId,
  expected_revenue: 100000,
  lead_properties: {
    priority: 'high',
    score: 85,
  },
});

console.log(\`Created lead with ID: \${leadId}\`);

// Read properties
const [lead] = await client.read('crm.lead', [leadId], ['lead_properties']);
const score = getPropertyValue(lead.lead_properties, 'score');
console.log(\`Lead score: \${score}\`);

// Update properties (read-modify-write pattern)
const currentProps = propertiesToWriteFormat(lead.lead_properties);
currentProps.score = 95;
await client.write('crm.lead', [leadId], { lead_properties: currentProps });

// Cleanup
await client.unlink('crm.lead', leadId);
await client.logout();`,
      tested: true,
    },
  ],

  relatedSkills: [
    'odoo-search-partners',
    'odoo-manage-properties',
  ],

  odooReferences: [
    'https://github.com/odoo/odoo/blob/17.0/addons/crm/models/crm_lead.py',
    'https://github.com/odoo/odoo/blob/17.0/addons/crm/models/crm_team.py',
  ],

  tags: ['crm', 'leads', 'sales', 'properties', 'create'],
};
