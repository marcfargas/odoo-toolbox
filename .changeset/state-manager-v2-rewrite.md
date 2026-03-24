---
"@marcfargas/odoo-state-manager": minor
---

Complete v2 rewrite — full Terraform-style plan/apply/diff pipeline.

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
