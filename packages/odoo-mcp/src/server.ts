import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SessionManager } from './session/index.js';
import { registerAllTools, DynamicToolRegistry } from './tools/index.js';
import { registerResources } from './resources/index.js';
import { getServerInstructions } from './instructions.js';

const RESOURCE_INSTRUCTIONS = `
## Available Resources (Skills)
This server exposes skill documentation as MCP Resources. Use resources/list
to discover available skills, then resources/read to fetch specific content.

### Skill Categories:
- skill://base/* - Core Odoo operations (connection, CRUD, domains, etc.)
- skill://mail/* - Mail system (chatter, activities, discuss)
- skill://oca-modules/* - OCA community modules

### Recommended Workflow:
1. Check connection status with odoo_connection_status
2. Read relevant skill documentation for guidance on complex operations
3. Use introspection tools to understand the data model
4. Perform operations using CRUD tools

For custom skills tailored to your Odoo instance, see @odoo-toolbox/create-skills.
`;

export interface OdooMcpServerOptions {
  autoAuth?: {
    url: string;
    database: string;
    username: string;
    password: string;
  };
}

export interface OdooMcpServer {
  server: Server;
  session: SessionManager;
  registry: DynamicToolRegistry;
}

/**
 * Build server instructions, including connection info if available.
 */
function buildServerInstructions(options: OdooMcpServerOptions): string {
  const parts: string[] = [];

  // Add connection status information
  if (options.autoAuth) {
    const { url, database, username } = options.autoAuth;
    parts.push(`## Connection Configuration
This server has been pre-configured with Odoo credentials:
- **Server**: ${url}
- **Database**: ${database}
- **User**: ${username}

The connection will be established automatically. You do not need to ask the user for credentials.
If the user wants to connect to a different server or database, use \`odoo_connect\` with the new credentials.
`);
  } else {
    parts.push(`## Connection Required
No credentials have been pre-configured. Use the \`odoo_connect\` tool to authenticate before performing operations.
`);
  }

  // Add the standard instructions
  parts.push(getServerInstructions());
  parts.push(RESOURCE_INSTRUCTIONS.trim());

  return parts.join('\n\n');
}

export function createOdooMcpServer(options: OdooMcpServerOptions = {}): OdooMcpServer {
  const session = new SessionManager();
  const instructions = buildServerInstructions(options);

  const server = new Server(
    {
      name: 'odoo-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
      instructions,
    }
  );

  // Register all tools with the session manager and get registry
  const registry = registerAllTools(server, session);

  // Register resource handlers for skills
  registerResources(server);

  return { server, session, registry };
}

export async function startServer(options: OdooMcpServerOptions = {}): Promise<void> {
  const { server, session } = createOdooMcpServer(options);

  // Log connection info for debugging
  if (options.autoAuth) {
    console.error(
      `[odoo-mcp] Configured for ${options.autoAuth.url} database "${options.autoAuth.database}" as user "${options.autoAuth.username}"`
    );
  }

  // Auto-authenticate if credentials are provided
  if (options.autoAuth) {
    try {
      await session.authenticate(options.autoAuth);
      console.error(`[odoo-mcp] Auto-authenticated to ${options.autoAuth.database}`);
    } catch (error) {
      console.error('[odoo-mcp] Auto-authentication failed:', error);
    }
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[odoo-mcp] Server started');
}

export function getAutoAuthConfig(): OdooMcpServerOptions['autoAuth'] | undefined {
  const url = process.env.ODOO_URL;
  const database = process.env.ODOO_DB_NAME;
  const username = process.env.ODOO_DB_USER;
  const password = process.env.ODOO_DB_PASSWORD;

  if (url && database && username && password) {
    return { url, database, username, password };
  }

  return undefined;
}
