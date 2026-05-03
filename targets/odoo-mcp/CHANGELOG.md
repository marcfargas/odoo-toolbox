# @marcfargas/odoo-mcp

## 0.1.4

### Patch Changes

- Updated dependencies [4f08bcb]
  - @marcfargas/odoo-client@0.6.0
  - @marcfargas/odoo-introspection@0.2.1

## 0.1.3

### Patch Changes

- Updated dependencies [0b6a34b]
  - @marcfargas/odoo-introspection@0.2.0

## 0.1.2

### Patch Changes

- 7dc4976: Add Claude plugin targets (`claude-odoo-connect` and `claude-odoo-dev`) and integration tests for odoo-mcp against real Odoo via testcontainers. Fix agent frontmatter and build script cleanup for plugins.
- 7dc4976: Reorganize repository into `packages/` (libraries) and `targets/` (executables). Absorb `odoo-test-harness` into `odoo-testcontainers`. Remove `odoo-skills` from git (now CI-generated).
- Updated dependencies [7dc4976]
  - @marcfargas/odoo-client@0.5.1
  - @marcfargas/odoo-introspection@0.1.5

## 0.1.1

### Patch Changes

- Updated dependencies [5ef273b]
- Updated dependencies [5ef273b]
  - @marcfargas/odoo-client@0.5.0
  - @marcfargas/odoo-introspection@0.1.4

## 0.1.0

### Minor Changes

- 8115998: Initial release of `@marcfargas/odoo-mcp` — a remote-first MCP server for Odoo ERP.

  **Features:**
  - **7 tools**: `odoo_search`, `odoo_get`, `odoo_create`, `odoo_write`, `odoo_delete`, `odoo_discover`, `odoo_model_info`, `odoo_get_related`
  - **2 resources**: `odoo://models` (model catalogue), `odoo://modules` (installed modules)
  - **HTTP transport** (`StreamableHTTPServerTransport`) — remote-first, credentials supplied per-request via `X-Odoo-{Url,Db,User,Password}` headers; no server-side credentials stored
  - **Policy engine** — JSON file with ordered glob rules (first-match-wins); default: read-only on all models
  - **Credential pool** — `OdooClientPool` keyed by `sha256(url+db+user+password)`, capped via `ODOO_MCP_POOL_MAX_SIZE` (default 50)
  - **SSRF protection** — `ODOO_MCP_ALLOWED_URLS` whitelist is mandatory
  - **Schema discovery** — `odoo_discover` and `odoo_model_info` use live introspection via `fields_get`
  - **Docker image** — `ghcr.io/marcfargas/odoo-mcp` (multi-arch: amd64 + arm64)
  - **stdio fallback** — `--transport stdio` for local dev / Claude Desktop direct launch
