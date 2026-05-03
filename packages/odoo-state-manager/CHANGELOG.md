# @marcfargas/odoo-state-manager

## 0.4.1

### Patch Changes

- Updated dependencies [4f08bcb]
  - @marcfargas/odoo-client@0.6.0
  - @marcfargas/odoo-introspection@0.2.1

## 0.4.0

### Minor Changes

- 0b6a34b: Add a rich content pipeline and translated-field support to the plan/apply engine.

  **DSL marker functions** — `md()`, `mdFile()`, `translated()`, `withCss()`, and `html()` let you express content intent directly in resource definitions.

  **Transform phase** — a new pipeline stage converts markers to Odoo-ready values: Markdown is rendered to HTML via `marked`, CSS is inlined with `juice`, translated fields are extracted into per-language write operations, and sanitization heuristics emit warnings for fields that may strip markup.

  **Translated fields** — `plan()` diffs each active language separately and `apply()` writes each language using `context: { lang }`. Plan output shows per-language changes alongside sanitization warnings.

  **Post-apply verification** — after `apply()` completes, `plan()` is re-run automatically to detect any drift between the declared state and what Odoo actually persisted.

  **Instance language detection** — the engine auto-detects active languages from the Odoo instance.

  **Many2many resolution** — `lookup()` references and inline `ResourceRef` values are now resolved inside many2many arrays.

  **`mdFile()` frontmatter stripping** — YAML frontmatter is stripped by default when rendering file-backed Markdown, preventing it from appearing in Odoo HTML output.

### Patch Changes

- Updated dependencies [0b6a34b]
  - @marcfargas/odoo-introspection@0.2.0

## 0.3.0

### Minor Changes

- 7dc4976: Complete v2 rewrite — full Terraform-style plan/apply/diff pipeline.

  The state manager is rebuilt from scratch with a clean engine architecture:
  - DSL helpers: `resource()`, `lookup()`, `model()` for defining desired state in TypeScript project files
  - `evaluate()` — loads `.ts` project files at runtime
  - `resolve()` — batch lookup resolution against live Odoo
  - `diff` engine — compares desired vs actual state with Odoo field normalization
  - `plan` engine — generates Terraform-style formatted change plans
  - `apply` engine — batched execution with progress tracking
  - `introspect` engine — dependency graph and module validation
  - Full pipeline wiring: `plan()`, `apply()`, `diff()` top-level functions
  - CLI commands: `plan`, `apply`, `diff`, `init`

### Patch Changes

- Updated dependencies [7dc4976]
  - @marcfargas/odoo-client@0.5.1
  - @marcfargas/odoo-introspection@0.1.5

## 0.1.4

### Patch Changes

- Updated dependencies [5ef273b]
- Updated dependencies [5ef273b]
  - @marcfargas/odoo-client@0.5.0
  - @marcfargas/odoo-introspection@0.1.4

## 0.1.3

### Patch Changes

- Updated dependencies [e30750a]
  - @marcfargas/odoo-client@0.4.0
  - @marcfargas/odoo-introspection@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies [f0329e0]
- Updated dependencies [f0329e0]
- Updated dependencies [f0329e0]
  - @marcfargas/odoo-client@0.3.0
  - @marcfargas/odoo-introspection@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies [8ad2baf]
  - @marcfargas/odoo-client@0.2.0
  - @marcfargas/odoo-introspection@0.1.1

## 0.2.0

### Minor Changes

- 6388e0f: Initial release of the odoo-toolbox monorepo.

  ### @marcfargas/odoo-client

  TypeScript RPC client for Odoo with safety guards and service accessors.
  - `createClient()` one-liner: reads env vars, authenticates, ready to use
  - Core CRUD: `searchRead`, `search`, `create`, `write`, `unlink`, `read`, `searchCount`
  - `client.mail.postInternalNote()` / `client.mail.postOpenMessage()` — chatter helpers
  - `client.modules.isModuleInstalled()` / `client.modules.installModule()` — module management
  - Safety context for dangerous operations (unlink, bulk write)
  - Comprehensive error types: `OdooAuthError`, `OdooNetworkError`, `OdooValidationError`

  ### @marcfargas/odoo-introspection

  Schema discovery and TypeScript code generation for Odoo models.
  - `Introspector` class: list models, get fields, filter by module
  - `CodeGenerator`: generate TypeScript interfaces from live Odoo schemas
  - CLI: `odoo-introspect` for command-line schema discovery

  ### @marcfargas/odoo-state-manager

  Terraform-style drift detection and plan/apply workflow for Odoo configuration.
  - Compare desired state against live Odoo instance
  - Generate execution plans with human-readable diffs
  - Apply plans with dry-run support
  - Experimental — API may change

  ### @marcfargas/odoo-skills

  Battle-tested Odoo knowledge modules for AI agents (CC0-1.0 — public domain).
  - 5,200+ lines of progressive documentation: connection, CRUD, search, domains, fields, properties, modules
  - Mail system: chatter, activities, discuss channels
  - Module-specific: timesheets, accounting, MIS Builder (OCA)
  - All code examples validated against real Odoo v17 in CI
  - Load via `SKILL.md` router — agents pick what they need on demand

  ### @marcfargas/create-odoo-skills

  CLI to scaffold Odoo skill projects for AI agents.
  - `npx @marcfargas/create-odoo-skills my-project` — scaffold a complete skill project
  - Ships bundled knowledge modules from `@marcfargas/odoo-skills`
  - Skill validation and reference checking
  - Testable code blocks verified against real Odoo v17 in CI

### Patch Changes

- Updated dependencies [6388e0f]
  - @marcfargas/odoo-client@0.2.0
  - @marcfargas/odoo-introspection@0.2.0
