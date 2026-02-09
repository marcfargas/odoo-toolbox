# @marcfargas/create-odoo-skills

## 1.0.0

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
