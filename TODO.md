## P0.5 - Package Refactoring (Week 2.5)
**Goal**: Separate runtime concerns (client) from development-time concerns (introspection/codegen)

**Rationale**:
- Runtime apps don't need codegen dependencies
- Clear separation of concerns: client (runtime RPC) vs introspection (dev-time schema analysis)
- Enables lighter production bundles
- Better testability and reusability
- Sets foundation for MCP server that uses both packages

### Create @odoo-toolbox/introspection Package
- [ ] Create `packages/odoo-introspection` directory structure
  - [ ] `src/introspection/` - schema introspection logic
  - [ ] `src/codegen/` - TypeScript interface generation
  - [ ] `src/cli/` - CLI for code generation
- [ ] Create `package.json` with dependency on `@odoo-toolbox/client`
- [ ] Move files from odoo-client:
  - [ ] `packages/odoo-client/src/introspection/` → `packages/odoo-introspection/src/introspection/`
  - [ ] `packages/odoo-client/src/codegen/` → `packages/odoo-introspection/src/codegen/`
  - [ ] CLI logic → `packages/odoo-introspection/src/cli/index.ts`
- [ ] Update all imports in moved files
  - [ ] Change relative imports to `@odoo-toolbox/client`
  - [ ] Update import paths for moved modules
- [ ] Create package files:
  - [ ] `src/index.ts` - export IntrospectionService, CodeGenerator, types
  - [ ] `README.md` - document introspection and codegen features
  - [ ] `tsconfig.json` - TypeScript configuration
- [ ] Update bin entry: `odoo-introspect` command (was `odoo-client generate`)

### Clean Up @odoo-toolbox/client Package
- [ ] Remove introspection/codegen directories:
  - [ ] Delete `src/introspection/`
  - [ ] Delete `src/codegen/`
  - [ ] Delete CLI file(s)
- [ ] Update `package.json`:
  - [ ] Remove `bin` entry (CLI moved to introspection package)
  - [ ] Remove codegen-related dependencies (if any)
  - [ ] Update description: "Lightweight TypeScript client for Odoo RPC operations"
- [ ] Update `src/index.ts`:
  - [ ] Remove introspection exports
  - [ ] Remove codegen exports
  - [ ] Keep only: OdooClient, types (Domain, Context), errors
- [ ] Update `README.md`:
  - [ ] Focus on runtime RPC client capabilities
  - [ ] Remove introspection/codegen documentation
  - [ ] Add link to @odoo-toolbox/introspection for type generation
  - [ ] Update examples to show lean client usage

### Update @odoo-toolbox/state-manager
- [ ] Update `package.json`:
  - [ ] Add `@odoo-toolbox/introspection` to dependencies (if needed for validation)
- [ ] Update imports if introspection features are used

### Update Documentation
- [ ] Update root `README.md`:
  - [ ] Document three packages (client, introspection, state-manager)
  - [ ] Explain separation: runtime vs dev-time concerns
  - [ ] Update installation examples
  - [ ] Update code examples to show both packages
- [ ] Update examples:
  - [ ] Separate client examples from introspection examples
  - [ ] Show how to use generated types with client
- [ ] Update package READMEs with cross-references

### Testing & Validation
- [ ] Create `tests/integration/introspection/` directory
- [ ] Move introspection tests to new directory
- [ ] Create tests for IntrospectionService:
  - [ ] Test getModels()
  - [ ] Test getFields()
  - [ ] Test getModelMetadata()
  - [ ] Test getInstalledModules() (new feature)
  - [ ] Test getModuleModels() (new feature)
- [ ] Create tests for CodeGenerator:
  - [ ] Test interface generation
  - [ ] Test type mapping
  - [ ] Test CLI end-to-end
- [ ] Run full test suite:
  - [ ] `npm install` at root (update workspace links)
  - [ ] `npm run build` (verify all packages build)
  - [ ] `npm test` (verify all tests pass)
- [ ] Verify no broken imports or missing dependencies

## P3 - MCP Server (Week 7-8)

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

Keep the rest of the existing TODO.md content after these sections.