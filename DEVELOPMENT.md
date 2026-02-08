# Development Guide

Contributing to odoo-toolbox? Start here. For coding patterns and Odoo-specific knowledge, see [AGENTS.md](./AGENTS.md).

## Development Philosophy

This project follows a batteries-included philosophy:

- **Comprehensive over minimal** - Prefer complete solutions
- **Type-safety first** - Leverage TypeScript fully
- **Pragmatic solutions** - Choose practical over theoretical
- **Great DX** - Developer experience is a feature

## Setting Up for Development

### Prerequisites

- Node.js 18+
- Docker Desktop (for integration tests)
- Git

### Installation

```bash
git clone https://github.com/marcfargas/odoo-toolbox.git
cd odoo-toolbox
npm install
```

## Testing

Integration tests run against real Odoo instances in Docker. Tests are automated but can be run locally.

### Test Execution Order

Always run tests in this order - only proceed to the next step if the previous succeeds:

```bash
npm run lint && npm run test:unit && npm run test:integration
```

**Rationale**:
1. **Lint first** - Catch style/syntax issues before running any tests
2. **Unit tests second** - Fast, no infrastructure, tests core logic
3. **Integration tests last** - Slow, requires Docker, validates against real Odoo instance

This saves time and resources by failing fast on style/logic issues before spinning up containers.

### Quick Start

```bash
# Run all tests (unit + integration, starts Docker automatically)
npm test

# Run only unit tests (no Docker)
npm run test:unit

# Run only integration tests
npm run test:integration
```

### Local Development

```bash
# Start Odoo test environment
npm run odoo:up

# View logs in another terminal
npm run odoo:logs

# Run tests
npm run test:integration

# Stop when done
npm run odoo:down

# Full cleanup (removes volumes)
npm run odoo:clean
```

**Environment variables for test control:**
- `KEEP_CONTAINERS=true` - Keep Docker containers running after tests complete
- `SKIP_TEARDOWN=true` - Skip teardown phase during integration tests

### Configuration

Create `.env.local` from `.env.example`:

```bash
ODOO_URL=http://localhost:8069
ODOO_DB_NAME=odoo
ODOO_DB_USER=admin
ODOO_DB_PASSWORD=admin
TEST_TIMEOUT_MS=30000
LOG_LEVEL=info
KEEP_CONTAINERS=false
```

### Test Structure

- **Unit Tests**: `packages/*/tests/**/*.test.ts` - Fast, no infrastructure
- **Integration Tests**: `packages/*/tests/**/*.integration.test.ts` - Against real Odoo
- **Test Helpers**: `tests/helpers/` - Shared utilities and setup

### Managing Modules in Tests

The test helpers include utilities for managing modules during testing:

```typescript
import { installModuleForTest, uninstallModuleForTest, cleanupInstalledModules } from '../../../tests/helpers/odoo-instance';
import { ModuleManager } from '@odoo-toolbox/client';

describe('My Test Suite', () => {
  let moduleManager: ModuleManager;
  const installedModules: string[] = [];

  beforeAll(async () => {
    // ... setup client and moduleManager
  });

  afterAll(async () => {
    // Cleanup all installed modules
    await cleanupInstalledModules(moduleManager, installedModules);
  });

  it('should work with project module', async () => {
    // Install module for test (tracks for cleanup)
    await installModuleForTest(moduleManager, 'project', installedModules);
    
    // ... your test code
  });
});
```

### CLI Module Management

Manage modules from the command line:

```bash
# List installed modules
npm run odoo:addon:list installed

# Get module information
npm run odoo:addon:info project

# Install a module (useful for testing specific scenarios)
npm run odoo:addon:install project

# Uninstall a module
npm run odoo:addon:uninstall project
```

Environment variables (defaults shown):
```bash
export ODOO_URL=http://localhost:8069
export ODOO_DB_NAME=odoo
export ODOO_DB_USER=admin
export ODOO_DB_PASSWORD=admin
```

### Programmatic Module Management

For programmatic usage in your code:

```typescript
import { OdooClient, ModuleManager } from '@odoo-toolbox/client';

const client = new OdooClient({ /* config */ });
await client.authenticate();

const moduleManager = new ModuleManager(client);
await moduleManager.installModule('project');
await moduleManager.uninstallModule('project');
```

See [packages/odoo-client/examples/5-module-management.ts](./packages/odoo-client/examples/5-module-management.ts) for complete examples.

### Test Infrastructure Guidelines

**Test Helper Location:**
- Test helpers belong in `tests/helpers/`, NOT `test/` (singular)
- The project uses `tests/` (plural) for all test-related code

**Docker Test Environment:**
- Let Docker images handle their own initialization - don't build workarounds in test code
- Fix issues at the source (docker-compose.test.yml) rather than working around them in helpers
- Odoo auto-initializes its database via `--init base` command in docker-compose
- Docker healthchecks ensure services are ready; no manual polling needed
- If tests fail due to infrastructure, fix docker-compose.test.yml, not the test helpers

**Debugging Test Infrastructure:**
- Check `docker-compose logs odoo` to see Odoo initialization messages
- Odoo logs "HTTP service (werkzeug) running on..." when ready
- Healthcheck `/web/health` confirms Odoo can serve HTTP requests

## Code Guidelines

For detailed coding patterns, logging conventions, and Odoo-specific implementation guidelines, see [AGENTS.md](./AGENTS.md).

### Type Safety

- Prefer explicit interfaces over `any`
- Generate types from live Odoo schemas
- Document field constraints (required, readonly, relations)

### Error Handling

- Wrap Odoo RPC errors with context
- Provide helpful messages for common issues
- Include recovery suggestions where possible

## Project Structure

```
packages/
  odoo-client/           # RPC client
    src/
      client/            # OdooClient class
      rpc/               # RPC transport
      types/             # Type definitions
  odoo-introspection/    # Schema introspection + codegen
    src/
      introspection/     # Schema discovery
      codegen/           # TypeScript generation
      cli/               # CLI tool
  odoo-state-manager/    # Drift detection + plan/apply
    src/
      compare/           # Deep diff logic
      plan/              # Plan generation
      apply/             # Apply execution
tests/
  helpers/               # Shared test utilities
examples/                # Usage examples
```

## Common Tasks

### Adding a New Feature

1. Create feature branch
2. Add tests (unit first, integration if needed)
3. Implement feature with Odoo source references (see [AGENTS.md](./AGENTS.md))
4. Update relevant README in package
5. Update ROADMAP.md with status

### Debugging Tests

```bash
# Keep Docker containers after tests
KEEP_CONTAINERS=true npm run test:integration

# Docker logs in separate terminal
npm run odoo:logs

# Inspect container state
docker-compose -f docker-compose.test.yml exec odoo /bin/bash
```

### Building & Publishing

```bash
# Build all packages
npm run build

# Run all checks (lint, test, type)
npm run check
```

## Building the Skills Zip

The `odoo-skills.zip` contains a ready-to-use skill project for AI agents.

### Build Locally

```bash
# Build everything (packages + skills zip)
npm run build:dist

# Or just the skills zip (requires packages to be built first)
npm run build:skills-zip
```

Output: `dist/odoo-skills.zip`

### CI Artifacts

Every CI run builds and uploads `odoo-skills.zip` as an artifact. Download from the [Actions tab](https://github.com/marcfargas/odoo-toolbox/actions).

## Publishing a New Release

> **Note**: Automated releases are not yet configured. This section documents the current manual workflow.

### Manual Release (current)

Until automated releases are set up:

1. Update version in `package.json` files
2. Build: `npm run build`
3. Build skills zip: `npm run build:skills-zip`
4. Create GitHub release manually with `dist/odoo-skills.zip`
5. Publish to npm: `npm publish --workspace=packages/odoo-client` (etc.)

### Future: Changesets

We plan to use [Changesets](https://github.com/changesets/changesets) for version management:

```bash
# Create a changeset describing your changes
npm run changeset

# Bump versions and update changelogs
npm run version

# Build and publish to npm
npm run release
```

## Contributing

This is designed as a FOSS project. Code should be:
- Well-typed
- Tested
- Documented (especially Odoo source references!)
- Following the project's design principles

See [AGENTS.md](./AGENTS.md) for implementation patterns and Odoo-specific knowledge.

## Documentation & Examples

| Document | Audience | Purpose |
|----------|----------|---------|
| [packages/create-skills/assets/](./packages/create-skills/assets/) | AI Agents | Tested examples and knowledge base for Odoo patterns |
| [packages/odoo-client/examples](./packages/odoo-client/examples/) | Users | Client examples: connection, CRUD, search, context, modules |
| [packages/odoo-introspection/examples](./packages/odoo-introspection/examples/) | Users | Introspection examples: schema discovery, type generation |
| [packages/odoo-state-manager/examples](./packages/odoo-state-manager/examples/) | Users | State manager examples: drift detection, plan/apply |
| [AGENTS.md](./AGENTS.md) | AI Assistants | Coding patterns, Odoo knowledge |
| [ROADMAP.md](./ROADMAP.md) | All | Future vision and design decisions |
| [TODO.md](./TODO.md) | Contributors | Implementation tasks |

## Resources

- [AGENTS.md](./AGENTS.md) - Coding patterns and Odoo knowledge
- [ROADMAP.md](./ROADMAP.md) - Project roadmap
- [Odoo Source Code](https://github.com/odoo/odoo/tree/17.0)
- [OCA Guidelines](https://github.com/OCA/odoo-community.org)

## Getting Help

- Check existing issues and discussions
- Ask in PRs or issues for architecture questions
- Reference AGENTS.md for implementation patterns
- Search Odoo source code for behavior explanations

---

**Status**: Early Development - APIs will change
**Node.js**: 18+ | **TypeScript**: 5.0+ | **Odoo**: v17 (v14+ planned)
