import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SessionManager } from './session/index.js';
import { registerAllTools } from './tools/index.js';

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
      },
    }
  );

  // Register all tools with the session manager
  registerAllTools(server, session);

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
