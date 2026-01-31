# TODO - Ready to Implement

Tasks that are designed and ready for implementation. Organized by priority.

---

## Completed Phases

### P0 - Foundation ✅
- Project setup (monorepo, TypeScript, ESLint, CI)
- RPC Foundation (JSON-RPC transport, OdooClient class, error handling)
- Basic Operations (search, read, create, write, unlink)

### P1 - Introspection & Code Generation ✅
- Introspection (getModels, getFields, getModelMetadata, caching)
- Code Generator (TypeScript interfaces, CLI command)
- Testing foundation

### P2 - State Manager Foundation ✅
- Compare module (deep comparison, diff types)
- Plan module (operation ordering, dependency graph)
- Apply module (execute plans against Odoo)

### P3 - Examples & Documentation ✅
- Complete example suite (CRUD, search, batch, context, state management)
- Documentation (README, INTEGRATION_GUIDE.md)
- 146 tests (all passing)

### P0.5 - Package Refactoring ✅
Separated runtime concerns (client) from development-time concerns (introspection/codegen):
- Created `@odoo-toolbox/introspection` package with schema introspection and codegen
- Cleaned up `@odoo-toolbox/client` to be lightweight runtime-only
- Updated documentation and examples for new package structure

**Current packages:**
- `packages/odoo-client` - Lightweight RPC client for runtime
- `packages/odoo-introspection` - Schema introspection and TypeScript codegen
- `packages/odoo-state-manager` - State management (compare, plan, apply)

---

## Next Phase

## P4 - MCP Server

**Goal**: Create a Model Context Protocol (MCP) server with semantic understanding of Odoo models, leveraging introspection to provide rich context to AI assistants.

**Why MCP for Odoo?**:
- Current MCP servers are just thin CRUD wrappers (search/read only)
- Introspection enables semantic understanding:
  - Model relationships and hierarchy
  - Business context from modules
  - Available actions and workflows
  - Field metadata and constraints
- AI can interact with Odoo intelligently, not just execute queries

### @odoo-toolbox/introspective-mcp - Package Setup
- [ ] Create `packages/odoo-introspective-mcp` directory structure:
  - [ ] `src/server.ts` - Main MCP server implementation
  - [ ] `src/tools/` - MCP tools (callable by AI)
  - [ ] `src/resources/` - MCP resources (readable by AI)
  - [ ] `src/prompts/` - MCP prompts (templates)
  - [ ] `src/context/` - Enhanced introspection (relationships, actions, semantic)
- [ ] Create `package.json`:
  - [ ] Dependencies: `@odoo-toolbox/client`, `@odoo-toolbox/introspection`, `@modelcontextprotocol/sdk`
  - [ ] Bin entry: `odoo-mcp-server`
- [ ] Create `tsconfig.json` for TypeScript configuration
- [ ] Create `README.md`:
  - [ ] MCP server features and capabilities
  - [ ] Configuration examples (Claude Desktop, etc.)
  - [ ] Tool and resource documentation
  - [ ] Usage examples

### @odoo-toolbox/introspective-mcp - Server Core
- [ ] Implement `src/index.ts` - Server entry point:
  - [ ] Read configuration from environment variables (ODOO_URL, ODOO_DB, ODOO_USER, ODOO_PASSWORD)
  - [ ] Initialize OdooClient and authenticate
  - [ ] Initialize IntrospectionService
  - [ ] Create MCP Server instance with capabilities
  - [ ] Set up stdio transport
  - [ ] Register tools, resources, prompts
  - [ ] Implement error handling and logging
  - [ ] Implement graceful shutdown
- [ ] Create `src/server.ts`:
  - [ ] Server configuration types
  - [ ] Tool registration helper
  - [ ] Resource registration helper
  - [ ] Prompt registration helper

### @odoo-toolbox/introspective-mcp - Tools (AI-Callable Operations)
- [ ] Create `src/tools/index.ts` - Tool registration
- [ ] Implement `src/tools/search.ts` - `odoo_search_records`:
  - [ ] Accept: model, domain (optional), fields (optional), limit (optional)
  - [ ] Use OdooClient.search_read()
  - [ ] Format results as JSON for AI
  - [ ] Handle errors gracefully
- [ ] Implement `src/tools/discover.ts` - `odoo_discover_models`:
  - [ ] Accept: concept (business domain, e.g., "sales", "projects", "inventory")
  - [ ] Use IntrospectionService.getInstalledModules()
  - [ ] Fuzzy match on concept (module name, display name, summary)
  - [ ] Return relevant models with module context
  - [ ] Include model descriptions and field counts
- [ ] Implement `src/tools/model-info.ts` - `odoo_get_model_info`:
  - [ ] Accept: model name
  - [ ] Return: schema, fields, relationships, module context
  - [ ] Use IntrospectionService.getModelMetadata()
  - [ ] Enhance with relationship analysis
- [ ] Implement `src/tools/create.ts` - `odoo_create_record`:
  - [ ] Accept: model, values
  - [ ] Validate required fields (using introspection)
  - [ ] Create record via OdooClient.create()
  - [ ] Return created record ID
- [ ] Implement `src/tools/update.ts` - `odoo_update_record`:
  - [ ] Accept: model, id, values
  - [ ] Update via OdooClient.write()
  - [ ] Return success status
- [ ] Implement `src/tools/navigate.ts` - `odoo_get_related`:
  - [ ] Accept: model, record ID, relationship field
  - [ ] Read record to get related IDs
  - [ ] Fetch related records
  - [ ] Use relationship analyzer for parent/child context

### @odoo-toolbox/introspective-mcp - Resources (AI-Readable Data)
- [ ] Create `src/resources/index.ts` - Resource registration
- [ ] Implement `src/resources/schema.ts` - `odoo://schema/{model}`:
  - [ ] URI pattern: odoo://schema/res.partner
  - [ ] Return model metadata as JSON
  - [ ] Include: fields, types, required flags, relationships
  - [ ] Use IntrospectionService.getModelMetadata()
- [ ] Implement `src/resources/modules.ts` - `odoo://modules/installed`:
  - [ ] Return list of installed modules
  - [ ] Include: name, display name, summary, description, category
  - [ ] Use IntrospectionService.getInstalledModules()
- [ ] Implement `src/resources/module-models.ts` - `odoo://modules/{module}/models`:
  - [ ] Return models provided by a specific module
  - [ ] Use IntrospectionService.getModuleModels()
- [ ] Implement `src/resources/filters.ts` - `odoo://filters/{model}`:
  - [ ] Query ir.filters for saved filters
  - [ ] Return: filter name, domain, context
  - [ ] Help AI understand common query patterns

### @odoo-toolbox/introspective-mcp - Prompts (AI Templates)
- [ ] Create `src/prompts/index.ts` - Prompt registration
- [ ] Implement prompt templates:
  - [ ] `create_record_guide` - Template for creating records with validation
  - [ ] `search_guide` - Template for constructing search queries
  - [ ] `relationship_guide` - Template for navigating relationships

### @odoo-toolbox/introspective-mcp - Context Enhancement (Semantic Intelligence)
- [ ] Implement `src/context/relationships.ts` - Relationship Analyzer:
  - [ ] Detect parent-child relationships using heuristics:
    - [ ] Field naming conventions (parent_id, project_id in project.task)
    - [ ] Inverse field detection (one2many ↔ many2one)
    - [ ] Self-referential detection
  - [ ] Return RelationshipMetadata with type classification:
    - [ ] 'parent' - hierarchical parent
    - [ ] 'child' - hierarchical child
    - [ ] 'reference' - non-hierarchical relation
    - [ ] 'association' - many2many relation
  - [ ] Mark hierarchical relationships (isHierarchical flag)
- [ ] Implement `src/context/actions.ts` - Action Introspection:
  - [ ] Query ir.ui.view for button definitions (future)
  - [ ] Detect state fields (fields with selection type named 'state')
  - [ ] Extract state transitions from selection values
  - [ ] Return available actions per model
  - [ ] Document common patterns (confirm, cancel, draft, done)
- [ ] Implement `src/context/semantic.ts` - Semantic Model Discovery:
  - [ ] Build model-to-module mapping
  - [ ] Create searchable index by business domain
  - [ ] Support fuzzy matching on concepts
  - [ ] Cache results for performance

### Enhanced Introspection Features (in @odoo-toolbox/introspection)
- [ ] Extend `IntrospectionService` with module awareness:
  - [ ] Implement `getInstalledModules()`:
    - [ ] Query ir.module.module where state='installed'
    - [ ] Return: name, shortdesc (display name), summary, description, category
  - [ ] Implement `getModuleModels(moduleName)`:
    - [ ] Query ir.model.data to link models to modules
    - [ ] Filter by module name
    - [ ] Return list of model names
- [ ] Enhance field metadata:
  - [ ] Detect computed fields (store=False indicator)
  - [ ] Detect readonly fields
  - [ ] Parse selection options properly
  - [ ] Extract and include help text

### Testing & Documentation
- [ ] Write integration tests:
  - [ ] Test MCP server initialization
  - [ ] Test each tool with mock MCP client
  - [ ] Test resource reading
  - [ ] Test relationship detection
  - [ ] Test module discovery
- [ ] Write unit tests:
  - [ ] Test RelationshipAnalyzer heuristics
  - [ ] Test semantic model discovery
  - [ ] Test filter introspection
- [ ] Create example configurations:
  - [ ] Claude Desktop config
  - [ ] Other MCP client examples
- [ ] Document all tools:
  - [ ] Input parameters
  - [ ] Output format
  - [ ] Usage examples
- [ ] Document all resources:
  - [ ] URI patterns
  - [ ] Data structure
  - [ ] Use cases
- [ ] Create usage tutorials:
  - [ ] "Ask AI to find sales orders"
  - [ ] "Ask AI to create a project with tasks"
  - [ ] "Ask AI to discover inventory models"

---

## Future Enhancements (P5+)

### Client Enhancements
- [ ] Add retry logic for transient failures (exponential backoff)
- [ ] Add connection timeout configuration
- [ ] Add request logging (with `debug` library)
- [ ] Add validation for connection params
- [ ] Connection pooling (investigate need)

### State Manager Enhancements
- [ ] Operation batching optimization
- [ ] Group similar operations (create all then update all)
- [ ] Profile query performance gains

### Type System Improvements
- [ ] Type-safe domain selectors (see ROADMAP.md)
- [ ] Selection field union types
- [ ] Date/DateTime handling utilities

See [ROADMAP.md](./ROADMAP.md) for long-term design decisions and research items.
