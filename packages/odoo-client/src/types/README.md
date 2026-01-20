# Types

This directory contains common TypeScript types and helper types used throughout the client.

## Planned Contents

- **common.ts**: Common types used across modules
  - Connection config
  - Operation options
  - Domain filters
  - Context type
- **relations.ts**: Helper types for relational fields
  - `Many2One<T>`: Represents many2one field (number | [number, string] | T)
  - `One2Many<T>`: Represents one2many field (number[] | T[])
  - `Many2Many<T>`: Represents many2many field (number[] | T[])
- **errors.ts**: Error classes
  - `OdooRpcError`: Base RPC error
  - `OdooAuthError`: Authentication errors
  - `OdooValidationError`: Validation errors

## Implementation Notes

- Export all common types for use in client code
- Helper types make generated interfaces more intuitive
- Error classes include helpful context for debugging
