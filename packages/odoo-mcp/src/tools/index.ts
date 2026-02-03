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

export const allToolDefinitions = [
  ...connectionToolDefinitions,
  ...crudToolDefinitions,
  ...moduleToolDefinitions,
  ...introspectionToolDefinitions,
  ...mailToolDefinitions,
  ...propertiesToolDefinitions,
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

      // Mail tools
      case 'odoo_post_internal_note':
        result = await handlePostInternalNote(session, args);
        break;
      case 'odoo_post_public_message':
        result = await handlePostPublicMessage(session, args);
        break;
      case 'odoo_get_messages':
        result = await handleGetMessages(session, args);
        break;
      case 'odoo_manage_followers':
        result = await handleManageFollowers(session, args);
        break;
      case 'odoo_add_attachment':
        result = await handleAddAttachment(session, args);
        break;
      case 'odoo_schedule_activity':
        result = await handleScheduleActivity(session, args);
        break;
      case 'odoo_complete_activity':
        result = await handleCompleteActivity(session, args);
        break;
      case 'odoo_get_activities':
        result = await handleGetActivities(session, args);
        break;
      case 'odoo_channel_message':
        result = await handleChannelMessage(session, args);
        break;
      case 'odoo_list_channels':
        result = await handleListChannels(session, args);
        break;

      // Properties tools
      case 'odoo_read_properties':
        result = await handleReadProperties(session, args);
        break;
      case 'odoo_update_properties':
        result = await handleUpdateProperties(session, args);
        break;
      case 'odoo_find_properties_field':
        result = await handleFindPropertiesField(session, args);
        break;
      case 'odoo_get_property_definitions':
        result = await handleGetPropertyDefinitions(session, args);
        break;
      case 'odoo_set_property_definitions':
        result = await handleSetPropertyDefinitions(session, args);
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
