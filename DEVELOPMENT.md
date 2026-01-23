# Development Guide

Contributing to odoo-toolbox? Start here. For architectural decisions and implementation patterns, see [AGENTS.md](./AGENTS.md).

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
git clone https://github.com/your-org/odoo-toolbox.git
cd odoo-toolbox
npm install
```

## Testing

Integration tests run against real Odoo instances in Docker. Tests are automated but can be run locally.

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
npm run docker:up

# View logs in another terminal
npm run docker:logs

# Run tests
npm run test:integration

# Stop when done
npm run docker:down

# Full cleanup (removes volumes)
npm run docker:clean
```

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

## Code Guidelines

### Logging

All modules use simple, consistent logging via the `debug` npm package:

```typescript
import debug from 'debug';
const log = debug('odoo-client:client');

log('Connecting to %s', url);
log('Read %d records from %s', count, model);
```

**Namespace Format**: `<package-name>:<functional-part>`

**Examples**:
- `odoo-client:client` - OdooClient main class
- `odoo-client:rpc` - RPC transport layer
- `odoo-client:introspection` - Schema introspection
- `odoo-client:codegen` - Code generation
- `odoo-state-manager:compare` - Diff comparison
- `odoo-state-manager:plan` - Plan generation
- `odoo-state-manager:apply` - Plan execution

Debug output is off by default. Enable it for testing/development:

```bash
# Enable specific module
DEBUG=odoo-client:* npm test

# Enable all odoo-toolbox logging
DEBUG=odoo-* npm test

# Enable everything (verbose)
DEBUG=* npm test
```

### Odoo Source References

When implementing Odoo-specific behavior, **always reference the corresponding Odoo source code**. This is critical because Odoo's behavior is often undocumented.

```typescript
// ✅ GOOD: References Odoo source
/**
 * Set activity type with context variable.
 * Handled in: addons/mail/models/mail_activity.py:_default_activity_type_id()
 * @see https://github.com/odoo/odoo/blob/17.0/addons/mail/models/mail_activity.py#L123
 */
context.default_activity_type_id = activityTypeId;

// ❌ BAD: No source reference
context.default_activity_type_id = activityTypeId;
```

See [AGENTS.md](./AGENTS.md) for detailed patterns.

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
  odoo-client/           # RPC client + introspection + codegen
    src/
      client/            # OdooClient class
      codegen/           # TypeScript generation
      introspection/     # Schema discovery
      rpc/               # RPC transport
      types/             # Type definitions
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
3. Implement feature with Odoo source references
4. Update relevant README in package
5. Update ROADMAP.md with status

### Debugging Tests

```bash
# Keep Docker containers after tests
npm run test:debug

# Docker logs in separate terminal
npm run docker:logs

# Inspect container state
docker-compose -f docker-compose.test.yml exec odoo /bin/bash
```

### Building & Publishing

```bash
# Build all packages
npm run build

# Run all checks (lint, test, type)
npm run check

# Publish to npm (maintainers only)
npm run publish
```

## Resources

- [AGENTS.md](./AGENTS.md) - Architecture and implementation patterns
- [TESTING_FRAMEWORK.md](./TESTING_FRAMEWORK.md) - Detailed testing strategy
- [ROADMAP.md](./ROADMAP.md) - Project roadmap
- [Odoo Source Code](https://github.com/odoo/odoo/tree/17.0)
- [OCA Guidelines](https://github.com/OCA/odoo-community.org)

## Getting Help

- Check existing issues and discussions
- Ask in PRs or issues for architecture questions
- Reference AGENTS.md for implementation patterns
- Search Odoo source code for behavior explanations

---

**Status**: 🚧 Early Development - APIs will change

**Node.js**: 18+  
**TypeScript**: 5.0+  
**Odoo**: v17 (v14+ planned)
