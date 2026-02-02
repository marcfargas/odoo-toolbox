import { SkillDefinition } from '../../types';

/**
 * SKILL: odoo-install-module
 *
 * Admin-level SKILL for installing and managing Odoo modules.
 */
export const installModuleSkill: SkillDefinition = {
  id: 'odoo-install-module',
  shortName: 'install-module',
  title: 'Install Odoo Module',
  summary: 'Install, uninstall, or upgrade Odoo modules',

  description: `
This SKILL helps administrators manage Odoo modules.

## What it does

1. Install modules that are available but not installed
2. Uninstall modules (if safe to do so)
3. Upgrade modules to apply changes
4. Check module installation status

## When to use

- Before using SKILLs that require specific modules (CRM, Sales, etc.)
- When setting up a new Odoo instance
- After updating module code to apply changes

## Important Notes

### Installation Time

Module installation can take from seconds to minutes depending on:
- Module complexity
- Database size
- Dependencies being installed

### Dependencies

Installing a module will automatically install its dependencies.
For example, installing \`sale\` will also install \`product\`.

### Uninstallation Warnings

Uninstalling modules can cause data loss. Odoo will refuse to uninstall
modules if other installed modules depend on them.
`.trim(),

  level: 'admin',
  category: 'modules',

  parameters: [
    {
      name: 'moduleName',
      type: 'string',
      description: 'Technical module name',
      required: true,
      example: 'crm',
    },
    {
      name: 'action',
      type: 'string',
      description: 'Action to perform: install, uninstall, upgrade',
      required: false,
      default: 'install',
    },
  ],

  moduleDependencies: [],

  odooModels: ['ir.module.module'],

  examples: [
    {
      title: 'Install a Module',
      description: 'Install the CRM module',
      code: `import { OdooClient, ModuleManager } from '@odoo-toolbox/client';

const client = new OdooClient({
  url: process.env.ODOO_URL || 'http://localhost:8069',
  database: process.env.ODOO_DB || 'odoo',
  username: process.env.ODOO_USER || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
});

await client.authenticate();

const moduleManager = new ModuleManager(client);

const moduleName = 'crm';

// Check if already installed
const isInstalled = await moduleManager.isModuleInstalled(moduleName);

if (isInstalled) {
  console.log(\`Module '\${moduleName}' is already installed\`);
} else {
  console.log(\`Installing '\${moduleName}'...\`);
  await moduleManager.installModule(moduleName);
  console.log(\`Module '\${moduleName}' installed successfully\`);
}

await client.logout();`,
      tested: true,
    },
    {
      title: 'Check and Install Multiple Modules',
      description: 'Ensure multiple modules are installed',
      code: `import { OdooClient, ModuleManager } from '@odoo-toolbox/client';

const client = new OdooClient({
  url: process.env.ODOO_URL || 'http://localhost:8069',
  database: process.env.ODOO_DB || 'odoo',
  username: process.env.ODOO_USER || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
});

await client.authenticate();

const moduleManager = new ModuleManager(client);

const requiredModules = ['crm', 'sale', 'project'];

console.log('Checking required modules...');

for (const moduleName of requiredModules) {
  const isInstalled = await moduleManager.isModuleInstalled(moduleName);

  if (isInstalled) {
    console.log(\`✓ \${moduleName} - already installed\`);
  } else {
    console.log(\`→ Installing \${moduleName}...\`);
    await moduleManager.installModule(moduleName);
    console.log(\`✓ \${moduleName} - installed\`);
  }
}

console.log('All required modules are installed!');

await client.logout();`,
      tested: true,
    },
    {
      title: 'Uninstall a Module',
      description: 'Safely uninstall a module',
      code: `import { OdooClient, ModuleManager } from '@odoo-toolbox/client';

const client = new OdooClient({
  url: process.env.ODOO_URL || 'http://localhost:8069',
  database: process.env.ODOO_DB || 'odoo',
  username: process.env.ODOO_USER || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
});

await client.authenticate();

const moduleManager = new ModuleManager(client);

const moduleName = 'lunch'; // Example module

try {
  const isInstalled = await moduleManager.isModuleInstalled(moduleName);

  if (!isInstalled) {
    console.log(\`Module '\${moduleName}' is not installed\`);
  } else {
    console.log(\`Uninstalling '\${moduleName}'...\`);
    await moduleManager.uninstallModule(moduleName);
    console.log(\`Module '\${moduleName}' uninstalled\`);
  }
} catch (error) {
  if (error instanceof Error) {
    console.error(\`Cannot uninstall: \${error.message}\`);
    console.log('The module may have dependencies that prevent uninstallation');
  }
}

await client.logout();`,
      tested: true,
    },
  ],

  relatedSkills: ['odoo-explore-modules', 'odoo-connect'],

  odooReferences: [
    'https://github.com/odoo/odoo/blob/17.0/odoo/addons/base/models/ir_module.py',
  ],

  tags: ['modules', 'installation', 'admin', 'setup', 'configuration'],
};
