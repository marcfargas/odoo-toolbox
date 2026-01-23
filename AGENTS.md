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

### Logging Convention

Keep logging simple and consistent. Each module creates a logger using the `debug()` function with a fixed namespace pattern:

**Pattern**: `package:part` or `package:subpart`

**Examples**:
```typescript
// packages/odoo-client/src/client/odoo-client.ts
import debug from 'debug';
const log = debug('odoo-client:client');

log('Connected to Odoo at %s', url);
log('Executing RPC call: %s.%s', model, method);

// packages/odoo-client/src/rpc/transport.ts
const log = debug('odoo-client:rpc');
log('POST %s with headers', endpoint);

// packages/odoo-state-manager/src/plan/index.ts
const log = debug('odoo-state-manager:plan');
log('Generating execution plan for %d changes', diffs.length);
```

**Guidelines**:
- Use the `debug` npm package (no custom logging wrappers)
- Namespace follows: `<package-name>:<functional-part>`
- Always use function-like format (e.g., `debug('odoo-client:client')`) - never object constructors
- Debug output is off by default; users enable with `DEBUG=odoo-client:* npm test`
- Don't log sensitive data (passwords, auth tokens)
- Use %s, %d, %o formatting instead of string concatenation

### Documenting Odoo Source References

**CRITICAL**: When implementing Odoo-specific behavior, context handling, or quirks, ALWAYS reference the corresponding Odoo source code.

**Why this matters**:
- Odoo's behavior is often undocumented or poorly documented
- Context variables can be cryptic and their origin non-obvious
- Future maintainers need to understand WHY code exists
- Links to source code provide authoritative answers

**How to document references**:

```typescript
// ✅ GOOD: References the actual Odoo source
/**
 * Set default activity type when creating activities.
 * 
 * Context variable handled in:
 * - addons/mail/models/mail_activity.py:_default_activity_type_id()
 * - Used by mail.activity model to pre-select activity types
 * 
 * @see https://github.com/odoo/odoo/blob/17.0/addons/mail/models/mail_activity.py#L123
 */
context.default_activity_type_id = activityTypeId;

// ❌ BAD: No context about where this is used
context.default_activity_type_id = activityTypeId;
```

```typescript
// ✅ GOOD: Explains Odoo quirk with source reference
/**
 * Odoo returns many2one fields as [id, display_name] tuples in read() operations.
 * However, in create/write operations, you pass just the ID.
 * 
 * Handled in:
 * - odoo/fields.py:Many2one.convert_to_read()
 * - odoo/fields.py:Many2one.convert_to_write()
 * 
 * @see https://github.com/odoo/odoo/blob/17.0/odoo/fields.py#L2156
 */
function normalizeMany2One(value: number | [number, string]): number {
  return Array.isArray(value) ? value[0] : value;
}

// ❌ BAD: Implementation without explanation
function normalizeMany2One(value: number | [number, string]): number {
  return Array.isArray(value) ? value[0] : value;
}
```

**Common Odoo modules to reference**:
- `addons/mail/` - Activity management, followers, messaging (many context vars!)
- `addons/project/` - Project and task management
- `odoo/models.py` - Base model behavior, ORM
- `odoo/fields.py` - Field type definitions and conversions
- `odoo/api.py` - Decorators and API behavior
- `addons/base/` - Core models (res.users, res.partner, ir.model, etc.)

**OCA Module References**:
When working with OCA modules, reference both:
- Core Odoo: https://github.com/odoo/odoo/tree/17.0
- OCA Modules: https://github.com/OCA (e.g., project, server-tools, web, etc.)

**Context variable documentation template**:
```typescript
/**
 * [Brief description of what this context variable does]
 * 
 * Handled in: [Odoo module/file path and function/method]
 * Effect: [What happens when this is set]
 * 
 * @see [GitHub link to exact line in Odoo source]
 */
context.variable_name = value;
```

**When you don't know the source**:
If you implement something based on observed behavior but can't find the source:
```typescript
/**
 * [Description of behavior]
 * 
 * Note: Observed behavior in Odoo v17, source location TBD.
 * TODO: Find and document corresponding Odoo source code.
 */
```

This helps future contributors know what needs investigation.

### When Writing Code

1. **Use Descriptive Types**: Prefer explicit interfaces over `any`
2. **Handle Odoo Quirks**: Odoo returns `[id, display_name]` for many2one, handle gracefully
3. **Context Matters**: Odoo heavily uses `context` parameter - make it first-class
4. **Error Messages**: Odoo errors can be cryptic - add helpful wrapping
5. **Batching**: Odoo prefers batch operations - design for it
6. **Document Odoo Sources**: Reference actual Odoo code when implementing quirks/context handling

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
# Common context keys - see addons/base and addons/mail for usage
{
  'lang': 'en_US',                    # base/models/res_lang.py
  'tz': 'Europe/Madrid',              # base/models/res_users.py
  'uid': 1,                           # Always present, current user ID
  'allowed_company_ids': [1],         # base/models/res_company.py - multi-company
  'active_test': True,                # Filter active records (default True)
  'default_*': 'value',               # Set default values for fields
  'mail_activity_quick_update': True, # mail/models/mail_activity.py
  'tracking_disable': True,           # Disable field tracking/audit
}
```

**Odoo Domain Filters**:
```python
# See odoo/osv/expression.py for domain evaluation logic
[
  ('name', '=', 'Project Alpha'),    # Exact match
  ('active', '=', True),              # Boolean
  ('user_id', 'in', [1, 2, 3]),      # List membership
  ('create_date', '>=', '2024-01-01'), # Date comparison
  '|',                                # OR operator (prefix notation)
  ('state', '=', 'done'),
  ('state', '=', 'cancelled'),
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

### Test Infrastructure Guidelines

**CRITICAL - Test Helper Location:**
- Test helpers belong in `tests/helpers/`, NOT `test/` (singular)
- The project uses `tests/` (plural) for all test-related code
- If you accidentally create files in `test/`, immediately move them to `tests/helpers/` and delete the `test/` directory

**Docker Test Environment Philosophy:**
- Let Docker images handle their own initialization - don't build workarounds in test code
- Fix issues at the source (docker-compose.test.yml) rather than working around them in helpers
- Odoo auto-initializes its database via `--init base` command in docker-compose
- Postgres uses hardcoded defaults: `admin/admin` credentials, `postgres` database
- Global setup simply starts containers with `docker-compose up -d --wait`
- Docker healthchecks ensure services are ready; no manual polling needed
- If tests fail due to infrastructure, fix docker-compose.test.yml, not the test helpers

**Debugging Test Infrastructure:**
- Check `docker-compose logs odoo` to see Odoo initialization messages
- Odoo logs "HTTP service (werkzeug) running on..." when ready
- Healthcheck `/web/health` confirms Odoo can serve HTTP requests
- If database issues persist, verify Odoo command includes `--init base`

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

### Context Variable Pattern
```typescript
/**
 * Example of well-documented context usage
 */
interface ActivityContext {
  /**
   * Pre-select activity type when creating activities.
   * Handled in: addons/mail/models/mail_activity.py:_default_activity_type_id()
   */
  default_activity_type_id?: number;
  
  /**
   * Quick update mode for activities (skips some validations).
   * Handled in: addons/mail/models/mail_activity.py:write()
   * Effect: Bypasses onchange methods for faster bulk updates
   */
  mail_activity_quick_update?: boolean;
  
  /**
   * Disable tracking/audit trail for this operation.
   * Handled in: odoo/models.py:BaseModel._write()
   * Effect: Changes won't appear in chatter/activity log
   */
  tracking_disable?: boolean;
}
```

## Getting Help

- **Odoo Community (OCA) Documentation**: https://odoo-community.org/
- **Odoo Source Code**: https://github.com/odoo/odoo/tree/17.0
- **OCA Repositories**: https://github.com/OCA (primary focus)
- **OCA Guidelines**: https://github.com/OCA/odoo-community.org
- **Odoo Official Documentation**: https://www.odoo.com/documentation/17.0/
- **This Project's Issues**: (TBD - will be on GitHub)

**Note**: This project focuses on **Odoo Community Edition with OCA modules**. While it should work with Enterprise Edition, testing and development prioritizes the OCA ecosystem.

## Questions to Ask

When implementing features, consider:
1. How does this handle Odoo's relational fields?
2. Does this work with custom fields added by users?
3. Can this batch multiple operations?
4. How does context affect this operation?
5. What errors could Odoo return here?
6. **Where in Odoo source code is this behavior defined?**

## Anti-Patterns to Avoid

- ❌ Assuming Odoo models are static (they're dynamic!)
- ❌ Ignoring context parameter
- ❌ Making sequential RPC calls when batching is possible
- ❌ Hardcoding field names (generate from schema!)
- ❌ Treating all fields equally (computed/readonly vs writable)
- ❌ **Implementing Odoo quirks without documenting the source**
- ❌ **Using context variables without explaining their origin**

## Contributing

This is designed as a FOSS project. Code should be:
- Well-typed
- Tested
- Documented (especially Odoo source references!)
- Following the project's design principles

---

**Remember**: We're building developer tooling. DX (Developer Experience) is a feature.

**Pro tip**: When debugging Odoo behavior, search the Odoo GitHub repo for the model/field name or context variable. The answers are in the source code!
