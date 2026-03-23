# Roadmap

A living document tracking where odoo-toolbox has been and where it's going.
Updated: 2026-02-21.

---

## ✅ Done

**Packages shipped:**
- [`@marcfargas/odoo-client`](packages/odoo-client) — RPC client with 7 service accessors (mail, modules, accounting, timesheets, …)
- [`@marcfargas/odoo-introspection`](packages/odoo-introspection) — schema discovery + TypeScript codegen
- [`@marcfargas/odoo-cli`](targets/odoo-cli) — 10 command groups, safety model, domain parser, 4 output formats
- `@marcfargas/odoo-skills` — AI agent skills for pi (5,200+ lines, CC-BY-4.0) — now CI-generated
- [`@marcfargas/odoo-testcontainers`](packages/odoo-testcontainers) — Docker-based Odoo test containers (includes test harness), all integration tests passing
- [`@marcfargas/odoo-state-manager`](packages/odoo-state-manager) — declarative drift detection + experimental apply

**Infrastructure & docs:**
- 19 developer documentation files in `docs/`
- Skills rewrite: CLI examples in all skill modules
- Verification examples in skills (GH #20)
- Multi-company documentation (GH #18)
- pi-package compliance
- Scope rename to `@marcfargas/*`

---

## 🔄 Current Focus

- **npm publishing** — Trusted Publishing (OIDC) + Changesets release automation
- **Branch merge** — `feat/odoo-cli` → `develop`

---

## 📋 Next Up

- CLI binary distribution — standalone executables without requiring Node.js
- Additional service coverage: activities, discuss, contracts
- API reference generation from TSDoc comments
- CI for `docs/` testable code blocks

---

## Future

- State manager v2: relational fields, nested creation, full plan/apply
- VS Code extension
- Multi-instance orchestration
- Documentation site (if scale warrants it)

---

## Not Now

- Plugin system
- Web UI
- State backends (Git, S3, database)
