# Agent Instructions for odoo-toolbox Development

This document provides context and guidelines for AI coding assistants (GitHub Copilot, Claude Code, etc.) working on the odoo-toolbox project.

## Project Overview

**odoo-toolbox** is a TypeScript monorepo providing infrastructure-as-code capabilities for Odoo ERP. Think "Terraform for Odoo" - it enables typed interaction with Odoo and declarative state management with drift detection and plan/apply workflows.

### Core Packages

1. **odoo-client**: RPC client with schema introspection and TypeScript code generation
2. **odoo-state-manager**: Drift detection and plan/apply orchestration for Odoo resources

## Design Principles

- **Batteries-included**: Prefer comprehensive solutions over minimal abstractions
- **Type Safety**: Leverage TypeScript fully - generate types from live Odoo schemas
- **Minimize Complexity**: Avoid directory explosion, colocate related code
- **Pragmatic Choices**: Choose practical solutions over theoretical perfection
- **FOSS First**: This is designed to be a standalone open-source project

## Key Architectural Decisions

### Type Generation Philosophy
We generate TypeScript types by introspecting live Odoo instances via `ir.model` and `ir.model.fields`. This gives users a typed client that reflects THEIR Odoo reality (including custom fields, modules, versions).

```typescript
// After generation, users get:
import { ProjectProject, ProjectTask } from './generated/models';

const desiredState: ProjectProject = {
  name: "Q1 Planning",
  task_ids: [{ name: "Research" }]
};
```

### State Management Pattern
Similar to Terraform:
1. Define desired state using generated types
2. Read current state from Odoo
3. Compare to detect drift
4. Generate execution plan
5. Apply changes atomically

### Technology Choices
- **TypeScript**: Full type safety, great DX
- **JSON-RPC/XML-RPC**: Odoo v17 standard protocols
- **Monorepo**: Using npm/pnpm workspaces (TBD)
- **Testing**: Against real Odoo instances in CI

## Implementation Guidelines

### When Writing Code

1. **Use Descriptive Types**: Prefer explicit interfaces over `any`
2. **Handle Odoo Quirks**: Odoo returns `[id, display_name]` for many2one, handle gracefully
3. **Context Matters**: Odoo heavily uses `context` parameter - make it first-class
4. **Error Messages**: Odoo errors can be cryptic - add helpful wrapping
5. **Batching**: Odoo prefers batch operations - design for it

### Code Organization

- Keep related functionality colocated
- Small helper functions/types can live in the same file
- Only create new files when there's clear separation of concerns
- Avoid one-component-per-file unless there's good reason

### Odoo-Specific Knowledge

**Field Types to TypeScript Mapping**:
- `char`, `text` → `string`
- `integer`, `float` → `number`
- `boolean` → `boolean`
- `date`, `datetime` → `string` (ISO format) or `Date`
- `many2one` → `number | [number, string]` (id or [id, name])
- `one2many`, `many2many` → `number[]`
- `selection` → `string` (could be union of literals)

**Odoo Context Examples**:
```python
# Common context keys
{
  'lang': 'en_US',           # Language
  'tz': 'Europe/Madrid',     # Timezone
  'uid': 1,                  # User ID
  'allowed_company_ids': [1] # Multi-company
}
```

**Odoo Domain Filters**:
```python
[
  ('name', '=', 'Project Alpha'),
  ('active', '=', True),
  ('user_id', 'in', [1, 2, 3])
]
```

## Current Development Phase

We are in **initial implementation** phase:
- Setting up monorepo structure
- Building basic RPC client
- Implementing model introspection
- Creating code generator
- Establishing testing patterns

See `TODO.md` for specific tasks ready to implement.
See `ROADMAP.md` for future design decisions.

## Testing Approach

- **Unit Tests**: For pure logic (comparisons, transformations)
- **Integration Tests**: Against real Odoo instance
- **Fixtures**: Record/replay RPC calls for deterministic tests
- **CI**: Need to design CI/CD with Odoo containers (see ROADMAP)

## Common Patterns

### RPC Call Pattern
```typescript
// Always include error handling and context support
async function call(
  model: string,
  method: string,
  args: any[],
  context?: Record<string, any>
): Promise<any> {
  try {
    const result = await rpc({
      model,
      method,
      args,
      kwargs: { context: context || {} }
    });
    return result;
  } catch (error) {
    throw new OdooRpcError(`Failed to call ${model}.${method}`, error);
  }
}
```

### Drift Detection Pattern
```typescript
// Compare recursively, handle Odoo-specific types
function compareStates(desired: any, current: any): Diff {
  // Handle many2one: desired might be {name: 'X'}, current is [id, 'X']
  // Handle computed fields: ignore if not in desired
  // Handle relations: compare by ID or nested compare
}
```

## Getting Help

- **Odoo Documentation**: https://www.odoo.com/documentation/17.0/
- **OCA Guidelines**: https://github.com/OCA/odoo-community.org
- **This Project's Issues**: (TBD - will be on GitHub)

## Questions to Ask

When implementing features, consider:
1. How does this handle Odoo's relational fields?
2. Does this work with custom fields added by users?
3. Can this batch multiple operations?
4. How does context affect this operation?
5. What errors could Odoo return here?

## Anti-Patterns to Avoid

- ❌ Assuming Odoo models are static (they're dynamic!)
- ❌ Ignoring context parameter
- ❌ Making sequential RPC calls when batching is possible
- ❌ Hardcoding field names (generate from schema!)
- ❌ Treating all fields equally (computed/readonly vs writable)

## Contributing

This is designed as a FOSS project. Code should be:
- Well-typed
- Tested
- Documented
- Following the project's design principles

---

**Remember**: We're building developer tooling. DX (Developer Experience) is a feature.
