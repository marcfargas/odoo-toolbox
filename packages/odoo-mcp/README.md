# @odoo-toolbox/mcp

MCP (Model Context Protocol) server for Odoo. Exposes Odoo operations to AI agents with reduced context overhead.

## Installation

```bash
npm install @odoo-toolbox/mcp
```

## Usage with Claude Desktop

Add to your Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "odoo": {
      "command": "npx",
      "args": ["@odoo-toolbox/mcp"],
      "env": {
        "ODOO_URL": "http://localhost:8069",
        "ODOO_DB_NAME": "odoo",
        "ODOO_DB_USER": "admin",
        "ODOO_DB_PASSWORD": "admin"
      }
    }
  }
}
```

## Available Tools

### Connection
- `odoo_authenticate` - Connect and authenticate with Odoo
- `odoo_logout` - Close connection
- `odoo_connection_status` - Check connection state

### CRUD Operations
- `odoo_search` - Search for record IDs
- `odoo_read` - Read records by ID
- `odoo_search_read` - Combined search + read
- `odoo_create` - Create record
- `odoo_write` - Update records
- `odoo_unlink` - Delete records
- `odoo_call` - Generic RPC method call

### Module Management
- `odoo_module_install` - Install module
- `odoo_module_uninstall` - Uninstall module
- `odoo_module_upgrade` - Upgrade module
- `odoo_module_list` - List modules
- `odoo_module_info` - Get module details

### Introspection
- `odoo_get_models` - List available models
- `odoo_get_fields` - Get model field definitions
- `odoo_get_model_metadata` - Get complete model + fields
- `odoo_generate_types` - Generate TypeScript interfaces

### Mail & Messaging
- `odoo_post_internal_note` - Post internal note on a record
- `odoo_post_public_message` - Post public message on a record
- `odoo_get_messages` - Get messages from chatter
- `odoo_manage_followers` - Add/remove followers
- `odoo_add_attachment` - Add attachment to a record
- `odoo_schedule_activity` - Schedule an activity
- `odoo_complete_activity` - Mark activity as done
- `odoo_get_activities` - List activities
- `odoo_channel_message` - Post to a Discuss channel
- `odoo_list_channels` - List Discuss channels

### Properties
- `odoo_read_properties` - Read dynamic properties
- `odoo_update_properties` - Update dynamic properties
- `odoo_find_properties_field` - Find properties field on a model
- `odoo_get_property_definitions` - Get property definitions
- `odoo_set_property_definitions` - Create/update property definitions

## Available Resources (Skills)

This server exposes skill documentation as MCP Resources. Skills provide detailed guidance on Odoo operations that AI agents can read on-demand.

### Resource URI Format

```
skill://{category}/{filename}
```

### Available Skills

| Category | URI | Description |
|----------|-----|-------------|
| base | `skill://base/connection.md` | Authentication and connection |
| base | `skill://base/crud.md` | CRUD operations |
| base | `skill://base/domains.md` | Domain filter syntax |
| base | `skill://base/field-types.md` | Odoo field types |
| base | `skill://base/introspection.md` | Model/field discovery |
| base | `skill://base/modules.md` | Module management |
| base | `skill://base/properties.md` | Dynamic properties |
| base | `skill://base/search.md` | Search operations |
| base | `skill://base/skill-generation.md` | Creating new skills |
| mail | `skill://mail/activities.md` | Activity management |
| mail | `skill://mail/chatter.md` | Messages and chatter |
| mail | `skill://mail/discuss.md` | Discuss integration |
| oca-modules | `skill://oca-modules/mis-builder.md` | MIS Builder reports |

### Custom Skills

For skills tailored to your specific Odoo instance, see [@odoo-toolbox/create-skills](../create-skills/).

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ODOO_URL` | Odoo server URL | - |
| `ODOO_DB_NAME` | Database name | - |
| `ODOO_DB_USER` | Username | - |
| `ODOO_DB_PASSWORD` | Password or API key | - |

If all environment variables are set, the server will auto-authenticate on startup.

## License

LGPL-3.0
