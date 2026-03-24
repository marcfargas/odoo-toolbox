---
name: odoo
description: Odoo ERP integration - connect, introspect, and automate your Odoo instance
---

# /odoo

Odoo ERP integration. Two ways to work: **CLI** (fastest for most tasks) and **Library** (for scripts and automation).

## Two Ways to Work with Odoo

### CLI — Fastest for Most Tasks

The `odoo` CLI lets you search, create, update, and delete records without writing any code.

```bash
# 1. Verify connection (always do this first)
odoo config check

# 2. Search records
odoo records search res.partner --fields name,email --limit 5

# 3. Create a record
odoo records create res.partner --data '{"name":"Acme Corp"}' --confirm

# 4. Post a note on a record
odoo mail note crm.lead 42 "Called customer" --confirm
```

### Library — For Scripts and Automation

```typescript
import { createClient } from '@marcfargas/odoo-client';

const client = await createClient();  // reads ODOO_URL, ODOO_DB, ODOO_USER, ODOO_PASSWORD

const partners = await client.searchRead('res.partner', [['is_company', '=', true]], {
  fields: ['name', 'email'],
  limit: 10,
});

await client.mail.postInternalNote('crm.lead', 42, '<p>Called customer.</p>');
await client.modules.isModuleInstalled('sale');
```

---

## Quick Start

### Step 1: Configure Environment

```bash
export ODOO_URL=https://mycompany.odoo.com
export ODOO_DB=mycompany
export ODOO_USER=admin
export ODOO_PASSWORD=yourpassword
```

### Step 2: Verify Connection

```bash
odoo config check
# ✓ Connected to https://mycompany.odoo.com (db: mycompany)
#   User: Administrator (admin) [id: 2]
#   Installed modules: 143
```

### Step 3: Explore

```bash
# Search for records
odoo records search res.partner --fields name,email --limit 10

# Introspect schema
odoo schema fields crm.lead --type many2one

# Check installed modules
odoo modules list --filter installed --search sale
```

---

## CLI Exit Codes

All `odoo` CLI commands use these standard exit codes:

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Usage error (bad flags, missing `--confirm`, invalid arguments) |
| `2` | Auth / network error (wrong credentials, Odoo unreachable) |
| `3` | Not found |
| `4` | Permission denied |
| `5` | Validation error (Odoo rejected the values) |
| `6` | Conflict (e.g., already clocked in) |
| `10` | Partial success |

Use in scripts:
```bash
odoo records get crm.lead 42 || echo "Exit code: $?"
```

---

## CLI Command Reference

| CLI Command | Skill Doc | Description |
|-------------|-----------|-------------|
| `odoo config check/show` | `cli/config.md` | Verify connection, show resolved config |
| `odoo records search/get/create/write/delete/count/call` | `cli/records.md` | Generic CRUD on any model |
| `odoo schema models/fields/describe/codegen` | `base/introspection.md` | Discover models and fields |
| `odoo modules list/install/uninstall/upgrade/info/status` | `base/modules.md` | Manage Odoo modules |
| `odoo url record/portal` | `base/urls.md` | Generate version-agnostic record URLs |
| `odoo mail note/post` | `mail/chatter.md` | Post notes and messages on chatters |
| `odoo attendance clock-in/clock-out/status/list` | `modules/attendance.md` | Employee clock in/out |
| `odoo timesheets start/stop/running/log/list` | `modules/timesheets.md` | Time tracking |
| `odoo accounting cash-accounts/cash-balance/posted-moves/trace-recon/days-to-pay` | `modules/accounting.md` | Read-only accounting queries |
| `odoo state plan/apply/diff` ⚠ | `cli/state.md` | Experimental: state management |

---

## Library API

### Service Accessors

Domain-specific helpers are accessed via lazy getters on the client:

| Accessor | CLI Command | Description | Skill doc |
|----------|-------------|-------------|-----------|
| `client.mail.*` | `odoo mail` | Post notes & messages on chatter | `mail/chatter.md` |
| `client.modules.*` | `odoo modules` | Install, uninstall, check modules | `base/modules.md` |
| `client.urls.*` | `odoo url` | Generate version-agnostic record URLs | `base/urls.md` |
| `client.properties.*` | — | Safe operations for properties fields | `base/properties.md` |
| `client.cdc.*` | — | Change Data Capture — field change history via mail.tracking.value | `modules/cdc.md` |
| `client.accounting.*` | `odoo accounting` | Cash discovery, reconciliation, partner resolution | `modules/accounting.md` |
| `client.attendance.*` | `odoo attendance` | Clock in/out, presence tracking | `modules/attendance.md` |
| `client.timesheets.*` | `odoo timesheets` | Timer start/stop, time logging | `modules/timesheets.md` |

Core CRUD (`searchRead`, `create`, `write`, `unlink`, etc.) stays directly on `client`.

### Safety Model

| Operation | Level | Notes |
|-----------|-------|-------|
| `client.search()`, `searchRead()`, `read()`, `searchCount()` | READ | |
| `client.create()` | WRITE | |
| `client.write()` | WRITE | |
| `client.unlink()` | DESTRUCTIVE | Permanent deletion |
| `client.call()` | VARIES | Depends on method — check per-skill docs |
| `client.mail.postInternalNote()` | WRITE | Internal only, no emails sent |
| `client.mail.postOpenMessage()` | DESTRUCTIVE | Sends email to followers (may be external) |
| `client.modules.isModuleInstalled()` | READ | |
| `client.modules.installModule()` | DESTRUCTIVE | Schema change, hard to rollback |
| `client.modules.uninstallModule()` | DESTRUCTIVE | Deletes module data, irreversible |
| `client.properties.*` | WRITE | Safe property updates, prevents data loss |
| `client.accounting.*` | READ | All accounting helpers are read-only |
| `client.timesheets.logTime()`, `startTimer()`, `stopTimer()` | WRITE | |
| `client.attendance.*` | WRITE | Clock in/out |
| `client.urls.*` | READ | Pure URL construction, no RPC |

---

## Prerequisites (Must Read First)

Before any Odoo operation, load these foundational modules:

1. `base/connection.md` — `createClient()`, authentication, environment variables
2. `base/field-types.md` — Odoo type system (read/write asymmetry)
3. `base/domains.md` — Query filter syntax

---

## Additional Modules

Load as needed by reading `base/{name}.md`:

| Module | CLI Coverage | Description |
|--------|-------------|-------------|
| introspection | `odoo schema` | Discover models & fields |
| crud | `odoo records` | Create, read, update, delete patterns |
| search | `odoo records search` | Search & filtering patterns |
| properties | — | Dynamic user-defined fields |
| modules | `odoo modules` | Module lifecycle management |
| urls | `odoo url` | Version-agnostic record URL generation |
| multi-company | `odoo records search --context` | Multi-company context, `allowed_company_ids`, common gotchas |
| translations | — | Read and write field translations (Odoo 17+, `ir.translation` removed) |
| context-keys | `--context` flag | Mail/chatter context keys: `tracking_disable`, `mail_notrack`, `mail_create_nolog`, etc. |

## Mail & Messaging

Skills for Odoo's mail system. Load by reading `mail/{name}.md`:

| Module | CLI Coverage | Description |
|--------|-------------|-------------|
| chatter | `odoo mail` | Post messages and notes on records (`client.mail.*`) |
| activities | — | Schedule and manage activities/tasks |
| discuss | — | Chat channels and direct messages |

**Note:** The `mail` module is part of base Odoo and is typically always installed.

## Module-Specific Skills

Skills that require specific Odoo modules to be installed. Before loading, verify the required modules are present.

```bash
# CLI: check a module is installed
odoo modules status hr_attendance
```

```typescript
// Library: check a module is installed
await client.modules.isModuleInstalled('hr_attendance')
```

Load by reading the path shown below:

| Skill | Path | CLI Command | Required Modules | Description |
|-------|------|-------------|------------------|-------------|
| accounting | `modules/accounting.md` | `odoo accounting` | `account` | Accounting patterns, cashflow, reconciliation, PnL, validation |
| contracts | `modules/contracts.md` | — | `contract` (OCA) | Recurring contracts, billing schedules, revenue projection |
| attendance | `modules/attendance.md` | `odoo attendance` | `hr_attendance` | Clock in/out, presence tracking (`client.attendance.*`) |
| timesheets | `modules/timesheets.md` | `odoo timesheets` | `hr_timesheet` | Timer start/stop, time logging on projects (`client.timesheets.*`) |
| mis-builder | `oca/mis-builder.md` | — | `mis_builder`, `date_range`, `report_xlsx` | MIS Builder — reading, computing, exporting reports |
| mis-builder-dev | `oca/mis-builder-dev.md` | — | `mis_builder`, `date_range`, `report_xlsx` | MIS Builder — creating & editing report templates |
| product-configurator | `modules/product-configurator.md` | — | `sale_product_configurator` | Product attributes & variants on sale lines — `no_variant`, `price_extra`, custom values |
