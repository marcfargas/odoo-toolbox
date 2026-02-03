import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { SessionManager } from '../session/index.js';
import { DynamicToolRegistry } from './registry.js';
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
import {
  handlePostInternalNote,
  handlePostPublicMessage,
  handleGetMessages,
  handleManageFollowers,
  handleAddAttachment,
  handleScheduleActivity,
  handleCompleteActivity,
  handleGetActivities,
  handleChannelMessage,
  handleListChannels,
  mailToolDefinitions,
} from './mail.js';
import {
  handleReadProperties,
  handleUpdateProperties,
  handleFindPropertiesField,
  handleGetPropertyDefinitions,
  handleSetPropertyDefinitions,
  propertiesToolDefinitions,
} from './properties.js';

/**
 * Legacy export for backward compatibility.
 * @deprecated Use DynamicToolRegistry instead
 */
export const allToolDefinitions = [
  ...connectionToolDefinitions,
  ...crudToolDefinitions,
  ...moduleToolDefinitions,
  ...introspectionToolDefinitions,
  ...mailToolDefinitions,
  ...propertiesToolDefinitions,
];

/**
 * Create and initialize the tool registry with core tools.
 *
 * Note: Tool definitions use 'as any' because existing tool definitions
 * use string literals ('object') instead of const assertions ("object" as const).
 * This is a known limitation of the current tool definition structure.
 * Handlers also use 'any' to avoid complex union type inference issues
 * when multiple handlers with different signatures are in the same Map.
 */
export function createToolRegistry(): DynamicToolRegistry {
  const registry = new DynamicToolRegistry();

  // Register core connection tools (always available)
  registry.register({
    moduleName: 'core-connection',
    requiredModules: [],
    tools: connectionToolDefinitions as any,
    handlers: new Map<string, any>([
      ['odoo_authenticate', handleAuthenticate],
      ['odoo_logout', handleLogout],
      ['odoo_connection_status', handleConnectionStatus],
    ]),
  });

  // Register core CRUD tools (always available)
  registry.register({
    moduleName: 'core-crud',
    requiredModules: [],
    tools: crudToolDefinitions as any,
    handlers: new Map<string, any>([
      ['odoo_search', handleSearch],
      ['odoo_read', handleRead],
      ['odoo_search_read', handleSearchRead],
      ['odoo_create', handleCreate],
      ['odoo_write', handleWrite],
      ['odoo_unlink', handleUnlink],
      ['odoo_call', handleCall],
    ]),
  });

  // Register core module tools (always available)
  registry.register({
    moduleName: 'core-modules',
    requiredModules: [],
    tools: moduleToolDefinitions as any,
    handlers: new Map<string, any>([
      ['odoo_module_install', handleModuleInstall],
      ['odoo_module_uninstall', handleModuleUninstall],
      ['odoo_module_upgrade', handleModuleUpgrade],
      ['odoo_module_list', handleModuleList],
      ['odoo_module_info', handleModuleInfo],
    ]),
  });

  // Register core introspection tools (always available)
  registry.register({
    moduleName: 'core-introspection',
    requiredModules: [],
    tools: introspectionToolDefinitions as any,
    handlers: new Map<string, any>([
      ['odoo_get_models', handleGetModels],
      ['odoo_get_fields', handleGetFields],
      ['odoo_get_model_metadata', handleGetModelMetadata],
      ['odoo_generate_types', handleGenerateTypes],
    ]),
  });

  // Register mail tools (require mail module in Odoo)
  registry.register({
    moduleName: 'mail',
    requiredModules: ['mail'],
    tools: mailToolDefinitions as any,
    handlers: new Map<string, any>([
      ['odoo_post_internal_note', handlePostInternalNote],
      ['odoo_post_public_message', handlePostPublicMessage],
      ['odoo_get_messages', handleGetMessages],
      ['odoo_manage_followers', handleManageFollowers],
      ['odoo_add_attachment', handleAddAttachment],
      ['odoo_schedule_activity', handleScheduleActivity],
      ['odoo_complete_activity', handleCompleteActivity],
      ['odoo_get_activities', handleGetActivities],
      ['odoo_channel_message', handleChannelMessage],
      ['odoo_list_channels', handleListChannels],
    ]),
  });

  // Register properties tools (always available - properties are core in Odoo 17+)
  registry.register({
    moduleName: 'core-properties',
    requiredModules: [],
    tools: propertiesToolDefinitions as any,
    handlers: new Map<string, any>([
      ['odoo_read_properties', handleReadProperties],
      ['odoo_update_properties', handleUpdateProperties],
      ['odoo_find_properties_field', handleFindPropertiesField],
      ['odoo_get_property_definitions', handleGetPropertyDefinitions],
      ['odoo_set_property_definitions', handleSetPropertyDefinitions],
    ]),
  });

  return registry;
}

export function registerAllTools(server: Server, session: SessionManager): DynamicToolRegistry {
  const registry = createToolRegistry();

  // Set the server for notifications
  registry.setServer(server);

  // Register tool list handler - returns current tools from registry
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: registry.getTools(),
    };
  });

  // Register tool call handler - uses registry for dispatch
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Look up handler in registry
    const handler = registry.getHandler(name);
    if (!handler) {
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

    // Execute handler
    const result = await handler(session, args);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  });

  return registry;
}

// Re-export registry types
export { DynamicToolRegistry, ModuleToolConfig, ToolHandler } from './registry.js';

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

export {
  handlePostInternalNote,
  handlePostPublicMessage,
  handleGetMessages,
  handleManageFollowers,
  handleAddAttachment,
  handleScheduleActivity,
  handleCompleteActivity,
  handleGetActivities,
  handleChannelMessage,
  handleListChannels,
  mailToolDefinitions,
} from './mail.js';

export {
  handleReadProperties,
  handleUpdateProperties,
  handleFindPropertiesField,
  handleGetPropertyDefinitions,
  handleSetPropertyDefinitions,
  propertiesToolDefinitions,
} from './properties.js';
