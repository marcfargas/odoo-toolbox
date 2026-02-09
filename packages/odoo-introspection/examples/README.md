# @marcfargas/odoo-introspection Examples

Practical examples demonstrating schema introspection and TypeScript code generation.

## Quick Start

Each example is a standalone TypeScript file. Run them with:

```bash
npx ts-node packages/odoo-introspection/examples/1-schema-introspection.ts
```

## Prerequisites

- Node.js 18+
- Odoo instance running with a populated schema
- Valid credentials (default: admin/admin on localhost:8069)

## Examples

### 1. Schema Introspection
**File**: [1-schema-introspection.ts](./1-schema-introspection.ts)

Learn how to:
- List all available Odoo models
- Inspect field metadata for a model
- Understand field types and properties
- Filter models by module
- Work with the schema dynamically
- Explore model relationships

**Key concepts**: Models, fields, introspection, metadata, schema discovery, field types

---

### 2. Generate TypeScript Types
**File**: [2-generate-types.ts](./2-generate-types.ts)

Learn how to:
- Use the code generator to create TypeScript interfaces
- Generate type definitions for specific models
- Export generated interfaces for use in code
- Control output directory and module filters
- Get IDE autocomplete for your Odoo models
- Create a type-safe client

**Key concepts**: Type generation, CodeGenerator, interfaces, type safety, IDE support

---

## Running in Development

If you want to run examples during development:

```bash
npm run dev -- packages/odoo-introspection/examples/1-schema-introspection.ts
```

## Integration Tests

Each example has corresponding integration tests in [../tests/examples.integration.test.ts](../tests/examples.integration.test.ts)

Run tests:

```bash
npm run test:integration
```

## Environment Variables

Configure your Odoo instance:

```bash
export ODOO_URL=http://localhost:8069
export ODOO_DB=odoo
export ODOO_USER=admin
export ODOO_PASSWORD=admin
```

## Using Generated Types

After running Example 2, you'll have a generated file like:

```typescript
// generated/models.ts
export interface ResPartner {
  id: number;
  name: string;
  email?: string;
  is_company: boolean;
  // ... all other fields ...
}
```

Use it in your code for full type safety:

```typescript
import { ResPartner } from './generated/models';

const partner: ResPartner = {
  name: 'Acme Corp',
  email: 'contact@acme.com',
  is_company: true,
};
```

## Schema Structure

The introspector gives you access to:

```typescript
const introspector = new Introspector(client);

// Get all models
const models = await introspector.getModels();

// Get fields for a model
const fields = await introspector.getFields('res.partner');

// Get combined metadata (for code generation)
const metadata = await introspector.getModelMetadata('res.partner');
// metadata.model - model info
// metadata.fields - all field definitions
```

## Field Types

The introspector recognizes Odoo field types and maps them to TypeScript:

| Odoo Type | TypeScript | Notes |
|-----------|-----------|-------|
| char, text | string | Limited vs unlimited |
| integer, float | number | - |
| boolean | boolean | - |
| date, datetime | string | ISO format or Date object |
| many2one | number \| [number, string] | ID or [ID, name] |
| one2many | number[] | List of IDs |
| many2many | number[] | List of IDs |
| selection | string | Use union types for options |

## Generating for Multiple Models

```typescript
const modelsToGenerate = [
  'res.partner',
  'sale.order',
  'sale.order.line',
  'project.project',
  'project.task'
];

const metadataList = [];
for (const modelName of modelsToGenerate) {
  try {
    const metadata = await introspector.getModelMetadata(modelName);
    metadataList.push(metadata);
  } catch (error) {
    console.warn(`Could not introspect ${modelName}`);
  }
}

const code = generateCompleteFile(metadataList);
```

## Filtering Models

```typescript
const introspector = new Introspector(client);
const models = await introspector.getModels();

// Get only sale module models
const saleModels = models.filter(m => m.model.startsWith('sale.'));

// Get only project models
const projectModels = models.filter(m => m.model.startsWith('project.'));

// Get only models without underscores (often technical models)
const userModels = models.filter(m => !m.model.includes('_'));
```

## Next Steps

1. Start with **Example 1** to explore your schema
2. Move to **Example 2** to generate TypeScript types
3. Use the generated types in your applications
4. Check out the other packages:
   - **@marcfargas/odoo-client** - RPC client for operations
   - **@marcfargas/odoo-state-manager** - State management and drift detection

## Troubleshooting

**Connection refused?**
```bash
# Start the test Odoo instance
docker-compose up
```

**No models found?**
- Ensure your user has access to ir.model
- Check that modules are installed in your Odoo instance

**Type generation too verbose?**
- Filter to specific modules instead of generating all models
- Use a whitelist of models you actually need
- Post-process the generated file to remove unwanted fields

**IDE not showing types?**
- Ensure generated file is in your TypeScript path
- Restart TypeScript server (Cmd/Ctrl + Shift + P, "TypeScript: Restart")
- Check tsconfig.json includes the generated directory
