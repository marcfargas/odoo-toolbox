# @marcfargas/odoo-state-manager

Declarative state management for Odoo. Define desired state in TypeScript, detect drift, plan and apply changes — like Terraform for your Odoo instance.

## Installation

```bash
npm install @marcfargas/odoo-state-manager @marcfargas/odoo-client @marcfargas/odoo-introspection
```

**Prerequisites**: Node.js ≥ 24, a running Odoo instance.

## Quick Start

Create a project directory with `.ts` files that define your desired Odoo state:

```typescript
// modules.ts
import { resource } from '@marcfargas/odoo-state-manager';

export default ['project', 'sale', 'hr_timesheet']
  .map(name => resource('ir.module.module', { name }));
```

```typescript
// projects.ts
import { resource, lookup } from '@marcfargas/odoo-state-manager';

const marc = lookup('res.users', { email: 'marc@example.com' });

export const censos = resource('project.project', {
  _ref: lookup('project.project', { name: 'Censos' }),
  name: 'Censos',
  user_id: marc,
  type_ids: [
    resource('project.task.type', { name: 'New', sequence: 1 }),
    resource('project.task.type', { name: 'In Progress', sequence: 2 }),
    resource('project.task.type', { name: 'Done', sequence: 3, fold: true }),
  ],
  removeUnmanaged: { type_ids: true },
});
```

Then plan and apply:

```bash
export ODOO_URL=http://localhost:8069
export ODOO_DB=mydb
export ODOO_USER=admin
export ODOO_PASSWORD=admin

npx odoo-state-manager plan --dir ./myproject
npx odoo-state-manager apply --dir ./myproject
```

## DSL Reference

### `resource(model, definition)`

Declare a single managed record.

```typescript
const partner = resource('res.partner', {
  _ref: lookup('res.partner', { email: 'info@acme.com' }),
  name: 'Acme Corp',
  is_company: true,
});
```

- **`_ref`** — optional `lookup()` to bind to an existing record. Found → update, not found → create. **Without `_ref`, always creates.**
- **`removeUnmanaged`** — per-relational-field flag. On one2many: deletes unlisted children. On many2many: unlinks associations.
- Relational fields accept nested `resource()` calls.
- Collections are plain arrays — use `.map()`, `for`, spread, etc.

### `lookup(model, domain)`

Read-only reference to an existing record. Resolved at plan time.

```typescript
const marc = lookup('res.users', { email: 'marc@example.com' });
const partner = lookup('res.partner', [['name', 'ilike', 'Acme%']]);
```

- Object shorthand: `{ key: value }` → `[['key', '=', value]]`
- Raw domain: `[['field', 'op', value]]` for complex queries
- Must resolve to exactly one record (multi-match is an error)
- As `_ref`: not found → create mode. As field value: not found → error.

### Content Markers

For HTML fields, Markdown authoring, translations, and CSS injection:

```typescript
import { md, mdFile, translated, withCss, html } from '@marcfargas/odoo-state-manager';

export const template = resource('mail.template', 'mymod.welcome_email', {
  subject: translated('Bienvenido!', { en_UK: 'Welcome!' }),
  body_html: translated(
    mdFile('./templates/welcome_es.md', { css: './email.css' }),
    { en_UK: mdFile('./templates/welcome_en.md') }
  ),
});
```

- **`md(source)`** — inline Markdown, rendered to HTML at plan time
- **`mdFile(path, opts?)`** — file-based Markdown. `{ css }` inlines styles via juice. `{ inlineCss: false }` injects a `<style>` block instead.
- **`translated(default, translations?)`** — first arg is always the instance default language. Translations map: `{ lang_CODE: value }`.
- **`withCss(html, cssFile, opts?)`** — CSS injection on raw HTML
- **`html(value, opts?)`** — optional wrapper; `{ verify: false }` suppresses sanitization warnings

### `model(model, policy)`

Model-level cleanup policy. Runs after all resources are applied.

```typescript
const cleanup = model('project.task.type', { removeOrphans: true });
const archive = model('crm.stage', { archiveOrphans: true });
```

- **`removeOrphans`** — delete records not declared by any `resource()`
- **`archiveOrphans`** — set `active = false` instead (requires `active` field on the model)

## CLI

```bash
odoo-state-manager plan [--dir .]     # Show what would change (exit 0=clean, 2=changes)
odoo-state-manager apply [--dir .]    # Apply changes (shows plan, asks confirmation)
odoo-state-manager diff [--dir .]     # Detect drift (exit 0=clean, 2=drift)
odoo-state-manager init [dir]         # Scaffold a new project
```

Auth via environment variables: `ODOO_URL`, `ODOO_DB`, `ODOO_USER`, `ODOO_PASSWORD`.

## Library API

```typescript
import { plan, apply, diff, formatPlan } from '@marcfargas/odoo-state-manager';
import { createClient } from '@marcfargas/odoo-client';

const client = await createClient();

// Generate execution plan
const p = await plan({ dir: './myproject', client });
console.log(formatPlan(p));

// Apply if there are changes
if (!p.summary.isEmpty) {
  const result = await apply({ dir: './myproject', client });
  console.log(`Applied: ${result.applied}, Failed: ${result.failed}`);
}

// Detect drift
const d = await diff({ dir: './myproject', client });
console.log(d.summary.isEmpty ? 'Clean' : 'Drift detected');
```

Lower-level functions are also exported: `evaluate()`, `resolveLookups()`, `domainToTuples()`.

## How It Works

1. **Evaluate** — load `.ts` files, collect exported `resource()` and `model()` definitions
2. **Resolve** — batch-resolve all `lookup()` markers via `searchRead`
3. **Introspect** — build dependency graph, validate module requirements, fetch field metadata
4. **Transform** — render Markdown to HTML, inline CSS, extract translations, run sanitization checks
5. **Diff** — compare desired vs actual (including per-language translation diffs)
6. **Plan** — generate ordered operations with sanitization warnings
7. **Apply** — execute level by level, write translations per-language
8. **Verify** — re-run plan after apply, report any drift

## Related Packages

- [@marcfargas/odoo-client](../odoo-client) — RPC client (required dependency)
- [@marcfargas/odoo-introspection](../odoo-introspection) — Schema introspection (required dependency)
- [@marcfargas/odoo-testcontainers](../odoo-testcontainers) — Docker test environments

## License

LGPL-3.0
