# odoo-toolbox Documentation

**odoo-toolbox** is a TypeScript monorepo that provides a production-quality Odoo ERP client, schema introspection tools, and AI agent skills for automating Odoo workflows. It abstracts Odoo's JSON-RPC API behind a typed, ergonomic interface.

> All examples tested against Odoo v17 with `@marcfargas/odoo-client ^0.4`

## Packages

| Package | Description | npm |
|---------|-------------|-----|
| [`@marcfargas/odoo-client`](https://www.npmjs.com/package/@marcfargas/odoo-client) | RPC client, CRUD, services (mail, modules, timesheets, etc.) | Core library |
| [`@marcfargas/odoo-introspection`](https://www.npmjs.com/package/@marcfargas/odoo-introspection) | Schema discovery, TypeScript type generation from live instances | Separate package |
| [`@marcfargas/odoo-cli`](https://www.npmjs.com/package/@marcfargas/odoo-cli) | CLI tool for interacting with Odoo | CLI |

> **Package boundary**: `@marcfargas/odoo-client` and `@marcfargas/odoo-introspection` are **separate npm packages**. Install them independently based on what you need. All `client.*` examples in these docs require only `odoo-client`. Introspection examples require `odoo-introspection`.

## Compatibility

- **Odoo version**: v17 (tested), v16+ should work for core CRUD
- **Library version**: `@marcfargas/odoo-client ^0.4`
- **Node.js**: 18+

## Table of Contents

### Getting Started

- [**Getting Started**](./getting-started.md) — Install, configure, first connection, quick examples

### Client Reference (`@marcfargas/odoo-client`)

- [**Connection**](./client/connection.md) — `createClient()`, multi-instance, environment variables, auth
- [**CRUD Operations**](./client/crud.md) — `create`, `read`, `write`, `unlink`, X2many commands
- [**Search**](./client/search.md) — `searchRead`, `search`, `searchCount`, pagination, ordering
- [**Field Types**](./client/field-types.md) — Type system, Many2one tuples, selection fields, dates
- [**Error Handling**](./client/error-handling.md) — Error classes, patterns, retry strategies

### Services

Service accessors are lazy-loaded domain helpers available on the client via `client.<name>.*`.

| Accessor | Description | Doc |
|----------|-------------|-----|
| `client.mail.*` | Post notes & messages on any record's chatter | [mail.md](./services/mail.md) |
| `client.modules.*` | Install, uninstall, check, upgrade modules | [modules.md](./services/modules.md) |
| `client.attendance.*` | Clock in/out, employee presence | [attendance.md](./services/attendance.md) |
| `client.timesheets.*` | Timer start/stop, log hours on projects | [timesheets.md](./services/timesheets.md) |
| `client.accounting.*` | Cash accounts, GL queries, reconciliation | [accounting.md](./services/accounting.md) |
| `client.properties.*` | Safe operations on dynamic (properties) fields | [properties.md](./services/properties.md) |
| `client.cdc.*` | Change Data Capture — tracked field change history | [cdc.md](./services/cdc.md) |
| `client.urls.*` | Version-agnostic record URL generation | [urls.md](./services/urls.md) |

### Introspection (`@marcfargas/odoo-introspection`)

- [**Schema Discovery**](./introspection/schema-discovery.md) — List models, inspect fields, find relations
- [**TypeScript Codegen**](./introspection/codegen.md) — Generate typed interfaces from live Odoo schema

### Advanced

- [**Domains**](./advanced/domains.md) — Complex filter composition, AND/OR/NOT, date queries, dot notation
- [**Batch Operations**](./advanced/batch-operations.md) — Pagination, bulk create/write, performance tips
- [**Multi-Company**](./advanced/multi-company.md) — `allowed_company_ids` context, access patterns

## Safety Model

Operations are classified by their destructive potential:

| Level | Operations |
|-------|------------|
| **READ** | `search`, `searchRead`, `read`, `searchCount`, `client.modules.isModuleInstalled()`, `client.accounting.*`, `client.urls.*` |
| **WRITE** | `create`, `write`, `client.mail.postInternalNote()`, `client.timesheets.logTime()`, `client.attendance.*`, `client.properties.*` |
| **DESTRUCTIVE** | `unlink` (permanent deletion), `client.mail.postOpenMessage()` (sends emails), `client.modules.installModule()` / `uninstallModule()` (schema changes) |

---

For agent-optimized CLI examples, see the [odoo skill](../skills/odoo/).
