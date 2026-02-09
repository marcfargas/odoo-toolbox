# @marcfargas/odoo-introspection

TypeScript introspection and code generation for Odoo models.

## Features

- **Runtime Introspection**: Query Odoo's `ir.model` and `ir.model.fields` to discover models and their schemas
- **Type Generation**: Automatically generate TypeScript interfaces from live Odoo metadata
- **Field Type Mapping**: Intelligent mapping of Odoo field types to TypeScript types
- **Caching**: Built-in caching to minimize RPC calls
- **CLI Tool**: Command-line tool for easy code generation

## Installation

```bash
npm install @marcfargas/odoo-introspection @marcfargas/odoo-client
```

**Prerequisites**: Node.js ≥ 18, a running Odoo v17 instance.

## Quick Start

### Programmatic Usage

```typescript
import { createClient } from '@marcfargas/odoo-client';
import { Introspector } from '@marcfargas/odoo-introspection';

// Reads ODOO_URL, ODOO_DB, ODOO_USER, ODOO_PASSWORD from env
const client = await createClient();

// Create introspector
const introspector = new Introspector(client);

// Get all models
const models = await introspector.getModels();
console.log(models.map(m => m.model)); // ['res.partner', 'sale.order', ...]

// Get fields for a model
const fields = await introspector.getFields('res.partner');

// Get complete metadata
const metadata = await introspector.getModelMetadata('res.partner');
console.log(metadata.model.name);    // 'Contact'
console.log(metadata.fields.length); // 50+
```

### CLI Usage

```bash
# Basic generation
odoo-introspect generate \
  --url http://localhost:8069 \
  --db odoo_dev \
  --password admin \
  --output src/models

# With options
odoo-introspect generate \
  --url http://localhost:8069 \
  --db odoo_dev \
  --password admin \
  --output src/models \
  --modules sale,project \
  --include-transient

# Via environment variables
export ODOO_URL=http://localhost:8069
export ODOO_DB=odoo_dev
export ODOO_PASSWORD=admin

odoo-introspect generate --output src/models
```

## API

### `Introspector` Class

#### Constructor

```typescript
new Introspector(client: OdooClient)
```

#### Methods

##### `getModels(options?)`

Retrieve all available models.

```typescript
const models = await introspector.getModels({
  includeTransient: false,  // Include wizard models
  modules: ['sale'],        // Filter by modules
  bypassCache: false        // Force fresh query
});
```

Returns: `Promise<OdooModel[]>`

##### `getFields(modelName, options?)`

Retrieve all fields for a model.

```typescript
const fields = await introspector.getFields('res.partner');
```

Returns: `Promise<OdooField[]>`

##### `getModelMetadata(modelName, options?)`

Retrieve complete metadata (model + fields).

```typescript
const metadata = await introspector.getModelMetadata('res.partner');
```

Returns: `Promise<ModelMetadata>`

##### `clearCache()`

Clear all cached introspection data.

```typescript
introspector.clearCache();
```

##### `clearModelCache(modelName)`

Clear cached data for a specific model.

```typescript
introspector.clearModelCache('res.partner');
```

### `CodeGenerator` Class

Generate TypeScript interfaces from Odoo schemas.

```typescript
import { CodeGenerator } from '@marcfargas/odoo-introspection';

const generator = new CodeGenerator(client);

const code = await generator.generate({
  outputDir: './src/models',
  includeTransient: false,
  modules: undefined,
  bypassCache: false
});
```

## Generated Code

The code generator produces TypeScript interfaces like:

```typescript
/**
 * Contact
 * 
 * Odoo Model: res.partner
 */
export interface ResPartner {
  /**
   * Name
   * @required
   */
  name: string;

  /**
   * Email
   */
  email?: string;

  /**
   * Customer
   */
  customer: boolean;

  // ... more fields
}
```

## Type Mapping

Odoo field types are mapped to TypeScript as follows:

| Odoo Type | TypeScript Type |
|-----------|-----------------|
| `char`, `text`, `html` | `string` |
| `integer` | `number` |
| `float`, `monetary` | `number` |
| `boolean` | `boolean` |
| `date`, `datetime` | `string` (ISO 8601) |
| `many2one` | `number` |
| `one2many`, `many2many` | `number[]` |
| `selection` | `string` |
| `binary` | `string` |

## Caching

Introspection results are cached in memory to minimize RPC overhead. Cache is automatically managed:

- Models are cached after the first `getModels()` call
- Fields are cached per-model after each `getFields()` call
- Combined metadata is cached after `getModelMetadata()` calls

Use `bypassCache: true` to force a fresh query, or call `clearCache()` to reset all caches.

## Logging

This package uses the `debug` library for logging. Enable debug output:

```bash
# All odoo-toolbox logging
DEBUG=odoo-* npm run test

# Only introspection logging
DEBUG=odoo-introspection:* npm run test

# Specific modules
DEBUG=odoo-introspection:introspection,odoo-introspection:codegen npm run test
```

## Tested Examples

For comprehensive, tested examples of introspection patterns and model discovery, see the [knowledge modules](../../skills/odoo/base/introspection.md).

## Related Packages

- [@marcfargas/odoo-client](../odoo-client) — RPC client
- [@marcfargas/odoo-state-manager](../odoo-state-manager) — State management and drift detection
- [@marcfargas/create-odoo-skills](../create-skills) — CLI for scaffolding AI agent skill projects

## Bugs & Support

[GitHub Issues](https://github.com/marcfargas/odoo-toolbox/issues)

## License

LGPL-3.0 — see [LICENSE](./LICENSE)
