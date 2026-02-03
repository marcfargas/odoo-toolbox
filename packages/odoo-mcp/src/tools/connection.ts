import { SessionManager } from '../session/index.js';
import { formatError, McpErrorResponse } from '../utils/index.js';
import {
  AuthenticateInputSchema,
  AuthenticateOutput,
  LogoutOutput,
  ConnectionStatusOutput,
} from '../schemas/index.js';

export async function handleAuthenticate(
  session: SessionManager,
  input: unknown
): Promise<AuthenticateOutput | McpErrorResponse> {
  try {
    const params = AuthenticateInputSchema.parse(input);
    const result = await session.authenticate({
      url: params.url,
      database: params.database,
      username: params.username,
      password: params.password,
    });

    return {
      success: true,
      uid: result.uid,
      database: params.database,
      message: `Successfully authenticated as user ${result.uid} on database ${params.database}`,
    };
  } catch (error) {
    return formatError(error);
  }
}

export function handleLogout(session: SessionManager): LogoutOutput | McpErrorResponse {
  try {
    const wasAuthenticated = session.isAuthenticated();
    session.logout();

    return {
      success: true,
      message: wasAuthenticated ? 'Successfully logged out' : 'No active session to logout',
    };
  } catch (error) {
    return formatError(error);
  }
}

export function handleConnectionStatus(
  session: SessionManager
): ConnectionStatusOutput | McpErrorResponse {
  try {
    const status = session.getStatus();

    return {
      success: true,
      connected: status.isConnected,
      authenticated: status.isAuthenticated,
      url: status.config?.url,
      database: status.config?.database,
      uid: status.uid ?? undefined,
      connectedAt: status.connectedAt?.toISOString(),
      message: status.isAuthenticated
        ? `Connected to ${status.config?.database} as user ${status.uid}`
        : 'Not connected',
    };
  } catch (error) {
    return formatError(error);
  }
}

export const connectionToolDefinitions = [
  {
    name: 'odoo_authenticate',
    description: 'Connect and authenticate with an Odoo server',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Odoo server URL (e.g., http://localhost:8069)',
        },
        database: {
          type: 'string',
          description: 'Database name',
        },
        username: {
          type: 'string',
          description: 'Username (typically email)',
        },
        password: {
          type: 'string',
          description: 'User password or API key',
        },
      },
      required: ['url', 'database', 'username', 'password'],
    },
  },
  {
    name: 'odoo_logout',
    description: 'Close the current Odoo connection and clear session state',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'odoo_connection_status',
    description: 'Check the current connection status with Odoo',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];
