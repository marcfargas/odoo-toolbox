# @marcfargas/odoo-testcontainers

A custom Testcontainers module for Odoo development in Node.js.

## Features

- 🐳 **Fresh containers** for each test run (no shared state!)
- 📦 **Module auto-installation** with dependency resolution  
- 🎯 **High-level presets** for common Odoo setups
- 🔧 **Custom addons support** (mount your own modules)
- ⚡ **Parallel test execution** (each test gets its own Odoo)
- 🧹 **Automatic cleanup** after tests

## Installation

```bash
npm install --save-dev @marcfargas/odoo-testcontainers
```

## Quick Start

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { OdooPresets } from '@marcfargas/odoo-testcontainers';

describe('My Odoo Integration', () => {
  let odoo;

  beforeAll(async () => {
    // Start Odoo with HR modules pre-installed!
    odoo = await OdooPresets.hr();
  }, 300_000); // 5 minute timeout for container startup

  afterAll(async () => {
    await odoo.cleanup();
  });

  it('should create an employee', async () => {
    const employeeId = await odoo.client.create('hr.employee', {
      name: 'Test Employee',
    });
    expect(employeeId).toBeGreaterThan(0);
  });
});
```

## Usage

### Basic Usage

```typescript
import { startOdoo } from '@marcfargas/odoo-testcontainers';

const odoo = await startOdoo({
  modules: ['hr_attendance', 'project', 'sale'],
  database: 'test_db',
  adminPassword: 'admin',
});

// Use the authenticated client
const client = odoo.client;
const records = await client.searchRead('res.partner', []);

// Always cleanup
await odoo.cleanup();
```

### Custom Addons

```typescript
// Single addon directory
const odoo = await startOdoo({
  modules: ['base'],
  addonsPath: './my-custom-addons',
});

// Multiple addon directories  
const odoo = await startOdoo({
  modules: ['base'],
  addonsPath: [
    {
      source: './oca-addons',
      target: '/mnt/oca-addons',
      mode: 'ro',
    },
    {
      source: './custom-addons', 
      target: '/mnt/custom-addons',
      mode: 'ro',
    },
  ],
});
```

### With OCA Modules

```typescript
// Mount OCA server-tools
const odoo = await startOdoo({
  modules: ['base', 'account'],
  addonsPath: './oca-server-tools', // git clone of OCA/server-tools
});

// Now you can install OCA modules
await odoo.moduleManager.installModule('base_technical_user');
```

## Presets

Pre-configured setups for common development scenarios:

```typescript
import { OdooPresets } from '@marcfargas/odoo-testcontainers';

// HR & Attendance
const odoo = await OdooPresets.hr();

// Project Management  
const odoo = await OdooPresets.project();

// Sales & CRM
const odoo = await OdooPresets.sales();

// Manufacturing
const odoo = await OdooPresets.manufacturing();

// Full development environment
const odoo = await OdooPresets.full();

// OCA development
const odoo = await OdooPresets.oca('./oca-server-tools');
```

## API Reference

### startOdoo(options?)

Creates and starts an Odoo testcontainer.

**Options:**
- `modules?: string[]` - Odoo modules to install
- `addonsPath?: string | AddonsMount[]` - Custom addons to mount
- `database?: string` - Database name (default: 'test_odoo')  
- `adminPassword?: string` - Admin password (default: 'admin')
- `env?: Record<string, string>` - Additional environment variables
- `startupTimeout?: number` - Startup timeout in ms (default: 180000)

**Returns:** `StartedOdooContainer`
- `client: OdooClient` - Authenticated Odoo client
- `moduleManager: ModuleManager` - Module management operations
- `url: string` - Odoo URL  
- `database: string` - Database name
- `cleanup(): Promise<void>` - Cleanup function

### AddonsMount

Interface for mounting custom addons:

```typescript
interface AddonsMount {
  source: string;    // Local directory path
  target?: string;   // Mount point in container
  mode?: 'ro' | 'rw'; // Mount mode (default: 'ro')
}
```

## Real-World Example

```typescript
describe('OCA Timesheet Extensions', () => {
  let odoo;

  beforeAll(async () => {
    // Start with project modules + OCA addons
    odoo = await startOdoo({
      modules: ['project', 'hr_timesheet'],
      addonsPath: [
        { source: './oca-project', target: '/mnt/oca-project' },
        { source: './oca-server-tools', target: '/mnt/oca-tools' },
      ],
    });

    // Install OCA modules
    await odoo.moduleManager.installModule('project_task_default_stage');
  }, 300_000);

  afterAll(() => odoo.cleanup());

  it('should create projects with default stages', async () => {
    const projectId = await odoo.client.create('project.project', {
      name: 'Test Project with OCA Extensions',
    });

    const stages = await odoo.client.searchRead('project.task.type', [
      ['project_ids', 'in', [projectId]]
    ]);

    expect(stages.length).toBeGreaterThan(0);
  });
});
```

## Benefits Over Manual Docker

- **Zero configuration** - just specify modules you need
- **Perfect isolation** - no test interference between runs
- **Parallel execution** - each test gets fresh containers  
- **Module presets** - common setups ready to go
- **Health checks** - waits for Odoo to be truly ready
- **Network isolation** - containers can't interfere with each other
- **Automatic cleanup** - no leftover containers or volumes

## Why Use This?

**Current problems with manual Docker:**
- Complex setup and configuration
- Shared database state causes flaky tests  
- Hard to test against specific module combinations
- CI/CD setup is complicated
- No easy way to mount custom addons

**This solves:**
- ✅ **One-line Odoo setup** with any module combination
- ✅ **Perfect test isolation** (fresh containers every time)
- ✅ **Parallel test execution** (no shared state conflicts)  
- ✅ **Reproducible environments** (same containers everywhere)
- ✅ **Easy custom addon mounting** (OCA modules, your own addons)

## Requirements

- Docker Desktop or Docker Engine
- Node.js 24+
- Testcontainers-compatible environment

## License

LGPL-3.0 - Same as Odoo