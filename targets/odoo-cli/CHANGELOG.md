# @marcfargas/odoo-cli

## 0.3.2

### Patch Changes

- Updated dependencies [0b6a34b]
  - @marcfargas/odoo-introspection@0.2.0

## 0.3.1

### Patch Changes

- 7dc4976: Reorganize repository into `packages/` (libraries) and `targets/` (executables). Absorb `odoo-test-harness` into `odoo-testcontainers`. Remove `odoo-skills` from git (now CI-generated).
- Updated dependencies [7dc4976]
  - @marcfargas/odoo-client@0.5.1
  - @marcfargas/odoo-introspection@0.1.5

## 0.3.0

### Minor Changes

- 5ef273b: Add CDC (Change Data Capture) service for tracking field-level changes on Odoo records.
  - `client.cdc.check(model)` — verify if a model has mail.tracking enabled and which fields are tracked
  - `client.cdc.getHistory(model, id)` — get full change history for a record with typed events
  - `odoo cdc check <model>` / `odoo cdc history <model> <id>` — CLI commands for CDC operations

### Patch Changes

- 5ef273b: Add 8 nested boolean operator tests for the domain parser, improving coverage for complex `&`/`|` domain expressions.
- Updated dependencies [5ef273b]
- Updated dependencies [5ef273b]
  - @marcfargas/odoo-client@0.5.0
  - @marcfargas/odoo-introspection@0.1.4

## 0.2.0

### Minor Changes

- feat: odoo-cli v0.2.0 — 10 command groups, safety model, domain parser, 4 output formats

  New packages and improvements:
  - **odoo-cli**: Full CLI with records, modules, mail, schema, config, state, attendance, timesheets, accounting, and url commands
  - **odoo-client**: Module install retry for cron lock conflicts, new service accessors (accounting, attendance, timesheets, urls, properties)
  - **odoo-skills**: CLI examples in all skill modules, verification patterns, multi-company guide
  - **odoo-testcontainers**: Improved cleanup resilience, CI-friendly timeouts

### Patch Changes

- Updated dependencies
  - @marcfargas/odoo-client@0.4.2
