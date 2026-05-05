---
"@marcfargas/odoo-testcontainers": patch
---

Cache `startOdoo()` database baselines as local `pg_dump` snapshots keyed by the requested Odoo version, modules, addon contents, database settings, and environment.

The first start for a cache key still initializes Odoo and installs requested modules. Later starts restore the saved database snapshot into a fresh Postgres container and skip Odoo `--init` plus module installation, which speeds up repeated integration test runs without requiring consumers to depend on project-specific seed images.

The old seed database image path and CI seed image workflow were removed.
