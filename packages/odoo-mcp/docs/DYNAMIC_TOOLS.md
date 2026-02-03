# Dynamic Module-Specific MCP Tools

This document describes the dynamic tool registration system implemented in `odoo-mcp`, which enables MCP tools to be registered and unregistered based on installed Odoo modules.

## Overview

The `DynamicToolRegistry` class provides infrastructure for:
- **Dynamic tool registration**: Add/remove tools at runtime
- **Module tracking**: Associate tools with Odoo modules
- **Client notifications**: Automatically notify MCP clients when tool list changes
- **Handler management**: Map tool names to handler functions

## Architecture

### Key Components

1. **DynamicToolRegistry** (`src/tools/registry.ts`)
   - Manages tool definitions and handlers
   - Tracks module dependencies
   - Sends MCP notifications via `sendToolListChanged()`

2. **ModuleToolConfig** interface
   - Defines a set of tools for a specific module
   - Specifies required Odoo modules
   - Maps tool names to handler functions

3. **Tool Registration** (`src/tools/index.ts`)
   - Core tools always registered (connection, CRUD, introspection, etc.)
   - Module-specific tools can be conditionally registered

## Usage

### Registering Module Tools

```typescript
import { DynamicToolRegistry, ModuleToolConfig } from './tools/registry.js';

// Create a module tool configuration
const saleTools: ModuleToolConfig = {
  moduleName: 'sale',
  requiredModules: ['sale'],
  tools: [
    {
      name: 'odoo_sale_create_quotation',
      description: 'Create a sales quotation',
      inputSchema: {
        type: 'object',
        properties: {
          partner_id: { type: 'number' },
        },
        required: ['partner_id'],
      },
    },
  ],
  handlers: new Map([
    ['odoo_sale_create_quotation', async (session, args) => {
      const client = session.getClient();
      // Implementation here
      return { success: true };
    }],
  ]),
};

// Register the tools
registry.register(saleTools);

// Notify clients (if server is set)
await registry.notifyToolListChanged();
```

### Unregistering Module Tools

```typescript
// When a module is uninstalled
registry.unregister('sale');
await registry.notifyToolListChanged();
```

### Querying Registry

```typescript
// Get all registered tools
const tools = registry.getTools();

// Check if a module is registered
const hasSale = registry.hasModule('sale');

// Check if a tool exists
const hasTool = registry.hasTool('odoo_sale_create_quotation');

// Get handler for a tool
const handler = registry.getHandler('odoo_sale_create_quotation');

// Get statistics
const stats = registry.getStats();
// { moduleCount: 7, toolCount: 35, handlerCount: 35 }
```

## Current Tool Organization

Tools are organized by module dependency:

| Module Category | Module Name | Required Odoo Modules | Tools |
|----------------|-------------|----------------------|-------|
| Core | `core-connection` | None | authenticate, logout, connection_status |
| Core | `core-crud` | None | search, read, search_read, create, write, unlink, call |
| Core | `core-modules` | None | module_install, module_uninstall, module_upgrade, module_list, module_info |
| Core | `core-introspection` | None | get_models, get_fields, get_model_metadata, generate_types |
| Core | `core-properties` | None | read_properties, update_properties, find_properties_field, get_property_definitions, set_property_definitions |
| Module | `mail` | `mail` | post_internal_note, post_public_message, get_messages, manage_followers, add_attachment, schedule_activity, complete_activity, get_activities, channel_message, list_channels |

## Adding New Module-Specific Tools

### Step 1: Create Tool Configuration

Create a new file (e.g., `src/tools/sale-tools.ts`):

```typescript
import { ModuleToolConfig } from './registry.js';
import { SessionManager } from '../session/index.js';

export const saleToolDefinitions: ModuleToolConfig = {
  moduleName: 'sale',
  requiredModules: ['sale'],
  tools: [
    // Tool definitions...
  ],
  handlers: new Map([
    // Handler implementations...
  ]),
};
```

### Step 2: Integrate with Module Lifecycle

Hook into module installation/uninstallation events:

```typescript
// In tools/modules.ts or similar
export async function handleModuleInstall(session, input) {
  // ... existing code ...
  
  const moduleName = params.moduleName;
  
  // After successful installation
  if (moduleName === 'sale') {
    registry.register(saleToolDefinitions);
    await registry.notifyToolListChanged();
  }
  
  return { success: true, module };
}

export async function handleModuleUninstall(session, input) {
  // ... existing code ...
  
  const moduleName = params.moduleName;
  
  // After successful uninstallation
  if (moduleName === 'sale') {
    registry.unregister('sale');
    await registry.notifyToolListChanged();
  }
  
  return { success: true, module };
}
```

### Step 3: Optional - Discover at Connection

Alternatively, query installed modules on authentication and register tools automatically:

```typescript
// In tools/connection.ts or server initialization
export async function handleAuthenticate(session, input) {
  // ... existing authentication ...
  
  // Query installed modules
  const client = session.getClient();
  const modules = await client.searchRead(
    'ir.module.module',
    [['state', '=', 'installed']],
    { fields: ['name'] }
  );
  
  const installedModules = new Set(modules.map(m => m.name));
  
  // Register module-specific tools
  if (installedModules.has('sale')) {
    registry.register(saleToolDefinitions);
  }
  if (installedModules.has('project')) {
    registry.register(projectToolDefinitions);
  }
  // ... etc ...
  
  await registry.notifyToolListChanged();
  
  return { success: true, uid: result.uid };
}
```

## MCP Protocol Support

The implementation fully leverages MCP's dynamic tool capabilities:

- ✅ **Dynamic registration**: Tools can be added/removed at runtime
- ✅ **Client notifications**: Clients automatically receive `notifications/tools/list_changed`
- ✅ **Fresh tool lists**: Each `tools/list` request returns current tools from registry
- ✅ **Handler dispatch**: Map-based lookup replaces switch statement

## Example Workflows

### Workflow 1: Module Installation Triggers Tool Registration

1. User calls `odoo_module_install` with `moduleName: 'sale'`
2. Module is installed in Odoo
3. Handler detects 'sale' was installed
4. `registry.register(saleTools)` is called
5. `registry.notifyToolListChanged()` sends notification to clients
6. MCP clients refresh their tool lists
7. New sale-specific tools appear in client

### Workflow 2: Auto-Discovery on Authentication

1. User calls `odoo_authenticate`
2. After authentication, query `ir.module.module` for installed modules
3. For each installed module with tool configs, call `registry.register()`
4. `registry.notifyToolListChanged()` informs clients
5. Client sees all relevant tools immediately

## Testing

The registry is fully tested with 18 comprehensive test cases covering:

- Tool registration and unregistration
- Module tracking and queries
- Handler management
- MCP notification integration
- Statistics and introspection

See `tests/tools/registry.test.ts` for examples.

## Benefits

1. **Relevance**: Only show tools for installed modules
2. **Discoverability**: Clients see exactly what's available
3. **Extensibility**: Add new module tools without core changes
4. **Consistency**: Match skill files pattern
5. **Performance**: Smaller tool list for focused instances
6. **Type Safety**: Full TypeScript support throughout

## Future Enhancements

Potential additions (not required for basic functionality):

1. **Permission checking**: Filter tools based on user permissions
2. **Module caching**: Cache installed modules to avoid repeated queries
3. **Tool metadata**: Add version, deprecation, or feature flags
4. **Hot reload**: Detect module changes and update tools automatically
5. **Tool groups**: Organize related tools into logical groups

## References

- MCP Protocol Spec: https://spec.modelcontextprotocol.io/
- MCP SDK: https://github.com/modelcontextprotocol/typescript-sdk
- Odoo Module System: https://www.odoo.com/documentation/17.0/developer/reference/backend/module.html
