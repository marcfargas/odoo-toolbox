import { SkillDefinition } from '../../types';

/**
 * SKILL: odoo-connect
 *
 * Elementary SKILL for connecting and authenticating with Odoo instances.
 * This is typically the first SKILL an agent uses before any other operation.
 */
export const connectSkill: SkillDefinition = {
  id: 'odoo-connect',
  shortName: 'connect',
  title: 'Connect to Odoo Instance',
  summary: 'Establish authenticated connection to an Odoo instance',

  description: `
This SKILL helps you connect to an Odoo instance using the @odoo-toolbox/client package.

## What it does

1. Creates an OdooClient instance with your connection configuration
2. Authenticates with Odoo using JSON-RPC protocol
3. Returns session information including user ID and database name

## When to use

- At the start of any Odoo automation script
- When you need to verify Odoo is accessible
- Before performing any CRUD operations

## Connection Configuration

The OdooClient requires these parameters:
- **url**: The Odoo instance URL (e.g., \`http://localhost:8069\`)
- **database**: The Odoo database name
- **username**: User login (typically email or 'admin')
- **password**: User password

## Credential Configuration

### Option 1: .odoo.env file (Recommended)

Create a \`.odoo.env\` file in your project root:

\`\`\`bash
ODOO_URL=http://localhost:8069
ODOO_DB=my_database
ODOO_USER=admin
ODOO_PASSWORD=my_secure_password
\`\`\`

> **Important**: Add \`.odoo.env\` to \`.gitignore\` to avoid committing credentials.

### Option 2: Environment Variables

Set these environment variables:
- \`ODOO_URL\`: Odoo instance URL
- \`ODOO_DB\` or \`ODOO_DATABASE\`: Database name
- \`ODOO_USER\` or \`ODOO_USERNAME\`: Username
- \`ODOO_PASSWORD\`: Password

### Option 3: CLAUDE.md

Document your Odoo connection in your project's CLAUDE.md file so Claude knows how to connect.
`.trim(),

  level: 'elementary',
  category: 'connection',

  parameters: [
    {
      name: 'url',
      type: 'string',
      description: 'Odoo instance URL (e.g., http://localhost:8069)',
      required: true,
      example: 'http://localhost:8069',
    },
    {
      name: 'database',
      type: 'string',
      description: 'Odoo database name',
      required: true,
      example: 'odoo',
    },
    {
      name: 'username',
      type: 'string',
      description: 'Odoo username (login)',
      required: true,
      example: 'admin',
    },
    {
      name: 'password',
      type: 'string',
      description: 'Odoo password',
      required: true,
      example: 'admin',
    },
  ],

  moduleDependencies: [], // Base Odoo only, no additional modules required

  odooModels: ['res.users'],

  examples: [
    {
      title: 'Basic Connection',
      description: 'Connect to a local Odoo instance with default credentials',
      code: `import { OdooClient } from '@odoo-toolbox/client';

const client = new OdooClient({
  url: 'http://localhost:8069',
  database: 'odoo',
  username: 'admin',
  password: 'admin',
});

await client.authenticate();
console.log('Connected successfully!');

// Always logout when done
await client.logout();`,
      tested: true,
    },
    {
      title: 'Connection with Environment Variables',
      description: 'Secure connection using environment variables',
      code: `import { OdooClient } from '@odoo-toolbox/client';

const client = new OdooClient({
  url: process.env.ODOO_URL || 'http://localhost:8069',
  database: process.env.ODOO_DB || 'odoo',
  username: process.env.ODOO_USER || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
});

await client.authenticate();

// Get session info
const sessionInfo = client.getSessionInfo();
console.log(\`Authenticated as user ID: \${sessionInfo?.uid}\`);
console.log(\`Database: \${sessionInfo?.db}\`);

await client.logout();`,
      tested: true,
    },
    {
      title: 'Connection with Error Handling',
      description: 'Robust connection with comprehensive error handling',
      code: `import { OdooClient, OdooAuthError, OdooNetworkError } from '@odoo-toolbox/client';

const client = new OdooClient({
  url: process.env.ODOO_URL || 'http://localhost:8069',
  database: process.env.ODOO_DB || 'odoo',
  username: process.env.ODOO_USER || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
});

try {
  await client.authenticate();
  console.log('Connected successfully!');

  // Perform operations here...

} catch (error) {
  if (error instanceof OdooAuthError) {
    console.error('Authentication failed - check username/password');
  } else if (error instanceof OdooNetworkError) {
    console.error('Network error - check URL and connectivity');
  } else {
    console.error('Unexpected error:', error);
  }
  process.exit(1);
} finally {
  await client.logout();
}`,
      tested: true,
    },
  ],

  relatedSkills: ['odoo-introspect', 'odoo-search-fields', 'odoo-explore-modules'],

  odooReferences: [
    'https://github.com/odoo/odoo/blob/17.0/odoo/http.py',
    'https://github.com/odoo/odoo/blob/17.0/odoo/service/security.py',
  ],

  tags: ['connection', 'authentication', 'getting-started', 'setup'],
};
