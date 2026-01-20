# Code Generation

This module generates TypeScript interfaces from Odoo model metadata via introspection. It enables users to get fully typed model definitions reflecting their live Odoo instance configuration.

## Modules

### type-mappers.ts
Maps Odoo field types to TypeScript type expressions.

**Key Functions**:
- `mapFieldType(field)` - Get base TypeScript type for an Odoo field
  - Handles: char/text → string, many2one → number, one2many/many2many → number[]
  - Special types: selection → string, date/datetime → string (ISO format), binary → string
- `getFieldTypeExpression(field)` - Get full type including optional marker
  - Respects `required` attribute: required fields are non-optional, others get `| undefined`
- `isWritableField(field)` - Determine if field can be written in create/write operations
  - Excludes system fields (id, create_date, write_uid, etc.) and readonly/computed fields
- `generateFieldJSDoc(field)` - Generate JSDoc for field with description, help text, and metadata

### formatter.ts
Generates TypeScript code from introspection metadata.

**Key Functions**:
- `modelNameToInterfaceName(modelName)` - Convert Odoo model name to TypeScript interface name
  - Examples: `res.partner` → `ResPartner`, `sale.order` → `SaleOrder`, `project.task` → `ProjectTask`
- `generateModelInterface(metadata)` - Generate interface definition for a single model
  - Includes all fields with JSDoc comments
  - Adds method signatures as commented examples: search(), read(), create(), write(), unlink()
- `generateCompleteFile(allMetadata)` - Generate complete generated.ts file
  - File header with generation notice
  - All model interfaces
  - Index exports
- `generateHelperTypes()` - Generate common helper types
  - SearchOptions, ReadOptions, SearchReadOptions, CreateOptions, WriteOptions, UnlinkOptions

### generator.ts
Main orchestration for code generation workflow.

**Key Classes**:
- `CodeGenerator` - Main coordinator
  - `generate(options)` - Run full generation: introspect → map types → format → write file
  - Private `writeGeneratedFile(code, outputDir)` - Write to src/models/generated.ts

**Key Functions**:
- `generateCode(client, options)` - Convenience function for direct generation

### cli.ts
Command-line interface for code generation.

**Usage**:
```bash
npm run generate -- \
  --url http://localhost:8069 \
  --db odoo_dev \
  --password secret \
  --output src/models \
  --modules sale,project
```

**Options**:
- `--url` - Odoo instance URL (or env: ODOO_URL)
- `--db` - Database name (or env: ODOO_DB)
- `--user` - User login (env: ODOO_USER, default: admin)
- `--password` - User password (or env: ODOO_PASSWORD)
- `--output` - Output directory (default: ./src/models)
- `--include-transient` - Include transient/wizard models
- `--modules` - Filter by comma-separated module names
- `--bypass-cache` - Force fresh introspection (skip cache)
- `--help` - Show help message

## Field Type Mapping

| Odoo Type | TypeScript Type | Notes |
|-----------|----------------|-------|
| char, text | string | Text input fields |
| html | string | HTML content as string |
| integer | number | Whole numbers |
| float, monetary | number | Decimal numbers |
| boolean | boolean | True/false |
| date, datetime | string | ISO 8601 format |
| many2one | number | ID reference to related record |
| one2many | number[] | Array of related record IDs |
| many2many | number[] | Array of related record IDs |
| selection | string | Value from predefined options |
| binary | string | Base64-encoded data |

## Generated Output

Produces `src/models/generated.ts`:

```typescript
/**
 * Contact
 * ...
 */
export interface ResPartner {
  /**
   * Contact Name
   * 
   * @required
   */
  name: string;

  /**
   * Email Address
   * 
   */
  email?: string | undefined;

  /**
   * Customer
   * @relation res.partner
   */
  partner_id?: number | undefined;

  // Method signatures as comments (documentation)
  // search(domain: any[]): Promise<number[]>;
  // read(ids: number[], fields?: string[]): Promise<ResPartner[]>;
  // create(values: Partial<ResPartner>): Promise<number>;
  // write(ids: number[], values: Partial<ResPartner>): Promise<boolean>;
  // unlink(ids: number[]): Promise<boolean>;
}

export type { ResPartner };
```

## Implementation Notes

### Design Decisions

1. **Single generated.ts file**: All models exported from one file for simplicity
   - Avoids directory explosion
   - Single import statement: `import { ResPartner, SaleOrder } from './models/generated'`
   - Easy to regenerate without managing multiple files

2. **Required field handling**: Respects Odoo's `required` attribute
   - Required fields are non-optional in interface
   - Optional fields include `| undefined` union
   - Matches Odoo semantics: required fields must be set in create/write

3. **Method signatures as comments**: Not actual implementations
   - Real methods live in `OdooClient` class
   - Documentation-only (state manager will provide typed wrappers)
   - Preserves lean generated interfaces

4. **All fields included**: Even readonly/computed fields
   - Enables complete type definitions for read operations
   - Write constraints handled at application level (state manager)
   - Users can read computed fields even if they can't write them

5. **Field type mapping philosophy**:
   - `many2one` → `number` (ID): Used in create/write operations
   - Date/datetime → `string` (ISO): Ensures consistency, no timezone confusion
   - Selection → `string`: TypeScript can validate at application level

### Odoo Integration

Relies on:
- `ir.model` - Model metadata (model name, human name, description)
- `ir.model.fields` - Field metadata (type, required, readonly, help text, relations)

These are introspected via `OdooClient.introspection` module, which queries live Odoo instances to get current schema (including custom fields, module-specific fields, etc.).

### Caching

Generated types reflect your specific Odoo configuration:
- Custom fields added by modules
- Module-specific models
- Your organization's naming conventions
- Even custom modules you've developed

Cache can be bypassed with `--bypass-cache` flag.

## Future Work

### Type-Safe Domain Selectors (P2)
Generate domain builder classes for type-safe query construction:
- Per-model builders: `new ResPartnerBuilder().name('=', 'ACME').active('=', true).build()`
- Full type safety: catch field name typos, validate operators
- See ROADMAP.md for design discussion

### Selection Field Unions (P3)
Generate union types for selection fields:
- `type TaskState = 'draft' | 'progress' | 'done' | 'cancelled'`
- Type-safe selection field assignments
- Handle dynamic selections from functions

### Enhanced JSDoc (Future)
- Include Odoo field properties (default value, help text)
- Link to related models
- Add example values

