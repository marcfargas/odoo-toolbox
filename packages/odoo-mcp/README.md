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
