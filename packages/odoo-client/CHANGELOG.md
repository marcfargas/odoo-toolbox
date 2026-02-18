# @marcfargas/odoo-client

## 0.3.0

### Minor Changes

- f0329e0: Add accounting service (`client.accounting.*`) with 9 helpers.
  - Cash account discovery via journal analysis
  - Partner resolution from counterpart move lines
  - Reconciliation status tracing
  - Closing entry detection
  - Days-to-pay computation
  - Cash balance queries
  - Posted journal entry filtering

- f0329e0: Add URL service (`client.urls.*`) for generating version-agnostic record URLs.
  - `client.urls.getRecordUrl()` — direct record URL via `/web#model=...&id=...`
  - `client.urls.getMailRedirectUrl()` — `/mail/view` redirect (works across Odoo versions)
  - `client.urls.getMenuUrl()` — URL with specific menu context
  - Pure URL construction, no RPC calls needed

- f0329e0: Switch mail helpers to use `message_post` with full Odoo behavior.
  - `postInternalNote()` and `postOpenMessage()` now use `message_post` instead of direct `mail.message` create
  - Follower notifications are now sent for open messages (previously silently dropped)
  - Auto-subscribe and post-hooks now execute correctly
  - HTML body preserved via `body_is_html=true`
  - `is_internal=true` explicitly set for notes (message_post does not set it from subtype)

  **Breaking:** Open messages (`postOpenMessage`) now send email notifications to followers. This is the correct Odoo behavior that was previously missing.

## 0.2.0

### Minor Changes

- 8ad2baf: Add attendance and timesheets services with client accessors

  **Attendance** (`client.attendance.*`) — requires `hr_attendance` module:
  - `clockIn()` / `clockOut()` — create/close `hr.attendance` records
  - `getStatus()` — check if employee is currently clocked in
  - `list()` — query attendance records with date and employee filters

  **Timesheets** (`client.timesheets.*`) — requires `hr_timesheet` module:
  - `startTimer()` / `stopTimer()` — timer-based tracking (`unit_amount = 0` = running, `> 0` = closed)
  - `getRunningTimers()` — find entries with active timers
  - `logTime()` — create completed entry with known hours
  - `list()` — query timesheet entries with project, task, and date filters

  Both services auto-resolve the current user's `hr.employee` when `employeeId` is omitted.

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
