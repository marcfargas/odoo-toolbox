# @marcfargas/odoo-mcp

Remote-first MCP server for Odoo with policy-based access control.

## Features

- **7 tools**: `odoo_search`, `odoo_get`, `odoo_create`, `odoo_write`, `odoo_delete`, `odoo_discover`, `odoo_model_info`, `odoo_get_related`
- **2 resources**: `odoo://models` (model catalogue), `odoo://modules` (installed modules)
- HTTP transport (`POST /mcp`) — credentials per-request via `X-Odoo-*` headers
- Policy engine: JSON file with ordered glob rules, hot reload (SIGHUP)
- URL whitelist (SSRF protection) — `ODOO_MCP_ALLOWED_URLS` mandatory
- Credential pool with configurable cap (`ODOO_MCP_POOL_MAX_SIZE`)

## How auth works

The server has **no Odoo credentials of its own**. Each MCP client provides its own
Odoo connection via four custom headers on every request. The server validates the URL
against a whitelist and authenticates against Odoo; bad credentials return 401.

```
X-Odoo-Url:      https://prod.mycompany.com
X-Odoo-Db:       mydb
X-Odoo-User:     admin
X-Odoo-Password: secret
```

Authenticated `OdooClient` instances are pooled (keyed by hashed credentials) and
evicted after 30 minutes of idle time.

## Install

```bash
npm install @marcfargas/odoo-mcp
```

## Claude Desktop / Cursor (remote HTTP)

One server, multiple environments:

```json
{
  "mcpServers": {
    "odoo-prod": {
      "url": "https://odoo-mcp.mycompany.com/mcp",
      "headers": {
        "X-Odoo-Url":      "https://prod.mycompany.com",
        "X-Odoo-Db":       "mydb",
        "X-Odoo-User":     "admin",
        "X-Odoo-Password": "secret"
      }
    },
    "odoo-staging": {
      "url": "https://odoo-mcp.mycompany.com/mcp",
      "headers": {
        "X-Odoo-Url":      "https://staging.mycompany.com",
        "X-Odoo-Db":       "staging_db",
        "X-Odoo-User":     "admin",
        "X-Odoo-Password": "secret"
      }
    }
  }
}
```

## Local dev with npx (stdio mode)

Stdio mode reads Odoo credentials from environment variables — no headers needed.

```json
{
  "mcpServers": {
    "odoo-local": {
      "command": "npx",
      "args": ["-y", "@marcfargas/odoo-mcp", "--transport", "stdio"],
      "env": {
        "ODOO_URL":      "https://myodoo.com",
        "ODOO_DB":       "mydb",
        "ODOO_USER":     "mcp_user",
        "ODOO_PASSWORD": "secret"
      }
    }
  }
}
```

## Reverse proxy (nginx reference)

```nginx
location /mcp {
    proxy_pass         http://localhost:3100;
    proxy_http_version 1.1;
    proxy_buffering    off;
    proxy_read_timeout 600s;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Real-IP         $remote_addr;
}
```

## Reverse proxy (Caddy reference)

```caddyfile
odoo-mcp.mycompany.com {
    reverse_proxy /mcp localhost:3100 {
        flush_interval -1
        transport http {
            read_timeout 10m
        }
    }
}
```

## Environment variables

### HTTP transport (required)

| Variable | Required | Default | Description |
|---|---:|---|---|
| `ODOO_MCP_ALLOWED_URLS` | **yes** | — | Comma-separated Odoo base URLs the server will proxy to, e.g. `https://prod.example.com,https://staging.example.com`. Server refuses to start if unset. |
| `ODOO_MCP_PORT` | no | `3100` | HTTP listen port |
| `ODOO_MCP_TRUST_PROXY` | no | `0` | Use leftmost `X-Forwarded-For` when set to `1` |

### stdio transport (required)

| Variable | Required | Description |
|---|---:|---|
| `ODOO_URL` | yes | Odoo base URL |
| `ODOO_DB` | yes | Odoo database |
| `ODOO_USER` | yes | Odoo username |
| `ODOO_PASSWORD` | yes | Odoo password |

### Shared (both transports)

| Variable | Required | Default | Description |
|---|---:|---|---|
| `ODOO_MCP_POLICY_FILE` | no | — | JSON policy file path (hot-reloaded on SIGHUP / file change) |
| `ODOO_MCP_POLICY` | no | read-only default | Inline JSON fallback policy |
| `ODOO_MCP_AUDIT_LOG` | no | — | JSONL audit file path |

## Policy example

```json
[
  { "model": "res.users",  "ops": ["read"] },
  { "model": "sale.*",     "ops": ["read", "write"] },
  { "model": "*",          "ops": ["read"] }
]
```

Rules are evaluated in order; first match wins. Default (empty or missing policy): read-only on all models.

## Security notes

- **Whitelist is mandatory** — `ODOO_MCP_ALLOWED_URLS` prevents using the server as an open Odoo proxy.
- **TLS at the reverse proxy** — the `X-Odoo-Password` header is cleartext in transit; always use HTTPS.
- **Dedicated Odoo user** — each client authenticates as itself; apply Odoo ACLs to limit exposure.
- **Policy as defence-in-depth** — policy restricts operations on top of Odoo's own access rules.

## MCP SDK version

Pinned to `@modelcontextprotocol/sdk@1.27.1`.

## License

LGPL-3.0 — see [LICENSE](./LICENSE).
