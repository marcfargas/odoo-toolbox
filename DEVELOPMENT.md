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
git clone https://github.com/your-org/odoo-toolbox.git
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

## Contributing

This is designed as a FOSS project. Code should be:
- Well-typed
- Tested
- Documented (especially Odoo source references!)
- Following the project's design principles

See [AGENTS.md](./AGENTS.md) for implementation patterns and Odoo-specific knowledge.

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
