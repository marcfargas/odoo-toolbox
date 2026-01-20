# Apply

This directory contains logic for executing plans and applying changes to Odoo.

## Planned Contents

- **apply.ts**: Apply executor
  - Execute creates
  - Execute updates
  - Execute deletes
  - Respect operation order
  - Handle errors
- **executor.ts**: Low-level execution logic
  - Batch operations where possible
  - Transaction handling
  - Rollback on failure (basic)
- **dry-run.ts**: Dry-run mode (validate without changes)

## Implementation Notes

- Execute plan operations in order
- Use Odoo client for actual RPC calls
- Batch operations when possible for performance
- Dry-run mode validates without making changes
- Basic error handling and rollback
- Report progress during execution
