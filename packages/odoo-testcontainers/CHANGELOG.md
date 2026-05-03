# @marcfargas/odoo-testcontainers

## 0.1.4

### Patch Changes

- 8bbcfc3: Widen the `@marcfargas/odoo-client` dependency and peer-dependency ranges from `^0.5.1` to `^0.5.1 || ^0.6.0` so consumers can install `odoo-testcontainers` alongside `odoo-client` 0.6.x without a major version bump on this package.

  No code changes — purely a peer-dependency range update to track the additive `OAuthProxyClient` release in `@marcfargas/odoo-client@0.6.0`.

- Updated dependencies [4f08bcb]
  - @marcfargas/odoo-client@0.6.0

## 0.1.3

### Patch Changes

- 7dc4976: Reorganize repository into `packages/` (libraries) and `targets/` (executables). Absorb `odoo-test-harness` into `odoo-testcontainers`. Remove `odoo-skills` from git (now CI-generated).
- Updated dependencies [7dc4976]
  - @marcfargas/odoo-client@0.5.1

## 0.1.2

### Patch Changes

- 103052a: Fix "network has active endpoints" error during container cleanup.

  Use Docker API directly to force-disconnect all containers from the network before removal, handling both tracked containers and orphans (e.g. a half-started Odoo container that failed during startup). Replaces fragile timeout-based delays with deterministic force-disconnect calls.

## 0.1.1

### Patch Changes

- feat: odoo-cli v0.2.0 — 10 command groups, safety model, domain parser, 4 output formats

  New packages and improvements:
  - **odoo-cli**: Full CLI with records, modules, mail, schema, config, state, attendance, timesheets, accounting, and url commands
  - **odoo-client**: Module install retry for cron lock conflicts, new service accessors (accounting, attendance, timesheets, urls, properties)
  - **odoo-skills**: CLI examples in all skill modules, verification patterns, multi-company guide
  - **odoo-testcontainers**: Improved cleanup resilience, CI-friendly timeouts

- Updated dependencies
  - @marcfargas/odoo-client@0.4.2
