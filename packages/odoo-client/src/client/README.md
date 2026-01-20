# Client

This directory contains the main OdooClient class that provides high-level operations.

## Planned Contents

- **client.ts**: Main OdooClient class
  - Constructor with connection config
  - `authenticate()`: Login and get session/uid
  - `search(model, domain, options)`: Search records
  - `read(model, ids, fields)`: Read records by ID
  - `search_read(model, domain, fields, options)`: Combined search+read
  - `create(model, values)`: Create record
  - `write(model, ids, values)`: Update records
  - `unlink(model, ids)`: Delete records
  - Context support in all operations
- **config.ts**: Connection configuration types
- **operations.ts**: Operation-specific logic

## Implementation Notes

- Uses RPC transport internally
- All methods support TypeScript generics for return types
- Context can be passed to all operations
- Domain filters follow Odoo format: `[('field', 'operator', value)]`
- Proper error handling with OdooRpcError
- Support for batching where applicable
