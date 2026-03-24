---
"@marcfargas/odoo-cli": patch
"@marcfargas/odoo-testcontainers": patch
"@marcfargas/odoo-mcp": patch
"@marcfargas/odoo-client": patch
"@marcfargas/odoo-introspection": patch
---

Reorganize repository into `packages/` (libraries) and `targets/` (executables). Absorb `odoo-test-harness` into `odoo-testcontainers`. Remove `odoo-skills` from git (now CI-generated).
