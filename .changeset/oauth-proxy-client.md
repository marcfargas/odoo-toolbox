---
"@marcfargas/odoo-client": minor
---

Add `OAuthProxyClient` — a sibling client to `OdooClient` that talks to an OAuth-fronted Odoo proxy (`odoo-api-proxy` v1.0) using `Authorization: Bearer <token>` per-request, never calls `common.login`, and never sends session cookies.

Surface (CRUD parity with `OdooClient`):

- `search`
- `read`
- `searchRead`
- `create`
- `write`
- `unlink`
- `searchCount`
- `call`

```typescript
new OAuthProxyClient({ proxyBaseUrl, getAccessToken: () => Promise<string> })
```

The shared CRUD contract is captured by the new `OdooCrudClient` interface — both `OdooClient` and `OAuthProxyClient` implement it, so call sites can program against the abstraction and swap providers with only a constructor change.

Also exports the new `BearerJsonRpcTransport` for advanced users who want to drive the proxy with a custom client. Service accessors (mail, modules, accounting, etc.) remain on `OdooClient` only — `OAuthProxyClient` ships with CRUD + raw `call` in v1. Existing `OdooClient` callers are unaffected; this is a purely additive release.
