import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SessionManager } from './session/index.js';
import { registerAllTools } from './tools/index.js';
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

// Combine usage guide with resource documentation
const SERVER_INSTRUCTIONS = `${getServerInstructions()}

${RESOURCE_INSTRUCTIONS.trim()}`;

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
}

export function createOdooMcpServer(_options: OdooMcpServerOptions = {}): OdooMcpServer {
  const session = new SessionManager();

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
      instructions: SERVER_INSTRUCTIONS,
    }
  );

  // Register all tools with the session manager
  registerAllTools(server, session);

  // Register resource handlers for skills
  registerResources(server);

  return { server, session };
}

export async function startServer(options: OdooMcpServerOptions = {}): Promise<void> {
  const { server, session } = createOdooMcpServer(options);

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
