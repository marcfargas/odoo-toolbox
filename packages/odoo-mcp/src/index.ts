// Main exports
export {
  createOdooMcpServer,
  startServer,
  getAutoAuthConfig,
  OdooMcpServer,
  OdooMcpServerOptions,
} from './server.js';

// Session management
export { SessionManager, SessionState } from './session/index.js';

// Tools
export {
  allToolDefinitions,
  registerAllTools,
  // Connection
  handleAuthenticate,
  handleLogout,
  handleConnectionStatus,
  connectionToolDefinitions,
  // CRUD
  handleSearch,
  handleRead,
  handleSearchRead,
  handleCreate,
  handleWrite,
  handleUnlink,
  handleCall,
  crudToolDefinitions,
  // Modules
  handleModuleInstall,
  handleModuleUninstall,
  handleModuleUpgrade,
  handleModuleList,
  handleModuleInfo,
  moduleToolDefinitions,
  // Introspection
  handleGetModels,
  handleGetFields,
  handleGetModelMetadata,
  handleGenerateTypes,
  introspectionToolDefinitions,
  // Mail
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
  // Properties
  handleReadProperties,
  handleUpdateProperties,
  handleFindPropertiesField,
  handleGetPropertyDefinitions,
  handleSetPropertyDefinitions,
  propertiesToolDefinitions,
} from './tools/index.js';

// Schemas
export * from './schemas/index.js';

// Utils
export {
  formatError,
  isErrorResponse,
  McpError,
  McpErrorCode,
  McpErrorResponse,
} from './utils/index.js';
