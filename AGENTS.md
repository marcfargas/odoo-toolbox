# Agent Instructions for odoo-toolbox Development

Guidelines for AI coding assistants working on the odoo-toolbox project.

## Project Overview

**odoo-toolbox** is a TypeScript monorepo that teaches AI agents to work with Odoo ERP. It provides battle-tested knowledge modules, a TypeScript RPC client, schema introspection, and (experimentally) infrastructure-as-code state management.

## Odoo Knowledge Base

The `skills/` directory contains **5,200+ lines of tested Odoo reference documentation** (CC-BY-4.0). Code examples are validated against real Odoo v17 in CI.

**Before implementing any Odoo-specific code, read the relevant skill module:**

| When working on... | Read |
|---------------------|------|
| RPC / authentication | `skills/base/connection.md` |
| Field handling | `skills/base/field-types.md` |
| Properties (dynamic fields) | `skills/base/properties.md` |
| Query filters | `skills/base/domains.md` |
| CRUD operations | `skills/base/crud.md` |
| Search patterns | `skills/base/search.md` |
| Schema discovery | `skills/base/introspection.md` |
| Module management | `skills/base/modules.md` |
| Writing new skills | `skills/base/skill-generation.md` |

Mail system: `skills/mail/{chatter,activities,discuss}.md`
Module-specific: `skills/modules/timesheets.md`, `skills/oca/mis-builder.md`

## Package Architecture

| Package | Responsibility | Status |
|---------|----------------|--------|
| `@odoo-toolbox/client` | RPC client, business logic, services | Active |
| `@odoo-toolbox/introspection` | Schema discovery, TypeScript codegen | Active |
| `@odoo-toolbox/create-skills` | CLI to scaffold skill projects (reads from `skills/`) | Active |
| `@odoo-toolbox/state-manager` | Drift detection, plan/apply workflow | Experimental |

### When Adding New Functionality

1. **Business logic** → `odoo-client` (services for mail, activities, properties, modules, etc.)
2. **Schema/type generation** → `odoo-introspection`
3. **Odoo knowledge** → `skills/` (markdown modules with testable code blocks)
4. **API consumers** (scripts, CLIs) should use client services

### Anti-patterns

- ❌ Putting business logic in scripts or CLI tools (belongs in client)
- ❌ Duplicating client utilities in other packages
- ❌ Hard-coding Odoo model knowledge outside of client services
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

- **Odoo Knowledge**: `skills/` directory (read SKILL.md for index)
- **Setup & Contributing**: [DEVELOPMENT.md](./DEVELOPMENT.md)
- **Roadmap**: [ROADMAP.md](./ROADMAP.md)
- **Odoo Source**: https://github.com/odoo/odoo/tree/17.0
- **OCA Repos**: https://github.com/OCA
