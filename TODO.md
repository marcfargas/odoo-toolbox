# TODO - Ready to Implement

Tasks that are designed and ready for implementation. Organized by priority.

## P0 - Foundation (Week 1-2)

### Project Setup
- [x] Initialize monorepo with npm/pnpm workspaces
- [x] Configure TypeScript for all packages
- [ ] Set up ESLint + Prettier
- [x] Create basic package.json for each package
- [x] Set up Git repository and .gitignore
- [x] Choose and add MIT License
- [x] Create basic GitHub Actions for CI (lint, build, test)

### odoo-client - RPC Foundation
- [ ] Implement JSON-RPC transport
  - [ ] POST request with proper headers
  - [ ] Authentication (login to get session/uid)
  - [ ] Error response parsing
  - [ ] Connection keep-alive
- [ ] Implement XML-RPC transport (alternative)
  - [ ] XML request/response serialization
  - [ ] Same authentication flow as JSON-RPC
- [ ] Create OdooClient class
  - [ ] Constructor with connection params (url, db, username, password)
  - [ ] `authenticate()` method
  - [ ] `call(model, method, args, kwargs)` method
  - [ ] Context support in kwargs
- [ ] Basic error handling
  - [ ] OdooRpcError class
  - [ ] Network error wrapping
  - [ ] Odoo-specific error parsing

### odoo-client - Basic Operations
- [ ] Implement `search(model, domain, options)` method
- [ ] Implement `read(model, ids, fields)` method
- [ ] Implement `search_read(model, domain, fields, options)` method
- [ ] Implement `create(model, values)` method
- [ ] Implement `write(model, ids, values)` method
- [ ] Implement `unlink(model, ids)` method
- [ ] Add TypeScript generics for return types

## P1 - Introspection & Code Generation (Week 3-4)

### odoo-client - Introspection
- [ ] Implement `getModels()` - query ir.model
  - [ ] Return model name, description, fields
- [ ] Implement `getFields(model)` - query ir.model.fields
  - [ ] Return field name, type, required, relation, etc.
  - [ ] Handle all Odoo field types
- [ ] Implement `getModelMetadata(model)` - combined model + fields
- [ ] Cache introspection results (in-memory)

### odoo-client - Code Generator
- [ ] Create TypeScript interface generator
  - [ ] Map Odoo field types to TS types
  - [ ] Handle required vs optional fields
  - [ ] Generate helper types (Many2One, One2Many, Many2Many)
- [ ] Generate individual model interfaces
- [ ] Generate index file with all exports
- [ ] Handle naming conflicts (sanitize model names)
- [ ] Add JSDoc comments from Odoo field help text
- [ ] CLI command: `odoo-client generate`
  - [ ] Accept connection params
  - [ ] Accept output directory
  - [ ] Accept model filter (optional - which models to generate)
  - [ ] Show progress during generation

### Testing Foundation
- [x] Set up Jest or Vitest
- [x] Create test Odoo connection fixture
- [ ] Write unit tests for type mappers
- [x] Write integration tests for RPC client (require Odoo instance)
- [x] Document how to run tests locally

## P2 - State Manager Foundation (Week 5-6)

### odoo-state-manager - Compare
- [ ] Implement deep comparison function
  - [ ] Handle primitive fields
  - [ ] Handle many2one (compare by ID)
  - [ ] Handle one2many/many2many (compare arrays)
  - [ ] Handle nested objects
  - [ ] Ignore readonly/computed fields
- [ ] Create Diff type/interface
  - [ ] Field path
  - [ ] Old value
  - [ ] New value
  - [ ] Change type (create, update, delete)
- [ ] Generate human-readable diff output

### odoo-state-manager - Plan
- [ ] Create Plan type/interface
  - [ ] List of operations (create, update, delete)
  - [ ] Affected models and IDs
  - [ ] Dependency order
- [ ] Implement plan generator
  - [ ] Read current state from Odoo
  - [ ] Compare with desired state
  - [ ] Generate ordered operations
  - [ ] Handle create before update (dependencies)
- [ ] Format plan for console output (Terraform-like)

### odoo-state-manager - Apply
- [ ] Implement apply executor
  - [ ] Execute creates
  - [ ] Execute updates
  - [ ] Execute deletes
  - [ ] Respect operation order
- [ ] Add dry-run mode
- [ ] Add operation batching (where possible)
- [ ] Error handling and partial rollback (basic)

## P3 - Examples & Documentation (Week 7)

### Examples
- [ ] Create example: Connect and authenticate
- [ ] Create example: Generate types
- [ ] Create example: CRUD operations with types
- [ ] Create example: Search with domain filters
- [ ] Create example: State management workflow
- [ ] Create example: Batch operations
- [ ] Create example: Context usage

### Documentation
- [ ] Document connection options
- [ ] Document generated type structure
- [ ] Document state manager workflow
- [ ] Document error handling
- [ ] Create troubleshooting guide
- [ ] Add API reference (auto-generated from TSDoc)

## Quick Wins (Anytime)

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
