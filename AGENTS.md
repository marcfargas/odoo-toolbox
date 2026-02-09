# Agent Instructions for odoo-toolbox Development

Guidelines for AI coding assistants working on the odoo-toolbox project.

## Project Overview

**odoo-toolbox** is a TypeScript monorepo that teaches AI agents to work with Odoo ERP. It provides battle-tested knowledge modules, a TypeScript RPC client, schema introspection, and (experimentally) infrastructure-as-code state management.

## Odoo Knowledge Base

The `skills/odoo/` directory contains **5,200+ lines of tested Odoo reference documentation** (CC-BY-4.0). Code examples are validated against real Odoo v17 in CI.

**Before implementing any Odoo-specific code, read the relevant skill module:**

| When working on... | Read |
|---------------------|------|
| RPC / authentication | `skills/odoo/base/connection.md` |
| Field handling | `skills/odoo/base/field-types.md` |
| Properties (dynamic fields) | `skills/odoo/base/properties.md` |
| Query filters | `skills/odoo/base/domains.md` |
| CRUD operations | `skills/odoo/base/crud.md` |
| Search patterns | `skills/odoo/base/search.md` |
| Schema discovery | `skills/odoo/base/introspection.md` |
| Module management | `skills/odoo/base/modules.md` |
| Writing new skills | `skills/odoo/base/skill-generation.md` |

Mail system: `skills/odoo/mail/{chatter,activities,discuss}.md`
Module-specific: `skills/odoo/modules/timesheets.md`, `skills/odoo/oca/mis-builder.md`

## Package Architecture

| Package | Responsibility | Status |
|---------|----------------|--------|
| `@marcfargas/odoo-client` | RPC client, business logic, services | Active |
| `@marcfargas/odoo-introspection` | Schema discovery, TypeScript codegen | Active |
| `@marcfargas/create-odoo-skills` | CLI to scaffold skill projects (reads from `skills/odoo/`) | Active |
| `@marcfargas/odoo-state-manager` | Drift detection, plan/apply workflow | Experimental |

### When Adding New Functionality

1. **Business logic** → `odoo-client` services (`services/{module}/`)
2. **Schema/type generation** → `odoo-introspection`
3. **Odoo knowledge** → `skills/odoo/` (markdown modules with testable code blocks)
4. **API consumers** (scripts, CLIs) should use `createClient()` + service accessors

### Service Architecture (Option D: Service Accessors)

Domain-specific helpers are accessed via lazy getters on `OdooClient`:

```typescript
import { createClient } from '@marcfargas/odoo-client';

const client = await createClient();                    // reads ODOO_* env vars
await client.mail.postInternalNote('crm.lead', 42, '<p>Called.</p>');
await client.modules.isModuleInstalled('sale');
const leads = await client.searchRead('crm.lead', []); // core CRUD stays on client
```

**Rules:**
- `OdooClient` is strictly RPC/CRUD/auth/safety — no business logic
- Module helpers live in `services/{module}/` with a service class
- Each service gets a lazy getter on OdooClient (3 lines: field + getter + import)
- Standalone functions exist as implementation core and for cross-service composition
- Skill docs show `client.{module}.*` as the canonical pattern — not standalone functions

**Adding a new service:**
1. Create `services/{module}/` (service class + functions + types + index)
2. Add lazy getter in `odoo-client.ts`
3. Export from `services/index.ts`
4. Update skill docs with `client.{module}.*` examples

```
packages/odoo-client/src/
├── client/           # OdooClient, config, createClient
├── services/
│   ├── mail/         # MailService → client.mail.*
│   ├── modules/      # ModuleManager → client.modules.*
│   └── index.ts      # barrel re-exports
├── rpc/              # JSON-RPC transport
├── safety/           # safety guards
└── types/            # errors, properties
```

### Anti-patterns

- ❌ Putting business logic on OdooClient (belongs in services/)
- ❌ Putting business logic in scripts or CLI tools (belongs in client services)
- ❌ Duplicating client utilities in other packages
- ❌ Hard-coding Odoo model knowledge outside of client services
- ❌ Showing `new OdooClient({url, db, ...})` in skill docs (use `createClient()`)
- ❌ Assuming Odoo models are static (they're dynamic!)
- ❌ Ignoring context parameter
- ❌ Making sequential RPC calls when batching is possible
- ❌ Implementing Odoo quirks without documenting the source
- ❌ Using context variables without explaining their origin

## Design Principles

- **Batteries-included**: Comprehensive solutions over minimal abstractions
- **Type Safety**: Leverage TypeScript fully — generate types from live schemas
- **Minimize Complexity**: Colocate related code, avoid directory explosion
- **Pragmatic Choices**: Practical solutions over theoretical perfection
- **FOSS First**: Standalone open-source project (LGPL-3.0 code, CC-BY-4.0 skills)

## Coding Conventions

### Logging

Use the `debug` npm package. Namespace: `<package-name>:<functional-part>`.

```typescript
import debug from 'debug';
const log = debug('odoo-client:rpc');
log('POST %s with %d args', endpoint, args.length);
```

- Debug output off by default; enable with `DEBUG=odoo-client:* npm test`
- Never log sensitive data (passwords, auth tokens)
- Use `%s`, `%d`, `%o` formatting, not string concatenation

### Documenting Odoo Source References

**CRITICAL**: When implementing Odoo-specific behavior, ALWAYS reference the Odoo source code.

```typescript
// ✅ GOOD
/**
 * Odoo returns many2one fields as [id, display_name] tuples in read().
 * In create/write, you pass just the ID.
 *
 * @see https://github.com/odoo/odoo/blob/17.0/odoo/fields.py#L2156
 */

// ❌ BAD: Implementation without explanation
```

**Common Odoo source locations**:
- `addons/mail/` — messaging, activities, followers
- `addons/project/` — projects and tasks
- `odoo/models.py` — base ORM behavior
- `odoo/fields.py` — field types and conversions
- `addons/base/` — core models (res.users, res.partner, ir.model)
- OCA: https://github.com/OCA

If you can't find the source, document it as observed behavior with a TODO.

### Code Organization

- Keep related functionality colocated
- Prefer explicit interfaces over `any`
- Handle Odoo quirks (many2one tuples, context) gracefully
- Wrap cryptic Odoo errors with helpful messages
- Design for batch operations

## Testing

**Order**: `npm run lint` → `npm run test:unit` → `npm run test:integration`

- Unit tests: `packages/*/tests/**/*.test.ts` (no Docker)
- Integration tests: `packages/*/tests/**/*.integration.test.ts` (needs Docker Odoo)
- Knowledge module code blocks: extracted and tested via `testable` markers in CI

See [DEVELOPMENT.md](./DEVELOPMENT.md) for Docker setup, introspection research howto, and OCA module setup.

## Resources

- **Odoo Knowledge**: `skills/odoo/` directory (read SKILL.md for index)
- **Setup & Contributing**: [DEVELOPMENT.md](./DEVELOPMENT.md)
- **Roadmap**: [ROADMAP.md](./ROADMAP.md)
- **Odoo Source**: https://github.com/odoo/odoo/tree/17.0
- **OCA Repos**: https://github.com/OCA
