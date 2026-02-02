import { SkillDefinition } from '../../types';

/**
 * SKILL: odoo-explore-modules
 *
 * Elementary SKILL for exploring available and installed modules.
 */
export const exploreModulesSkill: SkillDefinition = {
  id: 'odoo-explore-modules',
  shortName: 'explore-modules',
  title: 'Explore Odoo Modules',
  summary: 'List and explore available Odoo modules',

  description: `
This SKILL helps you explore Odoo modules - both installed and available.

## What it does

1. Lists all modules in the system
2. Checks module installation status
3. Gets module information and dependencies

## When to use

- Before using a SKILL that requires a specific module
- To understand what features are available in an Odoo instance
- To check if CRM, Sales, or other modules are installed
- To discover available but uninstalled modules

## Module States

- \`installed\`: Module is active
- \`uninstalled\`: Available but not installed
- \`to install\`: Queued for installation
- \`to upgrade\`: Queued for upgrade

## Common Modules

- \`crm\`: Customer Relationship Management
- \`sale\`: Sales Management
- \`purchase\`: Purchase Management
- \`stock\`: Inventory Management
- \`project\`: Project Management
- \`mail\`: Messaging and Activities
`.trim(),

  level: 'elementary',
  category: 'modules',

  parameters: [
    {
      name: 'state',
      type: 'string',
      description: 'Filter by module state',
      required: false,
      example: 'installed',
    },
    {
      name: 'namePattern',
      type: 'string',
      description: 'Filter by module name pattern',
      required: false,
      example: 'sale',
    },
  ],

  moduleDependencies: [],

  odooModels: ['ir.module.module'],

  examples: [
    {
      title: 'List Installed Modules',
      description: 'Get all currently installed modules',
      code: `import { OdooClient } from '@odoo-toolbox/client';

const client = new OdooClient({
  url: process.env.ODOO_URL || 'http://localhost:8069',
  database: process.env.ODOO_DB || 'odoo',
  username: process.env.ODOO_USER || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
});

await client.authenticate();

const modules = await client.searchRead(
  'ir.module.module',
  [['state', '=', 'installed']],
  { fields: ['name', 'shortdesc', 'state'], order: 'name' }
);

console.log(\`Installed modules (\${modules.length}):\`);
modules.forEach(m => {
  console.log(\`- \${m.name}: \${m.shortdesc}\`);
});

await client.logout();`,
      tested: true,
    },
    {
      title: 'Check Module Status',
      description: 'Check if specific modules are installed',
      code: `import { OdooClient, ModuleManager } from '@odoo-toolbox/client';

const client = new OdooClient({
  url: process.env.ODOO_URL || 'http://localhost:8069',
  database: process.env.ODOO_DB || 'odoo',
  username: process.env.ODOO_USER || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
});

await client.authenticate();

const moduleManager = new ModuleManager(client);

const modulesToCheck = ['crm', 'sale', 'project', 'stock'];

console.log('Module status:');
for (const moduleName of modulesToCheck) {
  const isInstalled = await moduleManager.isModuleInstalled(moduleName);
  const status = isInstalled ? 'INSTALLED' : 'not installed';
  console.log(\`- \${moduleName}: \${status}\`);
}

await client.logout();`,
      tested: true,
    },
    {
      title: 'Get Module Info',
      description: 'Get detailed information about a specific module',
      code: `import { OdooClient } from '@odoo-toolbox/client';

const client = new OdooClient({
  url: process.env.ODOO_URL || 'http://localhost:8069',
  database: process.env.ODOO_DB || 'odoo',
  username: process.env.ODOO_USER || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
});

await client.authenticate();

const moduleName = 'base';

const modules = await client.searchRead(
  'ir.module.module',
  [['name', '=', moduleName]],
  {
    fields: [
      'name', 'shortdesc', 'summary', 'state',
      'author', 'website', 'installed_version'
    ]
  }
);

if (modules.length > 0) {
  const m = modules[0];
  console.log(\`Module: \${m.name}\`);
  console.log(\`Name: \${m.shortdesc}\`);
  console.log(\`Summary: \${m.summary}\`);
  console.log(\`State: \${m.state}\`);
  console.log(\`Version: \${m.installed_version}\`);
  console.log(\`Author: \${m.author}\`);
}

await client.logout();`,
      tested: true,
    },
  ],

  relatedSkills: ['odoo-connect', 'odoo-install-module', 'odoo-introspect'],

  odooReferences: [
    'https://github.com/odoo/odoo/blob/17.0/odoo/addons/base/models/ir_module.py',
  ],

  tags: ['modules', 'discovery', 'installation', 'setup'],
};
