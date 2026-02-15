# Roadmap

## Active Focus

- Expand knowledge modules (new Odoo modules, broader OCA coverage)
- Client enhancements (retry logic, better error messages, batch operations)
- Improve create-skills CLI (instance detection, better scaffolding)

## Next Up

- Type-safe domain selectors (generated per model, fluent builder API)
- Selection field union type generation
- Improved error handling (parse Odoo errors, categorize, suggest fixes)
- Multi-version support (v14+)

## Future

- **CLI for service helpers** (`@marcfargas/odoo-cli`) — expose client services as shell commands for scripting and debugging. Potential commands:
  - `odoo mail note/message` — post to chatter from shell/CI
  - `odoo modules list/install/uninstall` — module management (migrate from dev scripts)
  - `odoo accounting trace-recon` — reconciliation debugging
  - `odoo accounting cash-balance --as-of YYYY-MM-DD --json` — monitoring/dashboards
  - Follow patterns from `gh`, `gcloud`, `aws` CLIs (subcommands, JSON output, scriptable)
  - Wait for demand signals before building — programmatic API + dev scripts sufficient for now
- State manager: plan/apply workflow (drift detection exists, apply is experimental)
- Relational field handling in desired state (by ID, search criteria, nested creation)
- npm publishing and release automation (Changesets)
- Documentation site

## Not Now

- VS Code extension
- Plugin system
- Web UI for drift visualization
- Multi-instance orchestration
- State backends (Git, S3, database)

---

Revisit when: completing a milestone, monthly during active development, or when new requirements emerge from usage.
