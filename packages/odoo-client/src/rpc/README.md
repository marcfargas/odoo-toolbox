# RPC

This directory contains the RPC transport implementations for communicating with Odoo.

## Planned Contents

- **json-rpc.ts**: JSON-RPC transport implementation
- **xml-rpc.ts**: XML-RPC transport implementation
- **types.ts**: Request/response types for RPC calls
- **errors.ts**: RPC-specific error classes

## Implementation Notes

- JSON-RPC is the primary transport (simpler, modern)
- XML-RPC provided as alternative for older Odoo versions
- Both should share common authentication flow
- Handle connection keep-alive and session management
- Proper error parsing for Odoo-specific error responses
