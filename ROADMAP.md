# ROADMAP - Future Design Decisions

Items that require further design and research before implementation.

## Infrastructure & CI/CD

### Odoo Test Environment
**Problem**: Need to test against real Odoo instances without requiring developers to run Odoo locally.

**Primary Target**: Odoo Community Edition with OCA modules (what we run in production)
**Secondary Target**: Odoo Enterprise (for compatibility testing)

**Questions**:
- How does OCA (Odoo Community Association) run tests?
  - Investigate their runbot system (https://runbot.odoo-community.org/)
  - Look at their GitHub Actions workflows
  - Study OCA's testing patterns and conventions
- Should we use Docker containers for Odoo in CI?
  - Official Odoo Community images vs custom builds with OCA modules
  - How to populate with test data
  - Pre-install common OCA modules (project, server-tools, etc.)
- How to test against multiple Odoo versions and editions?
  - Matrix builds: Community v14, v15, v16, v17
  - Optional: Enterprise compatibility testing
  - Different OCA module combinations
- How to handle slow CI (Odoo startup time)?
  - Caching strategies
  - Pre-built images with OCA modules
  - Parallel test execution

**Current Implementation** (Phase 1):
- ✅ Docker Compose for local Odoo + PostgreSQL
- ✅ Jest with unit and integration test projects
- ✅ Automated setup/teardown via Jest globals
- ✅ GitHub Actions with PostgreSQL service (fast)
- ✅ `act` support for local CI validation (docker-compose mode)
- ✅ Environment-based configuration (.env files)

**Future Enhancements** (Phase 2+):

#### Custom Docker Images with OCA Modules
**Problem**: Each CI run pulls and starts fresh Odoo (~10-15 minutes), building modules every time.

**Solution**: Pre-built Docker image with common OCA modules
- Create `Dockerfile` extending odoo:17.0 with pre-installed modules:
  - `project` - Project management
  - `sale` - Sales order management
  - `stock` - Inventory management
  - `server-tools` - Common base utilities
  - Other critical OCA modules as needed
- Build and publish to GitHub Container Registry: `ghcr.io/owner/odoo-toolbox-test:17.0`
- Update CI to use custom image instead of official
- **Expected improvement**: Reduces startup from ~15min to ~2-3min

#### Multi-Version Matrix Testing
**Problem**: Odoo users may run different versions (14.0, 15.0, 16.0, 17.0).

**Solution**: GitHub Actions matrix strategy
```yaml
strategy:
  matrix:
    odoo-version: ['17', '16', '15', '14']
    postgres-version: ['15', '14', '13']
```
- Test against multiple Odoo/PostgreSQL combinations
- Identify version-specific behavior and regressions
- Custom Docker images per version (odoo:17.0, odoo:16.0, etc.)

#### Fixture Recording (Polly.js)
**Problem**: Integration tests are slow (wait for Odoo startup) but need real API behavior.

**Solution**: Record RPC responses once, replay for deterministic tests
- Install `@pollyjs/core`, `@pollyjs/adapter-node-http`, `@pollyjs/persister-fs`
- Record mode: First test run captures all Odoo RPC responses to `tests/fixtures/http/`
- Replay mode: Subsequent runs use fixtures (fast, deterministic)
- Manual recording for edge cases and error scenarios
- Update fixtures when Odoo version changes

#### OCA Module Testing
**Problem**: Need to test against actual OCA modules (project, sale, stock) with their fields and behavior.

**Solution**: Install OCA modules in test Odoo instance
- Clone OCA repos to `test-addons/`
- Mount in docker-compose: `volumes: ['./test-addons:/mnt/extra-addons']`
- Parameterize tests to validate against different module combinations
- Document which OCA modules are tested in CI

#### Performance Benchmarking
**Problem**: Need to track performance regressions in RPC operations and state management.

**Solution**: Add benchmark tests alongside integration tests
- Measure: RPC call latency, drift detection time, plan generation time
- Store baseline metrics in JSON
- CI fails if benchmarks regress >10%
- Generate performance reports in PR comments

**Research Needed**:
- [ ] Study OCA testing infrastructure and runbot patterns
- [ ] Evaluate custom Docker image build overhead vs startup savings
- [ ] Measure with different module combinations and dataset sizes
- [ ] Document OCA module dependencies for testing
- [ ] Design fixture recording strategy and directory structure
- [ ] Prototype matrix builds with GitHub Actions
- [ ] (Optional) Enterprise Edition compatibility testing

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

## Error Handling & Debugging

### Improved Error Messages
**Problem**: Odoo RPC errors are verbose, nested, and difficult to parse. They often contain stack traces, cryptic model names, and unhelpful messages.

**Example of typical Odoo error**:
```python
{
  "jsonrpc": "2.0",
  "id": null,
  "error": {
    "code": 200,
    "message": "Odoo Server Error",
    "data": {
      "name": "odoo.exceptions.ValidationError",
      "debug": "Traceback (most recent call last):\n  File \"/usr/lib/python3/dist-packages/odoo/addons/base/models/ir_http.py\", line 237, in _dispatch\n    result = request.dispatch()\n  ... [100+ lines of traceback] ...\n  ValidationError: You cannot create a task without a project.",
      "message": "You cannot create a task without a project.",
      "arguments": ["You cannot create a task without a project."],
      "context": {}
    }
  }
}
```

**What users actually need**:
```
❌ Failed to create project.task

Reason: You cannot create a task without a project.

Suggested fix: Ensure 'project_id' is set before creating tasks.

Model: project.task
Operation: create
Values: { name: "My Task", ... }

Run with --debug for full Odoo traceback.
```

**Questions**:
- How to parse and categorize Odoo errors?
  - ValidationError → user-friendly validation messages
  - AccessError → permission/authentication issues
  - IntegrityError → database constraint violations
  - UserError → business logic violations
- Should we build an error catalog?
  - Common errors with solutions/suggestions
  - Pattern matching on error messages
  - Contextual help based on operation
- Error enhancement strategies:
  - Extract root cause from nested errors
  - Add operation context (model, method, values)
  - Suggest fixes based on error type
  - Link to relevant documentation
- Structured error objects:
  - Machine-readable error codes
  - Categorization (auth, validation, constraint, etc.)
  - Actionable suggestions
- Debug mode:
  - Verbose output with full Odoo traceback
  - RPC request/response logging
  - Step-by-step operation logging

**Design Needed**:
- [ ] Catalog common Odoo error patterns
- [ ] Design error parser (extract useful info from Odoo errors)
- [ ] Create error category taxonomy
- [ ] Design user-friendly error format
- [ ] Build suggestion engine (error → suggested fix)
- [ ] Implement debug mode for verbose output
- [ ] Test with real-world Odoo errors

**Implementation Ideas**:
```typescript
class OdooError extends Error {
  code: string;              // 'VALIDATION_ERROR', 'ACCESS_DENIED', etc.
  category: ErrorCategory;   // validation, auth, constraint, etc.
  odooMessage: string;       // Original Odoo message
  suggestion?: string;       // Suggested fix
  model?: string;            // Affected model
  operation?: string;        // create, write, search, etc.
  context?: any;             // Operation context for debugging
  debugInfo?: {              // Available in debug mode
    traceback: string;
    requestData: any;
    responseData: any;
  };
}

// Error catalog example
const ERROR_CATALOG = {
  'cannot create a task without a project': {
    category: 'validation',
    suggestion: "Ensure 'project_id' field is set when creating tasks",
    docLink: 'https://docs.odoo.com/...'
  },
  'access denied': {
    category: 'authorization',
    suggestion: 'Check user permissions for this model and operation',
    docLink: 'https://docs.odoo.com/...'
  }
};
```

### Error Recovery & Retry
**Problem**: Network issues, timeouts, and transient errors should be retryable.

**Questions**:
- Which errors are retryable?
  - Network timeouts
  - Connection errors
  - Rate limiting
  - Temporary Odoo unavailability
- Retry strategies:
  - Exponential backoff
  - Max retry count
  - Configurable retry logic
- Circuit breaker pattern?
  - Stop retrying after repeated failures
  - Prevent cascading failures

**Design Needed**:
- [ ] Identify retryable vs fatal errors
- [ ] Design retry mechanism
- [ ] Configure sensible defaults
- [ ] Allow user customization

### Operation Validation
**Problem**: Catch errors before making RPC calls.

**Questions**:
- Pre-flight validation:
  - Required fields present?
  - Field types match expected?
  - Domain filters well-formed?
  - Context keys valid?
- Where to validate?
  - Client-side (before RPC)
  - Use generated types for validation
  - Introspection metadata for constraints
- How to handle custom validation rules?

**Design Needed**:
- [ ] Design validation framework
- [ ] Generate validators from types
- [ ] Pre-flight checks for common errors
- [ ] User-extensible validation

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
