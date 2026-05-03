---
"@marcfargas/odoo-testcontainers": patch
---

Widen the `@marcfargas/odoo-client` dependency and peer-dependency ranges from `^0.5.1` to `^0.5.1 || ^0.6.0` so consumers can install `odoo-testcontainers` alongside `odoo-client` 0.6.x without a major version bump on this package.

No code changes — purely a peer-dependency range update to track the additive `OAuthProxyClient` release in `@marcfargas/odoo-client@0.6.0`.
