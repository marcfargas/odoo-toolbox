import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { SessionManager } from '../session/index.js';
import {
  handleAuthenticate,
  handleLogout,
  handleConnectionStatus,
  connectionToolDefinitions,
} from './connection.js';
import {
  handleSearch,
  handleRead,
  handleSearchRead,
  handleCreate,
  handleWrite,
  handleUnlink,
  handleCall,
  crudToolDefinitions,
} from './crud.js';
import {
  handleModuleInstall,
  handleModuleUninstall,
  handleModuleUpgrade,
  handleModuleList,
  handleModuleInfo,
  moduleToolDefinitions,
} from './modules.js';
import {
  handleGetModels,
  handleGetFields,
  handleGetModelMetadata,
  handleGenerateTypes,
  introspectionToolDefinitions,
} from './introspection.js';

export const allToolDefinitions = [
  ...connectionToolDefinitions,
  ...crudToolDefinitions,
  ...moduleToolDefinitions,
  ...introspectionToolDefinitions,
];

export function registerAllTools(server: Server, session: SessionManager): void {
  // Register tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: allToolDefinitions,
    };
  });

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    let result: unknown;

    switch (name) {
      // Connection tools
      case 'odoo_authenticate':
        result = await handleAuthenticate(session, args);
        break;
      case 'odoo_logout':
        result = handleLogout(session);
        break;
      case 'odoo_connection_status':
        result = handleConnectionStatus(session);
        break;

      // CRUD tools
      case 'odoo_search':
        result = await handleSearch(session, args);
        break;
      case 'odoo_read':
        result = await handleRead(session, args);
        break;
      case 'odoo_search_read':
        result = await handleSearchRead(session, args);
        break;
      case 'odoo_create':
        result = await handleCreate(session, args);
        break;
      case 'odoo_write':
        result = await handleWrite(session, args);
        break;
      case 'odoo_unlink':
        result = await handleUnlink(session, args);
        break;
      case 'odoo_call':
        result = await handleCall(session, args);
        break;

      // Module tools
      case 'odoo_module_install':
        result = await handleModuleInstall(session, args);
        break;
      case 'odoo_module_uninstall':
        result = await handleModuleUninstall(session, args);
        break;
      case 'odoo_module_upgrade':
        result = await handleModuleUpgrade(session, args);
        break;
      case 'odoo_module_list':
        result = await handleModuleList(session, args);
        break;
      case 'odoo_module_info':
        result = await handleModuleInfo(session, args);
        break;

      // Introspection tools
      case 'odoo_get_models':
        result = await handleGetModels(session, args);
        break;
      case 'odoo_get_fields':
        result = await handleGetFields(session, args);
        break;
      case 'odoo_get_model_metadata':
        result = await handleGetModelMetadata(session, args);
        break;
      case 'odoo_generate_types':
        result = await handleGenerateTypes(session, args);
        break;

      default:
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: {
                  code: 'UNKNOWN_TOOL',
                  message: `Unknown tool: ${name}`,
                },
              }),
            },
          ],
        };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  });
}

export {
  handleAuthenticate,
  handleLogout,
  handleConnectionStatus,
  connectionToolDefinitions,
} from './connection.js';

export {
  handleSearch,
  handleRead,
  handleSearchRead,
  handleCreate,
  handleWrite,
  handleUnlink,
  handleCall,
  crudToolDefinitions,
} from './crud.js';

export {
  handleModuleInstall,
  handleModuleUninstall,
  handleModuleUpgrade,
  handleModuleList,
  handleModuleInfo,
  moduleToolDefinitions,
} from './modules.js';

export {
  handleGetModels,
  handleGetFields,
  handleGetModelMetadata,
  handleGenerateTypes,
  introspectionToolDefinitions,
} from './introspection.js';
