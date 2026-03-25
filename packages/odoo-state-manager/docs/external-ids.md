# External IDs

Terraform-style resource addressing using Odoo's native `ir.model.data` external IDs. Each managed resource gets a stable string identifier that survives renames, re-ordering, and database migrations.

## Quick Start

```typescript
import { resource, lookup } from '@marcfargas/odoo-state-manager';

// Define a resource with an external ID
export const fiscalProject = resource('project.project', 'bgbl.fiscal_project', {
  _ref: lookup('project.project', { name: 'Declaraciones Fiscal FY' }),
  name: 'Declaraciones Fiscal FY',
});
```

On first run against an existing database:
1. External ID `bgbl.fiscal_project` is not found in `ir.model.data`
2. `_ref` lookup finds the existing record (e.g., #1004)
3. The record is **adopted** — external ID is written to `ir.model.data`

On subsequent runs:
1. External ID resolves directly to #1004 — `_ref` is never consulted
2. Fast, unambiguous, rename-proof

## API

### `resource()` with external ID

```typescript
// New overload (backwards compatible)
resource(model: string, externalId: string, definition: object): ResourceDefinition

// Original signature still works
resource(model: string, definition: object): ResourceDefinition
```

The `externalId` must follow Odoo's `module.name` convention:
- `bgbl.fiscal_project` → module=`bgbl`, name=`fiscal_project`
- `bgbl.fiscal_project.nuevo` → module=`bgbl`, name=`fiscal_project.nuevo`

### `children()` for one2many fields

```typescript
import { resource, children } from '@marcfargas/odoo-state-manager';

export const project = resource('project.project', 'bgbl.fiscal', {
  name: 'Fiscal FY',
  type_ids: children('project.task.type', [
    resource('project.task.type', 'bgbl.fiscal.nuevo', { name: 'Nuevo', sequence: 0 }),
    resource('project.task.type', 'bgbl.fiscal.done', { name: 'Done', sequence: 1 }),
  ]),
});
```

`children()` declares child resources for a one2many field. Child external IDs follow the convention of prefixing with the parent's external ID.

### `parseExternalId()`

```typescript
import { parseExternalId } from '@marcfargas/odoo-state-manager';

parseExternalId('bgbl.fiscal_project');
// → { module: 'bgbl', name: 'fiscal_project' }
```

## Resolution Pipeline

Resolution follows a 3-step fallback for each resource:

```
1. EXTERNAL ID LOOKUP
   Query ir.model.data for (module, name)
   → Found: mode = update, use that record ID
   → Not found: fall through

2. _ref LOOKUP (fallback)
   If _ref is set, run searchRead
   → Found: mode = update, mark for ADOPTION
   → Not found: fall through

3. CREATE
   No match found. mode = create.
```

External IDs are batch-fetched per module prefix for efficiency.

## Operations

### Adopt (`*`)

A one-time operation that binds an external ID to an existing record found via `_ref`. Writes to `ir.model.data`:

```
* project.project "Fiscal FY" [bgbl.fiscal_project]
    Binding external ID to existing record #1004
```

After adoption, subsequent runs resolve via external ID directly.

### Create (`+`) with external ID

When creating a new record, the external ID is automatically written to `ir.model.data` alongside the record creation:

```
+ project.project "Fiscal FY" [bgbl.fiscal_project]
    name: "Fiscal FY"
```

### Update (`~`) with external ID

Updates show the external ID for context:

```
~ project.project "Fiscal FY" [bgbl.fiscal_project]
    ~ name: "Fiscal FY" → "Fiscal FY 2026"
```

## Plan Summary

The plan summary includes adoption counts:

```
Plan: 1 to create, 1 to update, 2 to adopt.
```

## Migration Path

External IDs are additive — existing resources without them work exactly as before.

1. Add `externalId` to resource definitions
2. Optionally add `_ref` for first-run adoption against existing databases
3. First `plan` shows adopt operations
4. `apply` writes external IDs to `ir.model.data`
5. Subsequent runs resolve via external ID; `_ref` can be removed later

## Namespace Convention

Choose a prefix that won't collide with Odoo module external IDs. Recommended: use your project/organization name (e.g., `bgbl.`, `mycompany.`).

The state manager does not enforce a prefix — any `module.name` format works.

## ir.model.data Storage

External IDs are stored in Odoo's standard `ir.model.data` table with `noupdate=true` to prevent Odoo module updates from overwriting them:

| module | name                    | model               | res_id |
|--------|-------------------------|----------------------|--------|
| bgbl   | fiscal_project          | project.project      | 1004   |
| bgbl   | fiscal_project.nuevo    | project.task.type    | 42     |

## Limitations and Caveats

### No ir.model.data cleanup on delete

When a resource is removed from the definition files and its record is unlinked/archived, the corresponding `ir.model.data` entry is **not** automatically cleaned up. Orphaned entries are harmless but accumulate over time.

### No rebinding

If an external ID already exists in `ir.model.data` pointing to a different model than declared, the resolve step throws an error. This prevents accidental rebinding.

### No adoption conflict detection

If a record found via `_ref` already has a *different* external ID in `ir.model.data` (assigned by another module or a previous state definition), the current implementation does not detect this. The new external ID will be written alongside the existing one.

### children() auto-prefixing rules

Child resources with short external IDs (no dot) are automatically prefixed with the parent's external ID. For example, a child with `'nuevo'` under a parent with `'bgbl.fiscal'` becomes `'bgbl.fiscal.nuevo'`.

Children with fully qualified external IDs (containing a dot) are left unchanged. Children without external IDs are not affected. If the parent has no external ID, children keep their IDs as-is.

### External ID format validation

The only validation is that external IDs contain at least one dot. No check for valid Odoo module name characters or uniqueness against existing Odoo module external IDs.

### Batch performance

External IDs are batch-fetched by module prefix from `ir.model.data` in a single `searchRead` per unique module. For projects with many resources under the same prefix, this is efficient. Projects using many different prefixes will issue one query per prefix.
