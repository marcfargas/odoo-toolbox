# Testing Framework

## Overview

This document outlines the testing strategy for odoo-toolbox, covering both unit tests and integration tests against live Odoo instances.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Unit Tests (Fast, No Dependencies)             │
│  - Pure logic, mocks, type checking             │
├─────────────────────────────────────────────────┤
│  Integration Tests (Against Live Odoo)          │
│  - Docker Compose orchestration                 │
│  - Multiple Odoo versions (v17, v16, ...)       │
│  - Real RPC calls, schema introspection         │
├─────────────────────────────────────────────────┤
│  CI/CD (GitHub Actions)                         │
│  - Matrix strategy for version testing          │
│  - Parallel execution                           │
│  - Docker layer caching                         │
└─────────────────────────────────────────────────┘
```

## Testing Strategy

### Unit Tests
- **Location**: `packages/*/src/**/*.test.ts`
- **Purpose**: Test pure logic, utilities, type safety
- **Dependencies**: None (mocked)
- **Speed**: Fast (<100ms per test)
- **Run**: `npm run test:unit`

### Integration Tests
- **Location**: `tests/integration/**/*.test.ts`
- **Purpose**: Test against real Odoo instances
- **Dependencies**: Docker Compose with Odoo + PostgreSQL
- **Speed**: Slower (seconds per test)
- **Run**: `npm run test:integration`

## Local Development

### Prerequisites

```bash
# Install dependencies
npm install

# Install Docker Desktop (or Docker Engine + Docker Compose)
# https://docs.docker.com/get-docker/
```

### Running Tests Locally

```bash
# Run unit tests only (fast, no setup needed)
npm run test:unit

# Start Odoo test instances
npm run test:odoo:start

# Wait for instances to be ready (~60 seconds first time)
# Check health: curl http://localhost:8069/web/health

# Run integration tests
npm run test:integration

# Run specific version tests
npm run test:integration -- --testPathPattern=v17

# Watch Odoo logs (in another terminal)
npm run test:odoo:logs

# Stop Odoo instances when done
npm run test:odoo:stop

# Full test suite (unit + integration)
npm run test:full
```

### Fast Iteration Mode

When developing integration tests, you can skip Docker teardown after test runs to speed up iteration:

```bash
# First run - starts containers and runs tests
npm run test:integration:keep-containers

# Subsequent runs - reuses existing containers (much faster!)
npm run test:integration:keep-containers

# When done iterating, clean up containers
npm run docker:down    # Stop containers, keep volumes
npm run docker:clean   # Stop containers, remove volumes
```

**⚠️ Test Pollution Risk**: When using `SKIP_TEARDOWN`, the Odoo database state persists between test runs. This means:
- Data created in test run N may affect test run N+1
- Tests relying on specific initial state may fail if run consecutively
- Test isolation is your responsibility—ensure tests clean up after themselves or run in order

**Best Practice**: Use fast iteration mode only during active development. Before committing, run the full test suite normally (`npm run test:integration`) to ensure tests pass with clean database state.

### Docker Compose Setup

**File**: `docker-compose.test.yml`

**Services**:
- `postgres`: PostgreSQL 15 database
- `odoo17`: Odoo 17.0 on port 8069
- `odoo16`: Odoo 16.0 on port 8016
- (Future: `odoo15`, `odoo14`, etc.)

**Configuration**:
- Health checks ensure services are ready before tests run
- Isolated databases per version
- Volumes for persistence (optional)
- Environment variables for customization

## Integration Test Structure

### Test Helper Utilities

**Location**: `tests/helpers/odoo-instance.ts`

```typescript
// Predefined test instances
export const ODOO_INSTANCES = {
  v17: { url: 'http://localhost:8069', ... },
  v16: { url: 'http://localhost:8016', ... },
};

// Helper functions
- createTestClient(version): Create authenticated client
- waitForOdoo(instance): Wait for Odoo to be ready
- cleanupTestData(client): Remove test records
```

### Test Patterns

```typescript
// Version-parameterized tests
describe.each(['v17', 'v16'])('Feature - Odoo %s', (version) => {
  let client: OdooClient;

  beforeAll(async () => {
    client = await createTestClient(version);
  }, 60000);

  test('should work across versions', async () => {
    // Test implementation
  });
});

// Cleanup pattern
afterEach(async () => {
  // Delete test records created during test
  await client.unlink('res.partner', testRecordIds);
});
```

## CI/CD Integration (GitHub Actions)

### Workflow Structure

**File**: `.github/workflows/test.yml`

**Jobs**:

1. **unit-tests**
   - Fast feedback on every push/PR
   - No Docker dependencies
   - Runs in parallel with integration tests

2. **integration-tests**
   - Matrix strategy for multiple Odoo versions
   - Spins up Docker Compose
   - Waits for health checks
   - Runs version-specific tests
   - Collects Docker logs (configurable)
   - Cleans up containers

### Docker Log Collection

The workflow can collect Docker container logs as artifacts for debugging failed tests.

**Configuration**: When manually triggering the workflow (Actions → tests → Run workflow), choose log collection behavior:
- `on-failure` (default): Collect logs only when integration tests fail
- `always`: Collect logs for every run (useful for debugging intermittent issues)
- `never`: Skip log collection entirely

**What's collected**:
- `odoo.log`: Odoo application server logs
- `postgres.log`: PostgreSQL database logs

**Accessing logs**:
1. Navigate to the failed workflow run in GitHub Actions
2. Scroll to the "Artifacts" section at the bottom
3. Download the `docker-logs` artifact (zip file)
4. Extract and review `odoo.log` and `postgres.log`

**Retention**: Logs are retained for 90 days (GitHub default)

**Typical usage**:
```bash
# Failed test in CI but passes locally?
# 1. Go to the GitHub Actions run
# 2. Download docker-logs artifact
# 3. Check odoo.log for errors:
grep -i error odoo.log
grep -i traceback odoo.log

# 4. Check postgres.log for database issues:
grep -i "fatal\|error" postgres.log
```

### Matrix Strategy

```yaml
strategy:
  matrix:
    odoo-version: ['17', '16']
    # Future: ['17', '16', '15', '14']
```

Benefits:
- Parallel execution across versions
- Clear failure isolation per version
- Easy to add/remove versions

### Environment Variables

Tests can be configured via environment variables:

```bash
# Odoo connection details
ODOO_17_URL=http://localhost:8069
ODOO_17_DB=odoo
ODOO_17_USER=admin
ODOO_17_PASSWORD=admin

# Same pattern for other versions
ODOO_16_URL=http://localhost:8016
ODOO_16_DB=odoo16
...
```

## Test Organization

```
odoo-toolbox/
├── packages/
│   ├── odoo-client/
│   │   ├── src/
│   │   │   ├── client.ts
│   │   │   ├── client.test.ts          # Unit tests
│   │   │   ├── introspection.ts
│   │   │   └── introspection.test.ts   # Unit tests
│   │   └── package.json
│   └── odoo-state-manager/
│       ├── src/
│       │   ├── diff.ts
│       │   └── diff.test.ts            # Unit tests
│       └── package.json
├── tests/
│   ├── helpers/
│   │   ├── odoo-instance.ts            # Test utilities
│   │   └── fixtures.ts                 # Test data
│   └── integration/
│       ├── client.test.ts              # Client integration tests
│       ├── introspection.test.ts       # Schema introspection tests
│       ├── state-manager.test.ts       # State management tests
│       └── multi-version.test.ts       # Cross-version compatibility
├── docker-compose.test.yml             # Test infrastructure
├── jest.config.js                      # Jest configuration
└── TESTING_FRAMEWORK.md               # This file
```

## Jest Configuration

**File**: `jest.config.js`

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/packages/*/src/**/*.test.ts'],
      testTimeout: 5000,
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      testTimeout: 30000,
    },
  ],
};
```

## Advanced Scenarios

### Testing with OCA Modules

To test with specific OCA modules:

1. Create `docker-compose.oca.yml`:

```yaml
services:
  odoo17-oca:
    image: odoo:17
    volumes:
      - ./test-addons:/mnt/extra-addons
    environment:
      ADDONS_PATH: /mnt/extra-addons,/usr/lib/python3/dist-packages/odoo/addons
```

2. Clone OCA modules to `test-addons/`:

```bash
git clone https://github.com/OCA/project.git test-addons/project
```

### Pre-seeding Test Data

Create `tests/fixtures/seed-data.sql`:

```sql
INSERT INTO res_partner (name, email, is_company) 
VALUES ('Test Company', 'test@example.com', true);
```

Mount and execute in Docker Compose:

```yaml
services:
  postgres:
    volumes:
      - ./tests/fixtures:/docker-entrypoint-initdb.d
```

### Testing Different PostgreSQL Versions

Add matrix dimension to GitHub Actions:

```yaml
strategy:
  matrix:
    odoo-version: ['17', '16']
    postgres-version: ['15', '14', '13']
```

### Snapshot Testing for Generated Types

```typescript
test('should generate consistent TypeScript interfaces', async () => {
  const schema = await client.introspect('res.partner');
  const generated = generateInterface(schema);
  expect(generated).toMatchSnapshot();
});
```

## Performance Considerations

### Docker Layer Caching

- Odoo images are ~1GB each
- GitHub Actions caches Docker layers
- First run: ~5 minutes to pull
- Subsequent runs: ~30 seconds to start

### Test Parallelization

```bash
# Run tests in parallel (Jest default)
npm test -- --maxWorkers=4

# CI: GitHub Actions matrix runs versions in parallel
```

### Selective Testing

```bash
# Run only changed packages
npm test -- --onlyChanged

# Run specific test files
npm test -- client.test.ts

# Run tests matching pattern
npm test -- --testPathPattern=integration/client
```

## Troubleshooting

### Odoo Instances Not Starting

```bash
# Check container status
docker-compose -f docker-compose.test.yml ps

# View logs
docker-compose -f docker-compose.test.yml logs odoo17

# Check health
curl http://localhost:8069/web/health

# Recreate containers
docker-compose -f docker-compose.test.yml down -v
docker-compose -f docker-compose.test.yml up -d
```

### CI Test Failures

When integration tests fail in CI but pass locally:

1. **Download Docker logs** from the failed workflow run (see "Docker Log Collection" section above)
2. **Check Odoo logs** for application errors:
   ```bash
   # Look for Python tracebacks, RPC errors, module issues
   grep -i "traceback\|error\|exception" odoo.log
   ```
3. **Check PostgreSQL logs** for database issues:
   ```bash
   # Look for connection issues, constraint violations
   grep -i "fatal\|error\|could not" postgres.log
   ```
4. **Compare timing**: CI might be slower, causing timeouts not seen locally
5. **Check test isolation**: Ensure tests don't depend on execution order

### Tests Timing Out

- Increase Jest timeout in test file: `jest.setTimeout(60000)`
- Check Odoo instance health before running tests
- Verify network connectivity to containers

### Database Connection Issues

```bash
# Check PostgreSQL is ready
docker-compose -f docker-compose.test.yml exec postgres pg_isready -U odoo

# Connect to database
docker-compose -f docker-compose.test.yml exec postgres psql -U odoo -d odoo
```

### Port Conflicts

If ports 8069/8016 are in use:

```yaml
# Modify docker-compose.test.yml
services:
  odoo17:
    ports:
      - "8169:8069"  # Use different host port
```

Update test helpers:

```typescript
ODOO_17_URL: process.env.ODOO_17_URL || 'http://localhost:8169'
```

## Future Enhancements

- [ ] Add Odoo 15, 14 support
- [ ] Test with OCA module dependencies
- [ ] Performance benchmarking suite
- [ ] Visual regression testing for generated code
- [ ] Contract testing between client and state-manager
- [ ] Load testing with multiple concurrent clients
- [ ] Integration with Codecov for coverage reports
- [ ] E2E tests for CLI tools
- [ ] Database migration testing

## Resources

- [Odoo Official Docker Images](https://hub.docker.com/_/odoo)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Jest Documentation](https://jestjs.io/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [OCA Guidelines](https://github.com/OCA/maintainer-tools)

## Alternatives Considered

### ❌ Runboat (OCA's Kubernetes Platform)
- **Pros**: Official OCA solution, production-like
- **Cons**: Kubernetes complexity, overkill for unit testing, requires external service

### ❌ Vagrant
- **Pros**: Full VM isolation
- **Cons**: Slow startup, large resource usage, harder CI integration

### ❌ Mock-only Testing
- **Pros**: Fast, no dependencies
- **Cons**: Doesn't catch real-world integration issues, Odoo behavior varies by version

### ✅ Docker Compose (Chosen)
- **Pros**: Simple, fast, works locally + CI, official images, multi-version support
- **Cons**: Requires Docker installation (acceptable trade-off)

---

**Status**: 🚧 In Development  
**Last Updated**: January 2025  
**Maintainer**: Marc
