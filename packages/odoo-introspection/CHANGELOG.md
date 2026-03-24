# @marcfargas/odoo-introspection

## 0.1.5

### Patch Changes

- 7dc4976: Reorganize repository into `packages/` (libraries) and `targets/` (executables). Absorb `odoo-test-harness` into `odoo-testcontainers`. Remove `odoo-skills` from git (now CI-generated).
- Updated dependencies [7dc4976]
  - @marcfargas/odoo-client@0.5.1

## 0.1.4

### Patch Changes

- Updated dependencies [5ef273b]
- Updated dependencies [5ef273b]
  - @marcfargas/odoo-client@0.5.0

## 0.1.3

### Patch Changes

- Updated dependencies [e30750a]
  - @marcfargas/odoo-client@0.4.0

## 0.1.2

### Patch Changes

- Updated dependencies [f0329e0]
- Updated dependencies [f0329e0]
- Updated dependencies [f0329e0]
  - @marcfargas/odoo-client@0.3.0

## 0.1.1

### Patch Changes

- Updated dependencies [8ad2baf]
  - @marcfargas/odoo-client@0.2.0

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
