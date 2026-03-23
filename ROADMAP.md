# Roadmap

A living document tracking where odoo-toolbox has been and where it's going.
Updated: 2026-03-23.

---

## ✅ Done

**Libraries (`packages/`):**
- [`@marcfargas/odoo-client`](packages/odoo-client) — RPC client with 8 service accessors (mail, modules, accounting, timesheets, attendance, urls, properties, cdc)
- [`@marcfargas/odoo-introspection`](packages/odoo-introspection) — schema discovery + TypeScript codegen
- [`@marcfargas/odoo-testcontainers`](packages/odoo-testcontainers) — Docker-based Odoo test containers with provisioners (absorbed test-harness)
- [`@marcfargas/odoo-state-manager`](packages/odoo-state-manager) — v2: declarative TypeScript DSL (`resource()`, `lookup()`, `model()`), introspection-powered engine, plan/apply/diff CLI

**Targets (`targets/`):**
- [`@marcfargas/odoo-cli`](targets/odoo-cli) — 10 command groups, safety model, domain parser, 4 output formats
- [`@marcfargas/odoo-mcp`](targets/odoo-mcp) — MCP server with 7 tools, policy engine, audit logging, integration tests
- [`claude-odoo-connect`](targets/claude-odoo-connect) — Claude Plugin: skills + MCP for Code and Cowork
- [`claude-odoo-dev`](targets/claude-odoo-dev) — Claude Plugin: dev tools, state management agent

**Distribution (CI-generated):**
- `@marcfargas/odoo-skills` — AI agent skills (5,200+ lines, CC0) — built from root `skills/`

**Infrastructure & docs:**
- Repo reorganized: `packages/` (libraries) + `targets/` (executables/plugins)
- 19 developer documentation files in `docs/`
- Skills rewrite: CLI examples in all skill modules
- pi-package compliance, scope rename to `@marcfargas/*`
- Trusted Publishing (OIDC) + Changesets release automation

---

## 🔄 Current Focus

- **State manager v2 hardening** — integration tests against real Odoo, odoo-cli integration
- **Claude Plugins** — testing and publishing `claude-odoo-connect` and `claude-odoo-dev`

---

## 📋 Next Up

- CLI binary distribution — standalone executables without requiring Node.js
- Additional service coverage: activities, discuss, contracts
- API reference generation from TSDoc comments
- CI for `docs/` testable code blocks

---

## Future

- VS Code extension
- Multi-instance orchestration
- State backends (Git, S3, database)
- Documentation site (if scale warrants it)

---

## Not Now

- Web UI
