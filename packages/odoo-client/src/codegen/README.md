# Code Generation

This directory contains the TypeScript code generator that creates typed interfaces from Odoo model metadata.

## Planned Contents

- **generator.ts**: Main code generation logic
  - Generate TypeScript interfaces from model metadata
  - Handle field type mapping (Odoo → TypeScript)
  - Generate helper types (Many2One, One2Many, Many2Many)
  - Sanitize names and handle conflicts
- **type-mappers.ts**: Map Odoo field types to TypeScript types
- **templates.ts**: Code templates for generated files
- **formatter.ts**: Format generated TypeScript code

## Field Type Mapping

| Odoo Type | TypeScript Type |
|-----------|----------------|
| char, text | string |
| integer, float | number |
| boolean | boolean |
| date, datetime | string (ISO) or Date |
| many2one | number \| [number, string] |
| one2many, many2many | number[] |
| selection | string (or union of literals) |

## Implementation Notes

- Generate one interface per model
- Add JSDoc comments from field help text
- Handle required vs optional fields
- Create index file with all exports
- CLI command for running generation
