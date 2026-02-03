# Agent Instructions for odoo-toolbox Development

This document provides context and guidelines for AI coding assistants (GitHub Copilot, Claude Code, etc.) working on the odoo-toolbox project.

## Project Overview

**odoo-toolbox** is a TypeScript monorepo providing infrastructure-as-code capabilities for Odoo ERP. Think "Terraform for Odoo" - it enables typed interaction with Odoo and declarative state management with drift detection and plan/apply workflows.

### Core Packages

1. **@odoo-toolbox/client**: Lightweight RPC client for Odoo operations
2. **@odoo-toolbox/introspection**: Schema introspection and TypeScript code generation
3. **@odoo-toolbox/state-manager**: Drift detection and plan/apply workflow

### Tested Examples and Knowledge Base

The project includes tested and validated Odoo knowledge in `packages/create-skills/assets/base/` that teaches AI agents how to interact with Odoo instances. These modules enable agents to:

1. **Connect** to any Odoo instance
2. **Introspect** the schema to discover available models and fields
3. **Generate** instance-specific skills tailored to that Odoo configuration

**Knowledge Modules:**
- `connection.md` - Authentication and session management
- `field-types.md` - Odoo type system and read/write asymmetry
- `domains.md` - Query filter syntax and composition
- `crud.md` - Create, Read, Update, Delete operations
- `search.md` - Search and filtering patterns
- `introspection.md` - Model and field discovery
- `skill-generation.md` - Creating instance-specific skills

**When to use these modules:**
- When the user asks to "connect to Odoo" or "work with Odoo"
- When generating instance-specific commands
- When learning about Odoo field behaviors (many2one asymmetry, properties)

## Design Principles

- **Batteries-included**: Prefer comprehensive solutions over minimal abstractions
- **Type Safety**: Leverage TypeScript fully - generate types from live Odoo schemas
- **Minimize Complexity**: Avoid directory explosion, colocate related code
- **Pragmatic Choices**: Choose practical solutions over theoretical perfection
- **FOSS First**: This is designed to be a standalone open-source project

## Package Architecture

### Separation of Concerns

| Package | Responsibility |
|---------|----------------|
| `@odoo-toolbox/client` | Odoo business logic, services, domain operations (mail, activities, properties, etc.) |
| `@odoo-toolbox/introspection` | Schema discovery, type generation |
| `@odoo-toolbox/state-manager` | Drift detection, plan/apply workflow |
| `@odoo-toolbox/mcp` | Thin MCP protocol adapter only |

### When Adding New Functionality

1. **Business logic** goes in `odoo-client` (services for mail, activities, properties, modules, etc.)
2. **MCP tools** are thin wrappers that delegate to client services
3. **MCP layer** handles only: input validation, error formatting, response structure

### Anti-patterns to Avoid

- ❌ Putting Odoo-specific logic directly in MCP handlers
- ❌ Duplicating client utilities in MCP layer
- ❌ Hard-coding Odoo model knowledge in protocol adapters

### Good Example

```typescript
// Business logic in odoo-client
export class MailService {
  async postInternalNote(model: string, resId: number, body: string): Promise<number> {
    // All Odoo-specific logic here (HTML wrapping, subtype selection, etc.)
  }
}

// Thin wrapper in odoo-mcp
export async function handlePostInternalNote(session, input) {
  const params = PostInternalNoteInputSchema.parse(input);
  const mailService = session.getMailService();
  const messageId = await mailService.postInternalNote(params.model, params.res_id, params.body);
  return { success: true, message_id: messageId };
}
```

See [GitHub Issue #7](https://github.com/telenieko/odoo-toolbox/issues/7) for current refactoring status.

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

### Service Layer Architecture

The `@odoo-toolbox/client` package provides two layers of abstraction:

1. **Low-level RPC Client** (`OdooClient`): Direct Odoo API access
   - Raw `call()` method for any Odoo RPC operation
   - CRUD operations: `search`, `read`, `create`, `write`, `unlink`
   - `searchRead` convenience method

2. **High-level Service Classes**: Reusable business logic
   - `MailService`: Message posting, internal notes, message history
   - `ActivityService`: Activity scheduling, completion, cancellation
   - `FollowerService`: Follower management (list, add, remove)
   - `PropertiesService`: Properties field operations with safe updates

**When to use services:**
- When building MCP servers, CLIs, or other tools that need Odoo business logic
- To avoid duplicating common Odoo patterns (message posting, activity management, etc.)
- For safe property updates that preserve unmodified values

**When to use raw RPC client:**
- For model-specific operations not covered by services
- When you need maximum flexibility
- For operations where services would add unnecessary overhead

**Example: Using services**
```typescript
import { OdooClient, MailService, ActivityService } from '@odoo-toolbox/client';

const client = new OdooClient(config);
await client.authenticate();

const mailService = new MailService(client);
const activityService = new ActivityService(client);

// Post an internal note
await mailService.postInternalNote('project.task', taskId, 'Work completed');

// Schedule a follow-up activity
await activityService.schedule('project.task', taskId, {
  activityTypeId: 'mail.mail_activity_data_call',
  summary: 'Follow up with customer',
  dateDeadline: '2025-01-15'
});
```

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
- `properties` → Read/Write asymmetry (see Properties section below)
- `properties_definition` → Array of property schemas

**Odoo Properties Fields**

Properties are user-definable dynamic fields that can be created via the Odoo web UI without modifying database structure. Common in CRM (lead_properties) and Projects (task_properties).

**Asymmetric Read/Write Format**:
```typescript
// When WRITING properties - use simple key-value object
const writeFormat = {
  custom_field: 'value',
  priority: 5,
  active: true
};

await client.write('crm.lead', leadId, {
  lead_properties: writeFormat
});

// When READING properties - Odoo returns array with full metadata
const lead = await client.read('crm.lead', leadId, ['lead_properties']);
// Returns: [
//   { name: 'custom_field', type: 'char', string: 'Custom Field', value: 'value' },
//   { name: 'priority', type: 'integer', string: 'Priority', value: 5 },
//   { name: 'active', type: 'boolean', string: 'Active', value: true }
// ]
```

**CRITICAL: Full Replacement Behavior**:
When writing properties, Odoo REPLACES all property values. Unspecified properties are set to `false`.

```typescript
// ❌ BAD - This will set other properties to false!
await client.write('crm.lead', leadId, {
  lead_properties: { priority: 10 } // Other properties become false!
});

// ✅ GOOD - Read first, modify, then write all
const lead = await client.read('crm.lead', leadId, ['lead_properties']);
const props = propertiesToWriteFormat(lead[0].lead_properties);
props.priority = 10; // Modify only what you need
await client.write('crm.lead', leadId, {
  lead_properties: props // Write ALL properties
});
```

**Allowed Property Types** (from odoo/fields.py:Properties.ALLOWED_TYPES):
- Standard: `boolean`, `integer`, `float`, `char`, `date`, `datetime`
- Relational: `many2one`, `many2many`, `selection`, `tags`
- UI: `separator` (visual organizer, no value)
- Note: `text` is NOT a valid property type (use `char` instead)

**PropertiesDefinition Structure**:
```typescript
const definition: PropertiesDefinition = [
  {
    name: 'technical_name',    // Technical identifier
    string: 'Display Label',   // Human-readable label
    type: 'char',              // Property type
  },
  {
    name: 'status',
    string: 'Status',
    type: 'selection',
    selection: [               // Required for selection type
      ['draft', 'Draft'],
      ['done', 'Done']
    ]
  },
  {
    name: 'partner_id',
    string: 'Partner',
    type: 'many2one',
    comodel: 'res.partner'     // Required for many2one/many2many
  }
];
```

**Helper Functions**:
```typescript
import { getPropertyValue, propertiesToWriteFormat } from '@odoo-toolbox/client';

// Extract single property value
const priority = getPropertyValue(lead.lead_properties, 'priority');

// Convert read format to write format
const writeFormat = propertiesToWriteFormat(lead.lead_properties);
```

**Source References**:
- Properties field: https://github.com/odoo/odoo/blob/17.0/odoo/fields.py#L3188
- PropertiesDefinition field: https://github.com/odoo/odoo/blob/17.0/odoo/fields.py#L3419
- CRM lead properties: https://github.com/odoo/odoo/blob/17.0/addons/crm/models/crm_lead.py

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

## Using Odoo Introspection for Research

**CRITICAL**: When working on Odoo-related features or investigating Odoo behavior, use the introspection tooling to query live Odoo instances. This is your primary research tool.

### Starting the Local Odoo Instance

Start the local Odoo test server before running introspection:

```bash
npm run odoo:up
```

This starts an Odoo instance at `http://localhost:8069` with default credentials (admin/admin).

### Running Introspection Examples

The introspection package includes examples you can run directly:

```bash
# Basic schema introspection - see models and fields
npx ts-node packages/odoo-introspection/examples/1-schema-introspection.ts

# Environment variables for custom Odoo instances:
ODOO_URL=http://localhost:8069 \
ODOO_DATABASE=mydb \
ODOO_USERNAME=admin \
ODOO_PASSWORD=admin \
npx ts-node packages/odoo-introspection/examples/1-schema-introspection.ts
```

### Quick Investigation Scripts

Write inline scripts to explore specific questions. Use the compiled JS for faster execution:

```bash
# Search for specific field types or patterns
node -e "
const { OdooClient } = require('./packages/odoo-client/dist');

async function main() {
  const client = new OdooClient({
    url: process.env.ODOO_URL || 'http://localhost:8069',
    database: process.env.ODOO_DATABASE || 'odoo',
    username: process.env.ODOO_USERNAME || 'admin',
    password: process.env.ODOO_PASSWORD || 'admin',
  });

  await client.authenticate();

  // Example: Search for fields containing 'properties'
  const fields = await client.searchRead(
    'ir.model.fields',
    [['name', 'ilike', 'properties']],
    { fields: ['name', 'model', 'ttype', 'field_description'] }
  );

  fields.forEach(f => {
    console.log(f.model + '.' + f.name, '(' + f.ttype + '):', f.field_description);
  });
}

main().catch(e => console.error('Error:', e.message));
"
```

### Common Investigation Patterns

**Find fields by name pattern:**
```javascript
await client.searchRead('ir.model.fields',
  [['name', 'ilike', 'pattern']],
  { fields: ['name', 'model', 'ttype', 'field_description', 'relation'] }
);
```

**List all fields for a model:**
```javascript
await client.searchRead('ir.model.fields',
  [['model', '=', 'project.task']],
  { fields: ['name', 'ttype', 'field_description', 'required', 'readonly'] }
);
```

**Check installed modules:**
```javascript
await client.searchRead('ir.module.module',
  [['state', '=', 'installed']],
  { fields: ['name', 'shortdesc'] }
);
```

**Find models from a specific module:**
```javascript
await client.searchRead('ir.model',
  [['modules', 'ilike', 'project']],
  { fields: ['model', 'name', 'info'] }
);
```

**Inspect field metadata (including selection options):**
```javascript
const fields = await client.call('ir.model.fields', 'search_read',
  [[['model', '=', 'crm.lead'], ['name', '=', 'type']]],
  { fields: ['name', 'ttype', 'selection'] }
);
```

### When to Use Introspection

1. **Before implementing Odoo-specific features**: Query the schema to understand field types, relations, and constraints
2. **When investigating unknown behavior**: Check what fields exist, their types, and relationships
3. **To verify assumptions**: Confirm field names, model structures, and module dependencies
4. **When debugging**: Check actual data structures returned by Odoo
5. **For documentation**: Discover available models and their purposes

### Introspection vs. Source Code

| Use Introspection | Use Source Code (GitHub) |
|-------------------|-------------------------|
| What fields exist on a model | How a field computes its value |
| Field types and relations | Business logic and validation |
| Installed modules | Context variable handling |
| Actual data examples | Method implementations |
| Schema of YOUR Odoo instance | Default Odoo behavior |

**Best practice**: Start with introspection to understand the schema, then dive into Odoo source code to understand behavior.

### Adding OCA Modules for Introspection

When you need to introspect OCA modules (not included in base Odoo):

**Step 1: Clone the OCA repository to `test-addons/`**

```bash
cd test-addons
git clone --depth 1 -b 17.0 https://github.com/OCA/<repo-name>.git
```

Example for MIS Builder and dependencies:
```bash
git clone --depth 1 -b 17.0 https://github.com/OCA/mis-builder.git
git clone --depth 1 -b 17.0 https://github.com/OCA/reporting-engine.git
git clone --depth 1 -b 17.0 https://github.com/OCA/server-ux.git
```

**Step 2: Restart Docker (auto-discovers new addons)**

```bash
npm run odoo:down
npm run odoo:up
node scripts/wait-for-odoo.js
```

The `docker/odoo-entrypoint.sh` script automatically scans `/mnt/oca` (mounted from `test-addons/`) and adds all addon directories to Odoo's addons-path.

**Step 3: Install the modules**

```bash
# Install dependencies first, then the target module
npm run odoo:addon:install date_range
npm run odoo:addon:install report_xlsx
npm run odoo:addon:install mis_builder
```

**Step 4: Introspect the models**

```javascript
// Find all models from a module
const models = await client.searchRead('ir.model',
  [['modules', 'ilike', 'mis_builder']],
  { fields: ['model', 'name', 'info'] }
);

// Or find models by name pattern
const misModels = await client.searchRead('ir.model',
  [['model', 'like', 'mis.%']],
  { fields: ['model', 'name'] }
);

// Get all fields for a specific model
const fields = await client.searchRead('ir.model.fields',
  [['model', '=', 'mis.report.instance']],
  { fields: ['name', 'ttype', 'field_description', 'required', 'readonly', 'relation'] }
);
```

**Step 5: Test API methods**

```javascript
// Call methods on the model
const reportData = await client.call('mis.report.instance', 'compute', [[instanceId]]);

// Explore the returned structure
console.log('Keys:', Object.keys(reportData));
console.log('Body rows:', reportData.body.length);
```

### Common OCA Repositories

| Repository | Key Modules | Use Case |
|------------|-------------|----------|
| OCA/mis-builder | `mis_builder` | Financial reports (PnL, Balance Sheet) |
| OCA/reporting-engine | `report_xlsx` | Excel exports |
| OCA/server-ux | `date_range` | Date range utilities |
| OCA/l10n-spain | `l10n_es_mis_report` | Spanish financial templates |
| OCA/project | Various project addons | Project management |
| OCA/hr | HR modules | Human resources |

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

---

**Remember**: We're building developer tooling. DX (Developer Experience) is a feature.

**Pro tip**: When debugging Odoo behavior, search the Odoo GitHub repo for the model/field name or context variable. The answers are in the source code!

For setup, testing, and contribution guidelines, see [DEVELOPMENT.md](./DEVELOPMENT.md).
