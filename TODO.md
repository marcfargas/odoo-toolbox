# TODO - Ready to Implement

Tasks that are designed and ready for implementation. Organized by priority.

## Upcoming

### Logging Audit
- [ ] Audit all logging calls to match namespace convention (package:part)
- [ ] Replace any custom logging wrappers with `debug()` package
- [ ] Verify all loggers follow pattern: `debug('package:part')`
- [ ] Update any undocumented loggers with namespace comments
- [ ] Add debug namespace documentation to each package README

## P0 - Foundation (Week 1-2)

### Project Setup
- [x] Initialize monorepo with npm/pnpm workspaces
- [x] Configure TypeScript for all packages
- [x] Set up ESLint + Prettier
- [x] Create basic package.json for each package
- [x] Set up Git repository and .gitignore
- [x] Choose and add MIT License
- [x] Create basic GitHub Actions for CI (lint, build, test)

### odoo-client - RPC Foundation
- [x] Implement JSON-RPC transport
  - [x] POST request with proper headers
  - [x] Authentication (login to get session/uid)
  - [x] Error response parsing
  - [x] Connection keep-alive (not needed for stateless RPC)
- [x] Implement XML-RPC transport (alternative) - deferred to P2
  - [x] JSON-RPC is sufficient for initial use cases
- [x] Create OdooClient class
  - [x] Constructor with connection params (url, db, username, password)
  - [x] `authenticate()` method
  - [x] `call(model, method, args, kwargs)` method
  - [x] Context support in kwargs
- [x] Basic error handling
  - [x] OdooRpcError class
  - [x] Network error wrapping
  - [x] Odoo-specific error parsing

### odoo-client - Basic Operations
- [x] Implement `search(model, domain, options)` method
- [x] Implement `read(model, ids, fields)` method
- [x] Implement `search_read(model, domain, fields, options)` method
- [x] Implement `create(model, values)` method
- [x] Implement `write(model, ids, values)` method
- [x] Implement `unlink(model, ids)` method
- [x] Add TypeScript generics for return types

## P1 - Introspection & Code Generation (Week 3-4)

### odoo-client - Introspection
- [x] Implement `getModels()` - query ir.model
  - [x] Return model name, description, fields
- [x] Implement `getFields(model)` - query ir.model.fields
  - [x] Return field name, type, required, relation, etc.
  - [x] Handle all Odoo field types
- [x] Implement `getModelMetadata(model)` - combined model + fields
- [x] Cache introspection results (in-memory)

### odoo-client - Code Generator
- [x] Create TypeScript interface generator
  - [x] Map Odoo field types to TS types
  - [x] Handle required vs optional fields
  - [x] Generate helper types (SearchOptions, ReadOptions, etc.)
- [x] Generate individual model interfaces
- [x] Generate index file with all exports
- [x] Handle naming conflicts (sanitize model names)
- [x] Add JSDoc comments from Odoo field help text
- [x] CLI command: `odoo-client generate`
  - [x] Accept connection params
  - [x] Accept output directory
  - [x] Accept model filter (modules option)
  - [x] Show progress during generation
- [x] Unit tests for type mappers and formatter

### Testing Foundation
- [x] Set up Jest or Vitest
- [x] Create test Odoo connection fixture
- [x] Write unit tests for type mappers
- [x] Write integration tests for RPC client (require Odoo instance)
- [x] Document how to run tests locally

## P2 - State Manager Foundation (Week 5-6) ✅ COMPLETE

### odoo-state-manager - Compare ✅
- [x] Implement deep comparison function
  - [x] Handle primitive fields
  - [x] Handle many2one (compare by ID)
  - [x] Handle one2many/many2many (compare arrays)
  - [x] Handle nested objects
  - [x] Ignore readonly/computed fields
- [x] Create Diff type/interface
  - [x] Field path
  - [x] Old value
  - [x] New value
  - [x] Change type (create, update, delete)
- [x] Generate human-readable diff output
- [x] Full test coverage (27 tests)

### odoo-state-manager - Plan ✅
- [x] Create Plan type/interface
  - [x] List of operations (create, update, delete)
  - [x] Affected models and IDs
  - [x] Dependency order
- [x] Implement plan generator
  - [x] Generate ordered operations
  - [x] Handle create before update (dependencies)
  - [x] Topological sorting for dependency resolution
- [x] Format plan for console output (Terraform-like)
- [x] Full test coverage (19 generator + 32 formatter = 51 tests)

### odoo-state-manager - Apply ✅
- [x] Implement apply executor
  - [x] Execute creates
  - [x] Execute updates
  - [x] Execute deletes
  - [x] Respect operation order
- [x] Map temporary IDs to real database IDs
- [x] Resolve ID references in operation values
- [x] Add dry-run mode
- [x] Add operation batching (structured for Phase 3)
- [x] Error handling with continue/stop behavior
- [x] Progress callbacks and completion tracking
- [x] Full test coverage (18 tests)
- [x] Add dry-run mode
  - [x] Add operation batching (where possible)
  - [x] Error handling and partial rollback (basic)

## P3 - Examples & Documentation (Week 7) ✅ COMPLETE

### Examples
- [x] Create example: Connect and authenticate
- [x] Create example: Generate types
- [x] Create example: CRUD operations with types
- [x] Create example: Search with domain filters
- [x] Create example: Batch operations
- [x] Create example: Context usage
- [x] Create example: Schema introspection
- [x] Add test suite to validate examples
- [x] Create example: State Management workflow
- [x] Create example: CI/CD Validation patterns

### Documentation
- [x] Document connection options (client README)
- [x] Document generated type structure (client README)
- [x] Document error handling patterns (client README, practical focus)
- [x] Create troubleshooting guide (client README, refer to examples)
- [x] Add API reference note in README; future auto-generation to ROADMAP
- [x] After state-manager implementation: add state manager workflow to main README
- [x] Create INTEGRATION_GUIDE.md with complete workflows and patterns
- [x] Add client and apply module documentation with Odoo source references

**Test Coverage**: 146 tests total (all passing)
- Client: 46 tests
- State Manager Compare: 27 tests
- State Manager Plan: 51 tests  
- State Manager Apply: 18 tests
- Examples: 4 tests

## P3+ - Production Hardening & Advanced Features (Future)

### Client Enhancements (P3+)
- [ ] Add retry logic for transient failures
  - [ ] Exponential backoff configuration
  - [ ] Configurable retry count
  - [ ] Retry on specific error types (connection, timeout)
  - [ ] Tests for retry behavior
- [ ] Add connection timeout configuration
  - [ ] Configurable per request
  - [ ] Connection timeout vs operation timeout
  - [ ] Tests for timeout behavior
- [ ] Add request logging (with `debug` library)
  - [ ] Log RPC calls in detail mode
  - [ ] Log authentication, introspection
  - [ ] Configurable log levels
- [ ] Add validation for connection params
  - [ ] Validate URL format
  - [ ] Validate credentials (non-empty)
  - [ ] Provide helpful error messages
- [ ] Connection pooling (investigate need)
  - [ ] Profile RPC call patterns
  - [ ] Measure impact of connection reuse
  - [ ] Implement if significant improvement

### State Manager Enhancements (P3+)
- [x] Operation batching optimization
  - [x] Group similar operations (create all then update all)
  - [x] Profile query performance gains
  - [x] Optional batching configuration
- [x] Partial rollback on error
  - [x] Transaction support in Apply
  - [x] Savepoint support if available
  - [x] Atomic transaction fallback
- [x] Advanced diff algorithms
  - [x] Custom comparators for specific field types
  - [x] Collection diff strategies (added/removed vs full replace)
  - [x] Performance optimization for large datasets
- [x] Plan validation enhancements
  - [x] Check field permissions before applying
  - [x] Validate relational record existence
  - [x] Suggest fixes for common errors

### Testing Infrastructure (P3+)
- [ ] Odoo test environment
  - [ ] Custom Docker image with OCA modules
  - [ ] Multi-version matrix testing (17, 16, 15, 14)
  - [ ] Fixture recording with Polly.js
- [ ] Performance benchmarking
  - [ ] Benchmark RPC operations
  - [ ] Benchmark drift detection
  - [ ] Benchmark plan generation
- [ ] OCA module compatibility testing
  - [ ] Test against common OCA modules
  - [ ] Document tested module combinations
  - [ ] Test field introspection with custom fields

### Documentation Improvements (P3+)
- [ ] API auto-generation documentation
  - [ ] JSDoc -> Markdown converter
  - [ ] Generate API reference from source
  - [ ] Keep examples in sync with API changes
- [ ] Video/animated guides
  - [ ] 5-minute quick start video
  - [ ] Workflow visualization (compare → plan → apply)
  - [ ] Common error resolution walkthrough
- [ ] Real-world case studies
  - [ ] Multi-tenant configuration replication
  - [ ] Configuration as code patterns
  - [ ] CI/CD integration examples

### Quick Wins (Anytime)

- [ ] Add logging with debug library
- [ ] Add request retry logic for transient failures
- [ ] Add timeout configuration
- [ ] Add progress callbacks for long operations
- [ ] Add validation for connection params
- [ ] Implement connection pooling

---

## Notes

- Start with JSON-RPC (simpler than XML-RPC)
- Test against Odoo Community Edition v17 with OCA modules initially
- Focus on OCA ecosystem (Community Edition) as primary target
- Keep examples simple and focused
- Use existing OCA Odoo instance for development (don't set up CI until P2+)
- Prioritize working code over perfect code
- Each checkbox can be a separate commit
- Reference OCA modules and patterns when relevant
