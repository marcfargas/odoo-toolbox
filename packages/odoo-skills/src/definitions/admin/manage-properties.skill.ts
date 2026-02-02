import { SkillDefinition } from '../../types';

/**
 * SKILL: odoo-manage-properties
 *
 * Admin-level SKILL for defining and managing dynamic properties fields.
 */
export const managePropertiesSkill: SkillDefinition = {
  id: 'odoo-manage-properties',
  shortName: 'manage-properties',
  title: 'Manage Odoo Properties Fields',
  summary: 'Define and manage dynamic properties fields on Odoo models',

  description: `
This SKILL helps administrators define and manage Properties fields in Odoo.

## What are Properties?

Properties are dynamic, user-definable fields that can be created via configuration
without modifying the database schema. They're commonly used in:
- CRM leads (\`lead_properties\` on \`crm.lead\`)
- Project tasks (\`task_properties\` on \`project.task\`)

## Properties Definition Structure

Each property definition requires:
- \`name\`: Technical identifier (no spaces, lowercase)
- \`string\`: Human-readable label
- \`type\`: One of the allowed types

## Allowed Property Types

From \`odoo/fields.py:Properties.ALLOWED_TYPES\`:
- **Standard**: \`boolean\`, \`integer\`, \`float\`, \`char\`, \`date\`, \`datetime\`
- **Relational**: \`many2one\`, \`many2many\`, \`selection\`, \`tags\`
- **UI**: \`separator\` (visual organizer, no value)

**Note**: \`text\` is NOT a valid property type - use \`char\` instead.

## Read/Write Asymmetry

Properties have different formats when reading vs writing:

**Write Format** (simple key-value):
\`\`\`typescript
{ priority: 'high', score: 85, active: true }
\`\`\`

**Read Format** (array with metadata):
\`\`\`typescript
[
  { name: 'priority', type: 'selection', string: 'Priority', value: 'high' },
  { name: 'score', type: 'integer', string: 'Score', value: 85 },
  { name: 'active', type: 'boolean', string: 'Active', value: true }
]
\`\`\`

## CRITICAL: Full Replacement Behavior

When writing properties, Odoo **REPLACES** all property values.
Unspecified properties are set to \`false\`.

\`\`\`typescript
// ❌ BAD - This clears all other properties!
await client.write('crm.lead', id, {
  lead_properties: { priority: 'high' }
});

// ✓ GOOD - Read first, then write ALL properties
const lead = await client.read('crm.lead', id, ['lead_properties']);
const props = propertiesToWriteFormat(lead[0].lead_properties);
props.priority = 'high';
await client.write('crm.lead', id, { lead_properties: props });
\`\`\`
`.trim(),

  level: 'admin',
  category: 'properties',

  parameters: [
    {
      name: 'model',
      type: 'string',
      description:
        'Parent model for properties definition (e.g., crm.team for lead_properties)',
      required: true,
      example: 'crm.team',
    },
    {
      name: 'definitionField',
      type: 'string',
      description: 'Field name for properties definition',
      required: true,
      example: 'lead_properties_definition',
    },
    {
      name: 'properties',
      type: 'array',
      description: 'Array of property definitions',
      required: true,
      example: [
        {
          name: 'priority',
          string: 'Priority',
          type: 'selection',
          selection: [
            ['low', 'Low'],
            ['high', 'High'],
          ],
        },
        { name: 'score', string: 'Score', type: 'integer' },
      ],
    },
  ],

  moduleDependencies: [
    {
      name: 'crm',
      displayName: 'CRM',
      required: false, // Properties exist in base, CRM adds lead_properties
    },
  ],

  odooModels: ['crm.team', 'crm.lead', 'project.project', 'project.task'],

  examples: [
    {
      title: 'Define CRM Lead Properties',
      description: 'Create custom properties for CRM leads',
      code: `import { OdooClient, PropertiesDefinition } from '@odoo-toolbox/client';

const client = new OdooClient({
  url: process.env.ODOO_URL || 'http://localhost:8069',
  database: process.env.ODOO_DB || 'odoo',
  username: process.env.ODOO_USER || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
});

await client.authenticate();

// Get a CRM team
const teams = await client.searchRead('crm.team', [], {
  fields: ['id', 'name'],
  limit: 1,
});

if (teams.length === 0) {
  console.log('No CRM teams found - install CRM module first');
  process.exit(1);
}

const teamId = teams[0].id;
console.log(\`Configuring properties for team: \${teams[0].name}\`);

// Define properties
const propertiesDefinition: PropertiesDefinition = [
  {
    name: 'priority_level',
    string: 'Priority Level',
    type: 'selection',
    selection: [
      ['low', 'Low'],
      ['medium', 'Medium'],
      ['high', 'High'],
      ['critical', 'Critical'],
    ],
  },
  {
    name: 'lead_score',
    string: 'Lead Score',
    type: 'integer',
  },
  {
    name: 'requires_approval',
    string: 'Requires Approval',
    type: 'boolean',
  },
  {
    name: 'notes',
    string: 'Internal Notes',
    type: 'char', // Note: use 'char' not 'text'
  },
];

// Write definition to team
await client.write('crm.team', teamId, {
  lead_properties_definition: propertiesDefinition,
});

console.log('Properties defined successfully!');
console.log('Properties:');
propertiesDefinition.forEach(p => {
  console.log(\`- \${p.string} (\${p.name}): \${p.type}\`);
});

await client.logout();`,
      tested: true,
    },
    {
      title: 'Selection Property with Options',
      description: 'Create a selection property with predefined options',
      code: `import { OdooClient, PropertiesDefinition } from '@odoo-toolbox/client';

const client = new OdooClient({
  url: process.env.ODOO_URL || 'http://localhost:8069',
  database: process.env.ODOO_DB || 'odoo',
  username: process.env.ODOO_USER || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
});

await client.authenticate();

const teams = await client.searchRead('crm.team', [], { limit: 1 });
const teamId = teams[0].id;

// Define a selection property
const definition: PropertiesDefinition = [
  {
    name: 'lead_source',
    string: 'Lead Source',
    type: 'selection',
    selection: [
      ['website', 'Website'],
      ['referral', 'Referral'],
      ['social', 'Social Media'],
      ['trade_show', 'Trade Show'],
      ['cold_call', 'Cold Call'],
      ['other', 'Other'],
    ],
  },
  {
    name: 'industry',
    string: 'Industry',
    type: 'selection',
    selection: [
      ['tech', 'Technology'],
      ['finance', 'Finance'],
      ['healthcare', 'Healthcare'],
      ['retail', 'Retail'],
      ['manufacturing', 'Manufacturing'],
    ],
  },
];

await client.write('crm.team', teamId, {
  lead_properties_definition: definition,
});

console.log('Selection properties created');

await client.logout();`,
      tested: true,
    },
    {
      title: 'Read and Modify Properties Values',
      description: 'Safely read and update property values on a record',
      code: `import {
  OdooClient,
  propertiesToWriteFormat,
  getPropertyValue,
} from '@odoo-toolbox/client';

const client = new OdooClient({
  url: process.env.ODOO_URL || 'http://localhost:8069',
  database: process.env.ODOO_DB || 'odoo',
  username: process.env.ODOO_USER || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
});

await client.authenticate();

// Find a lead with properties
const leads = await client.searchRead(
  'crm.lead',
  [['lead_properties', '!=', false]],
  { fields: ['name', 'lead_properties'], limit: 1 }
);

if (leads.length === 0) {
  console.log('No leads with properties found');
  process.exit(0);
}

const lead = leads[0];
console.log(\`Lead: \${lead.name}\`);

// Read current property values
console.log('Current properties (read format):');
lead.lead_properties.forEach((prop: any) => {
  console.log(\`- \${prop.string}: \${JSON.stringify(prop.value)}\`);
});

// Extract a specific value
const currentScore = getPropertyValue(lead.lead_properties, 'lead_score');
console.log(\`\\nCurrent score: \${currentScore}\`);

// Convert to write format and modify
const writeFormat = propertiesToWriteFormat(lead.lead_properties);
console.log('\\nWrite format:', writeFormat);

// Update a value (preserving others)
if ('lead_score' in writeFormat) {
  writeFormat.lead_score = (writeFormat.lead_score as number) + 10;

  await client.write('crm.lead', lead.id, {
    lead_properties: writeFormat,
  });

  console.log(\`\\nUpdated score to: \${writeFormat.lead_score}\`);
}

await client.logout();`,
      tested: true,
    },
  ],

  relatedSkills: ['odoo-create-lead', 'odoo-introspect'],

  odooReferences: [
    'https://github.com/odoo/odoo/blob/17.0/odoo/fields.py#L3188',
    'https://github.com/odoo/odoo/blob/17.0/odoo/fields.py#L3419',
    'https://github.com/odoo/odoo/blob/17.0/addons/crm/models/crm_lead.py',
  ],

  tags: ['properties', 'configuration', 'admin', 'dynamic-fields', 'crm'],
};
