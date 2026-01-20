# ROADMAP - Future Design Decisions

Items that require further design and research before implementation.

## Infrastructure & CI/CD

### Odoo Test Environment
**Problem**: Need to test against real Odoo instances without requiring developers to run Odoo locally.

**Questions**:
- How does OCA (Odoo Community Association) run tests?
  - Investigate their runbot system
  - Look at their GitHub Actions workflows
- Should we use Docker containers for Odoo in CI?
  - Official Odoo images vs custom builds
  - How to populate with test data
- How to test against multiple Odoo versions?
  - Matrix builds (v14, v15, v16, v17)
  - Different module combinations
- How to handle slow CI (Odoo startup time)?
  - Caching strategies
  - Pre-built images
  - Parallel test execution

**Research Needed**:
- [ ] Study OCA testing infrastructure
- [ ] Evaluate Odoo Docker images
- [ ] Prototype GitHub Actions workflow with Odoo container
- [ ] Measure test execution times
- [ ] Design test data fixtures

---

## State Management

### Drift Visualization
**Problem**: Need to show users what changed in a clear, actionable way.

**Questions**:
- Console output format (like Terraform)?
  ```
  Plan: 3 to add, 2 to change, 1 to destroy
  
  + project.project: "Q1 Planning"
    + task_ids[0]: "Research Phase"
    + task_ids[1]: "Implementation"
  
  ~ project.task: "Implementation" (id: 42)
    ~ stage_id: "Done" → "In Progress"
  
  - project.task: "Old Task" (id: 38)
  ```
- Color coding in terminal (green add, yellow change, red delete)?
- Diff level granularity (field-level? character-level for text fields)?
- Web UI for drift visualization?
  - Could be useful for non-technical users
  - Side-by-side comparison view
- JSON/machine-readable output option?

**Design Needed**:
- [ ] Create mockups of console output
- [ ] Choose terminal coloring library
- [ ] Define output format specification
- [ ] Consider accessibility (color-blind users)

### Plan/Apply Workflow
**Problem**: Need safe, predictable state changes with rollback capability.

**Questions**:
- How to handle dependencies between operations?
  - Create parent before children
  - Topological sort of operations
- What happens if apply fails midway?
  - Rollback all changes?
  - Leave partial state?
  - Transaction boundaries in Odoo?
- Should we support "what-if" scenarios?
  - Multiple plan branches
  - Compare different desired states
- Locking/concurrency?
  - What if Odoo changes during plan→apply?
  - Re-validate before apply?
- Dry-run modes?
  - Show what WOULD happen
  - Validate without changes

**Design Needed**:
- [ ] Research Odoo transaction support
- [ ] Design rollback mechanism
- [ ] Define operation dependency graph structure
- [ ] Prototype atomic apply with rollback
- [ ] Design re-validation before apply

---

## Relational Field Handling

### Desired State Representation
**Problem**: How do users specify related records in desired state?

**Options**:
1. **By ID**: `user_id: 42`
   - ✅ Simple, explicit
   - ❌ Requires knowing IDs
   - ❌ Not portable across instances

2. **By Search Criteria**: `user_id: { login: 'admin' }`
   - ✅ Portable, declarative
   - ❌ What if multiple matches? Zero matches?
   - ❌ Requires search before create/update

3. **Nested Creation**: `user_id: { name: 'New User', email: '...' }`
   - ✅ Powerful, complete
   - ❌ Complex to implement
   - ❌ Harder to detect drift

4. **External ID**: `user_id: { external_id: 'base.user_admin' }`
   - ✅ Odoo-native concept
   - ❌ Requires external ID management
   - ❌ Not all records have external IDs

**Questions**:
- Support all options? Just some?
- How to handle not-found references?
- How to handle ambiguous references?
- Should we auto-create missing relations?

**Design Needed**:
- [ ] Prototype each option
- [ ] Define resolution strategy
- [ ] Design error handling for edge cases
- [ ] Create examples for each pattern

### One2Many and Many2Many
**Problem**: Arrays of related records are complex.

**Questions**:
- Full replacement vs merge strategy?
  - Replace: `task_ids: [1, 2, 3]` → delete old, set new
  - Merge: `task_ids: [1, 2, 3]` → add to existing
- How to update items in the array?
- How to handle ordering?
- Nested creates in one2many?

**Design Needed**:
- [ ] Define array comparison algorithm
- [ ] Design merge vs replace semantics
- [ ] Handle Odoo's (0, 0, {...}) create syntax
- [ ] Handle Odoo's (1, id, {...}) update syntax

---

## Advanced Features

### Context Management
**Problem**: Odoo context is crucial but complex.

**Questions**:
- Should context be per-operation or global?
- How to handle common context keys?
  - Language, timezone, company
- Builder pattern for context?
  ```typescript
  client
    .withContext({ lang: 'es_ES' })
    .search('project.project', ...)
  ```
- Context inheritance (parent to child operations)?

**Design Needed**:
- [ ] Survey common context usage patterns
- [ ] Design context API
- [ ] Document context implications

### Batch Operations
**Problem**: Odoo performs better with batched calls.

**Questions**:
- Automatic batching vs explicit?
- What operations can be batched?
  - Multiple creates → single create with array
  - Multiple writes → single write with ID array
  - Mixed operations?
- Batch size limits?
- Error handling in batches (all-or-nothing? partial success?)

**Design Needed**:
- [ ] Benchmark batch vs individual operations
- [ ] Design batch API
- [ ] Define error handling strategy

### Computed and Readonly Fields
**Problem**: Some fields can't be set directly.

**Questions**:
- How to identify readonly fields?
  - Introspection metadata
  - Hardcoded list
  - Try-and-catch
- Should we warn/error when user tries to set them?
- Include in drift detection?
- How to handle fields that become computed after module install?

**Design Needed**:
- [ ] Categorize field types
- [ ] Design handling strategy
- [ ] Update code generator to mark fields

---

## Type System

### Selection Fields
**Problem**: Odoo selection fields have predefined values.

**Questions**:
- Generate union types? `type Priority = 'low' | 'medium' | 'high';`
- Enum vs string literal union?
- How to handle dynamic selections (from function)?
- Custom selections added by modules?

**Design Needed**:
- [ ] Prototype union type generation
- [ ] Handle dynamic selections
- [ ] Test with custom modules

### Date/DateTime
**Problem**: Odoo stores dates as strings, but TypeScript could use Date.

**Questions**:
- Generate as `string` or `Date`?
- Provide conversion utilities?
- Timezone handling (Odoo stores UTC)?

**Design Needed**:
- [ ] Choose representation
- [ ] Design helper utilities
- [ ] Document timezone behavior

### Custom Field Types
**Problem**: Odoo modules can add custom field types.

**Questions**:
- How to handle unknown field types?
- Plugin system for custom type mappers?
- Fallback to `any`? `unknown`?

**Design Needed**:
- [ ] Design plugin architecture
- [ ] Define fallback behavior
- [ ] Document extension points

---

## Versioning & Compatibility

### Multi-Version Support
**Problem**: Different Odoo versions have different APIs and models.

**Questions**:
- How to detect Odoo version?
- Version-specific code paths?
- Which versions to support (v14+)?
- Breaking changes between versions?

**Research Needed**:
- [ ] Document API differences between versions
- [ ] Design version detection
- [ ] Plan version-specific adapters

### Module Detection
**Problem**: Installed modules change available models.

**Questions**:
- Should we detect installed modules?
- Generate types only for installed modules?
- How to handle optional modules (project, sale, inventory)?
- Conditional types based on modules?

**Design Needed**:
- [ ] Module detection API
- [ ] Conditional generation strategy
- [ ] Documentation for common modules

---

## Developer Experience

### VS Code Extension
**Idea**: Extension for even better DX.

**Features**:
- Syntax highlighting for desired state definitions
- Autocomplete for Odoo models
- Inline drift detection
- "Generate types" command
- "Plan/Apply" from editor

**Design Needed**:
- [ ] Scope initial features
- [ ] Prototype basic extension
- [ ] Test with real usage

### CLI Improvements
**Ideas**:
- Interactive mode for plan/apply
- Watch mode (detect drift on file changes)
- Config file support (.odoorc)
- Multiple environment profiles

**Design Needed**:
- [ ] Design config file format
- [ ] Plan interactive prompts
- [ ] Scope watch mode behavior

---

## Plugin System

### Extensibility
**Problem**: Users may need custom behavior.

**Questions**:
- What should be pluggable?
  - Custom field type mappers
  - Custom diff algorithms
  - Pre/post apply hooks
  - Custom RPC transports
- Plugin discovery mechanism?
- Plugin API stability?

**Design Needed**:
- [ ] Define plugin interfaces
- [ ] Design hook system
- [ ] Create example plugins
- [ ] Document plugin API

---

## Deployment & Distribution

### Package Publishing
**Questions**:
- Publish to npm registry?
- Scoped packages (@odoo-toolbox/)?
- Versioning strategy (semantic versioning)?
- Changelog automation?

**Tasks**:
- [ ] Choose npm scope
- [ ] Set up npm organization
- [ ] Configure publish workflow
- [ ] Design release process

### Documentation Site
**Options**:
- VitePress
- Docusaurus
- GitBook
- GitHub Pages + MkDocs

**Tasks**:
- [ ] Choose documentation framework
- [ ] Set up hosting
- [ ] Design documentation structure
- [ ] Add API reference generation

---

## Security & Best Practices

### Credential Management
**Problem**: Users need to provide Odoo credentials.

**Questions**:
- Support for API keys (if Odoo has them)?
- OAuth support?
- Credential storage (environment variables? .env files? keyring?)
- Avoid credentials in code

**Design Needed**:
- [ ] Research Odoo authentication options
- [ ] Design credential management
- [ ] Document security best practices

### Audit Logging
**Idea**: Log all state changes for compliance.

**Questions**:
- What to log (operations? diffs? results?)
- Where to store logs?
- Structured logging format?
- Integration with external logging systems?

**Design Needed**:
- [ ] Define log schema
- [ ] Choose logging library
- [ ] Design configuration options

---

## Performance

### Caching
**Questions**:
- Cache introspection results?
- Cache search results?
- TTL strategy?
- Invalidation triggers?

**Design Needed**:
- [ ] Benchmark with/without caching
- [ ] Design cache key strategy
- [ ] Choose caching library

### Parallel Execution
**Questions**:
- Parallelize independent operations in plan?
- Connection pooling?
- Rate limiting to avoid overwhelming Odoo?

**Design Needed**:
- [ ] Identify parallelizable operations
- [ ] Design connection pool
- [ ] Configure sensible limits

---

## Long-term Vision

### Web UI
**Idea**: Visual tool for drift detection and state management.

**Features**:
- Connect to Odoo instance
- Visual diff viewer
- Click to plan/apply
- State history

**Much later** - focus on core library first.

### State Backends
**Idea**: Store desired state in different backends (Git, S3, database).

**Much later** - current focus is code-defined state.

### Multi-Instance Orchestration
**Idea**: Manage multiple Odoo instances from one tool.

**Much later** - one instance is enough complexity for now.

---

## Review Schedule

Revisit this ROADMAP:
- After completing P0-P3 from TODO
- Monthly during active development
- When new requirements emerge from usage
- When Odoo releases new versions

Items graduate from ROADMAP → TODO when:
1. Design is complete
2. Implementation approach is clear
3. Dependencies are resolved
4. Priority is established
