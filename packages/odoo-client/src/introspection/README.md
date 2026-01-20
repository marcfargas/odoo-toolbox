# Introspection

This directory contains code for introspecting Odoo schemas via ir.model and ir.model.fields.

## Planned Contents

- **introspect.ts**: Main introspection logic
  - `getModels()`: Query ir.model for available models
  - `getFields(model)`: Query ir.model.fields for model fields
  - `getModelMetadata(model)`: Combined model + fields
- **cache.ts**: In-memory caching of introspection results
- **types.ts**: TypeScript types for Odoo model metadata

## Implementation Notes

- Use RPC client to query ir.model and ir.model.fields
- Cache results to avoid repeated queries
- Handle all Odoo field types (char, text, integer, float, boolean, date, datetime, many2one, one2many, many2many, selection, etc.)
- Extract field metadata: name, type, required, relation, help text
