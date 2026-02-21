# TypeScript Type Generation

> **Requires:** `@marcfargas/odoo-introspection` — a **separate npm package** from `@marcfargas/odoo-client`.
>
> ```bash
> npm install @marcfargas/odoo-introspection
> ```

Generate TypeScript interfaces from your live Odoo instance's schema, eliminating `any` types and enabling IDE autocompletion.

## How It Works

The code generator:
1. Queries `ir.model` to list all models
2. Queries `ir.model.fields` for each model
3. Maps Odoo field types to TypeScript types
4. Emits TypeScript interface declarations

Generated types reflect your **live Odoo instance** — custom fields, installed modules, and all. Run codegen again after installing modules or adding custom fields.

## `CodeGenerator` Usage

```typescript
import { createClient } from '@marcfargas/odoo-client';
import { CodeGenerator } from '@marcfargas/odoo-introspection';

const client = await createClient();
const generator = new CodeGenerator(client);

// Generate and write to disk
const code = await generator.generate({
  outputDir: './src/models',
  includeTransient: false,    // skip wizard models (default)
  modules: ['sale', 'project', 'crm'],  // only these modules (omit for all)
});
```

### `CodeGeneratorOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `outputDir` | `string` | `./src/models` | Output directory for `generated.ts` |
| `includeTransient` | `boolean` | `false` | Include wizard/transient models |
| `modules` | `string[]` | all | Only generate types for these modules |
| `bypassCache` | `boolean` | `false` | Force fresh introspection |

## Type Mapping

| Odoo Type | TypeScript Type | Notes |
|-----------|----------------|-------|
| `char`, `text`, `html` | `string` | |
| `integer`, `float`, `monetary` | `number` | |
| `boolean` | `boolean` | |
| `date`, `datetime` | `string` | ISO 8601 strings |
| `binary` | `string` | Base64 encoded |
| `selection` | `string` | Could be narrowed to union in custom tooling |
| `many2one` | `number \| [number, string]` | ID on write, `[id, name]` tuple on read |
| `one2many`, `many2many` | `number[]` | Array of IDs |
| `reference` | `string` | Polymorphic as `"model,id"` string |
| Unknown | `any` | Fallback |

The `many2one` type `number | [number, string]` captures the read/write asymmetry — see [Field Types](../client/field-types.md#many2one).

## Using the CLI

`@marcfargas/odoo-introspection` ships a CLI for quick code generation without writing a script:

```bash
# Generate types for all installed models
npx odoo-introspection generate

# Specific modules only
npx odoo-introspection generate --modules sale,project,crm

# Custom output directory
npx odoo-introspection generate --output-dir ./types/odoo

# See all options
npx odoo-introspection generate --help
```

## Example Generated Output

For `res.partner`, the generator produces something like:

```typescript
/**
 * res.partner — Contact
 * Modules: base, mail, account, ...
 */
export interface ResPartner {
  id: number;
  name: string;
  email: string | false;
  phone: string | false;
  is_company: boolean;
  active: boolean;
  parent_id: number | [number, string] | false;
  child_ids: number[];
  category_id: number[];
  type: string;
  street: string | false;
  city: string | false;
  country_id: number | [number, string] | false;
  create_date: string;
  write_date: string;
  // ... many more fields
}
```

## Using Generated Types

```typescript
import type { ResPartner } from './src/models/generated';
import { createClient } from '@marcfargas/odoo-client';

const client = await createClient();

const partners = await client.searchRead<ResPartner>('res.partner', [
  ['is_company', '=', true],
], {
  fields: ['name', 'email', 'is_company'],
  limit: 10,
});

// Full TypeScript autocompletion and type checking
for (const partner of partners) {
  console.log(partner.name);           // string
  console.log(partner.email);          // string | false
  console.log(partner.is_company);     // boolean
}
```

## Programmatic Introspection Without Codegen

If you need schema information at runtime (not at build time), use the `Introspector` class directly:

```typescript
import { Introspector } from '@marcfargas/odoo-introspection';

const introspector = new Introspector(client);

// Dynamically discover required fields before creating a record
const fields = await introspector.getFields('project.task');
const required = fields.filter(f => f.required && !f.readonly);
console.log('Required fields:', required.map(f => f.name));

// Validate field exists before writing
const emailField = fields.find(f => f.name === 'email');
if (!emailField) {
  throw new Error('email field not found on this model');
}
```

See [Schema Discovery](./schema-discovery.md) for the full `Introspector` API.

## Keeping Types in Sync

Generated types can become stale when:
- Odoo modules are installed or updated
- Custom fields are added through the UI
- The Odoo instance is upgraded to a new version

**Recommended workflow:**
1. Add codegen to your project scripts: `"generate:types": "odoo-introspection generate"`
2. Run it after any schema change
3. Commit the generated file to version control for stable builds
4. Run it in CI after module installs in staging

```json
{
  "scripts": {
    "generate:types": "odoo-introspection generate --modules sale,project,crm --output-dir src/types"
  }
}
```

---

See also:
- [Schema Discovery](./schema-discovery.md) — runtime model/field inspection

For agent-optimized CLI examples, see the [odoo skill](../skills/odoo/).
