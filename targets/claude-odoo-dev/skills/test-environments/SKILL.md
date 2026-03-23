---
name: Odoo Test Environments
description: This skill should be used when the user asks to "spin up a test Odoo", "create a test environment", "run integration tests against Odoo", "set up testcontainers for Odoo", "provision test data", or mentions Docker-based Odoo testing.
version: 0.1.0
---

# Odoo Test Environments

Spin up fresh, isolated Odoo instances for testing using Testcontainers. Each test run gets its own PostgreSQL + Odoo container with automatic cleanup.

## Installation

```bash
npm install @marcfargas/odoo-testcontainers @marcfargas/odoo-client
```

## Quick Start

```typescript
import { startOdoo } from '@marcfargas/odoo-testcontainers';

const container = await startOdoo({
  version: '17.0',
  modules: ['sale', 'purchase'],
});

// container.url, container.database, container.username, container.password
// Use with createClient() from @marcfargas/odoo-client

await container.stop();
```

## Presets

Pre-configured module sets for common scenarios:

```typescript
import { startOdoo, OdooPresets } from '@marcfargas/odoo-testcontainers';

await startOdoo({ ...OdooPresets.hr });        // hr, hr_attendance, hr_timesheet
await startOdoo({ ...OdooPresets.sales });      // sale, sale_management, crm
await startOdoo({ ...OdooPresets.accounting }); // account, account_payment
await startOdoo({ ...OdooPresets.project });    // project, project_todo
await startOdoo({ ...OdooPresets.full });       // all common modules
```

## Custom Addons

Mount local addon directories into the container:

```typescript
await startOdoo({
  version: '17.0',
  addons: [{ hostPath: './my-addons', containerPath: '/mnt/extra-addons' }],
  modules: ['my_custom_module'],
});
```

## Seed Database

For faster startup (~15s vs ~3min), use a pre-seeded database image:

```bash
export ODOO_SEED_IMAGE=ghcr.io/marcfargas/odoo-test-db:17.0-abc123
```

The toolbox CI builds seed images weekly. Configure in `docker/seed-config.json`.

## Provisioners

Opt-in helpers for creating test data shapes:

```typescript
import {
  provisionPartners,
  provisionProjects,
  provisionUsers,
  provisionModules,
  provisionPartnerCategories,
  provisionTaskProperties,
} from '@marcfargas/odoo-testcontainers';
```

Each provisioner takes an authenticated `OdooClient` and a configuration object. They handle dependency ordering (e.g., partner categories before partners, projects before tasks).

## Vitest Integration

```typescript
// vitest.integration.config.mts
export default defineConfig({
  test: {
    globalSetup: './tests/helpers/globalSetup.ts',
    include: ['tests/**/*.integration.test.ts'],
    pool: 'forks',
    fileParallelism: false,
  },
});
```

The global setup starts containers once, sets env vars, and tears down after all tests complete.

## Supported Versions

Odoo 17, 18, and 19 are tested in CI. Specify the version in `startOdoo({ version: '18.0' })`.
