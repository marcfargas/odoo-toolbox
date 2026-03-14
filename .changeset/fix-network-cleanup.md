---
"@marcfargas/odoo-testcontainers": patch
---

Fix "network has active endpoints" error during container cleanup.

Use Docker API directly to force-disconnect all containers from the network before removal, handling both tracked containers and orphans (e.g. a half-started Odoo container that failed during startup). Replaces fragile timeout-based delays with deterministic force-disconnect calls.
