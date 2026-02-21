# `@marcfargas/odoo-cli`

[![npm](https://img.shields.io/npm/v/@marcfargas/odoo-cli)](https://www.npmjs.com/package/@marcfargas/odoo-cli)
[![License: LGPL-3.0](https://img.shields.io/badge/License-LGPL--3.0-blue.svg)](https://www.gnu.org/licenses/lgpl-3.0)

Command-line interface for Odoo ERP — query records, post chatter messages, manage modules, track time, inspect schema, and more. Built on [`@marcfargas/odoo-client`](../odoo-client).

---

## Installation

```bash
npm install -g @marcfargas/odoo-cli
```

Installs the `odoo` binary (also available as `odoo-cli`).

---

## Configuration

All commands read credentials from environment variables. Set them once in your shell profile:

```bash
export ODOO_URL=https://mycompany.odoo.com
export ODOO_DB=mycompany
export ODOO_USERNAME=admin@example.com
export ODOO_PASSWORD=secret
```

| Variable | Description | CLI flag override |
|---|---|---|
| `ODOO_URL` | Odoo base URL | `--url` |
| `ODOO_DB` | Database name | `--db` |
| `ODOO_USERNAME` | Login username | `--user` |
| `ODOO_PASSWORD` | Password | `--password` |

Verify your connection:

```bash
odoo config check
odoo config show          # shows resolved config (password redacted)
odoo config show --format json
```

> **Note:** Prefer environment variables over CLI flags — flags appear in shell history.

---

## Quick Start

```bash
# Search records with filters
odoo records search crm.lead --fields id,name,stage_id --limit 20
odoo records search res.partner --filter active=true --format csv > partners.csv

# Post an internal note on a record
odoo mail note crm.lead 42 "Called customer, following up next week" --confirm

# Stream all invoices as newline-delimited JSON
odoo records search account.move --domain '[("state","=","posted")]' --all --format ndjson \
  > invoices.ndjson

# Generate a TypeScript interface for a model
odoo schema codegen sale.order --out ./types/sale-order.ts
```

---

## Commands Reference

### `odoo config` — Connection management

```
odoo config check           Verify connection and show current user [READ]
odoo config show            Show resolved config (password redacted) [READ]
```

### `odoo records` — Generic CRUD on any Odoo model

```
odoo records search <model>           Filter and list records [READ]
odoo records get <model> <id>         Fetch a single record [READ]
odoo records count <model>            Count matching records [READ]
odoo records create <model>           Create a record [WRITE]
odoo records write <model> <ids>      Update records — batch by comma-separated IDs [WRITE]
odoo records delete <model> <ids>     Delete records [DESTRUCTIVE]
odoo records call <model> <method>    Call an arbitrary model method [WRITE]
```

`search` supports rich filtering:

```bash
# Odoo domain syntax
odoo records search sale.order --domain '[("state","=","sale")]'

# JSON domain
odoo records search sale.order --domain-json '[["state","=","sale"]]'

# Simple K=V shorthand (ANDed, repeatable)
odoo records search res.partner --filter active=true --filter country_id.code=ES

# Domain from file or stdin
odoo records search crm.lead --domain-file filter.json

# Pagination
odoo records search res.partner --limit 200 --offset 0 --order "name asc"
odoo records search account.move --all --page-size 500   # fetches everything, paged
```

`call` invokes arbitrary ORM methods:

```bash
odoo records call sale.order action_confirm --ids 42 --confirm
odoo records call sale.order get_delivery_count --ids 42 --read-only   # no --confirm needed
```

### `odoo mail` — Chatter messages

```
odoo mail note <model> <id> [message]   Post internal note — staff only [WRITE]
odoo mail post <model> <id> [message]   Post public message — notifies followers [WRITE]
```

```bash
odoo mail note crm.lead 42 "Meeting rescheduled" --confirm
odoo mail post sale.order 88 "Your order has shipped" --confirm

# HTML body
odoo mail note project.task 17 "<p>Build <strong>passed</strong></p>" --html --confirm

# Read message from file or stdin
git log --oneline -5 | odoo mail note project.task 17 --message-file - --confirm

# With subject and explicit partner notifications
odoo mail post crm.lead 42 --subject "Contract ready" --partner-ids 7,15 "See attached." --confirm
```

### `odoo modules` — Module management

```
odoo modules list               List modules [READ]
odoo modules info <name>        Show module metadata [READ]
odoo modules status <name>      Print single-word state — for scripting [READ]
odoo modules install <name>     Install a module [WRITE]
odoo modules upgrade <name>     Upgrade a module [WRITE]
odoo modules uninstall <name>   Uninstall — may remove data [DESTRUCTIVE]
```

```bash
odoo modules list --filter installed
odoo modules list --search sale --format json | jq '.[].technical_name'
odoo modules status hr_timesheet   # prints: installed

if [ "$(odoo modules status my_addon)" = "installed" ]; then echo ready; fi
```

### `odoo attendance` — Clock in/out  *(requires `hr_attendance`)*

```
odoo attendance clock-in       Record clock-in [WRITE]
odoo attendance clock-out      Record clock-out [WRITE]
odoo attendance status         Show current attendance status [READ]
odoo attendance list           List records by date range [READ]
```

```bash
odoo attendance clock-in --confirm
odoo attendance status
odoo attendance list --from 2024-03-11 --to 2024-03-15 --format csv
```

Use `--employee-id <n>` or `--employee <name>` to act on behalf of another employee (default: current user).

### `odoo timesheets` — Time tracking  *(requires `hr_timesheet`)*

```
odoo timesheets start          Start a timer [WRITE]
odoo timesheets stop           Stop running timer [WRITE]
odoo timesheets running        Show running timer [READ]
odoo timesheets log            Log time retroactively [WRITE]
odoo timesheets list           List timesheet entries [READ]
```

```bash
# Timer workflow
odoo timesheets start --task-id 42 --description "Feature work" --confirm
odoo timesheets running
odoo timesheets stop --confirm

# Manual entry
odoo timesheets log --task-id 42 --hours 1.5 --description "Review PR" --confirm
```

### `odoo accounting` — Read-only accounting queries  *(requires `account`)*

All commands are READ-only — no `--confirm` required.

```
odoo accounting cash-accounts         Discover cash/bank journal accounts
odoo accounting cash-balance          Show balance as-of a date
odoo accounting posted-moves          List posted journal entries
odoo accounting trace-recon <id>      Show reconciliation for a move
odoo accounting days-to-pay <id>      Payment term analysis for an invoice
```

```bash
odoo accounting cash-balance --as-of 2024-03-31
odoo accounting posted-moves --from 2024-01-01 --to 2024-03-31 --format csv
```

### `odoo url` — Generate record URLs

```
odoo url record <model> <id>    Backend URL [READ]
odoo url portal <model> <id>    Portal URL [READ]
```

```bash
URL=$(odoo url record project.task 17)
odoo mail note project.task 17 "Deployed: $URL" --confirm
```

### `odoo schema` — Runtime schema introspection

Wraps [`@marcfargas/odoo-introspection`](../odoo-introspection). All commands are READ.

```
odoo schema models              List all models
odoo schema fields <model>      List fields for a model
odoo schema describe <model>    Human-readable model summary
odoo schema codegen <model>     Generate TypeScript interface
```

```bash
odoo schema models --search sale
odoo schema fields crm.lead --type many2one
odoo schema describe res.partner
odoo schema codegen sale.order --out ./types/sale-order.ts
```

### `odoo state` — ⚠ Experimental state management

Declare desired Odoo configuration, plan drift, and apply — similar to Terraform. All commands require `--experimental`.

```
odoo state plan <file>     Show drift between desired and current [READ]
odoo state diff <model>    Show current state of a model's records [READ]
odoo state apply <file>    Apply desired state [WRITE]
```

```bash
odoo state plan ./config.json --experimental
odoo state apply ./config.json --experimental --confirm
```

---

## Output Formats

```bash
odoo records search crm.lead --format json    # JSON array
odoo records search crm.lead --format table   # ASCII table (default in TTY)
odoo records search crm.lead --format csv     # CSV with header row
odoo records search crm.lead --format ndjson  # Newline-delimited JSON (streaming)
```

**Auto-detection:** when stdout is a TTY, defaults to `table`; when piped, defaults to `json`.

**stdout / stderr split:**

- `stdout` — data only (always parseable, safe to pipe)
- `stderr` — errors, progress messages, warnings

This means `odoo records search crm.lead | jq '.[0].name'` always works even in `table` mode, because table output also goes to stdout only when a TTY is detected.

---

## Safety Model

Every command has a safety level shown in its description:

| Level | What it means | Requirements |
|---|---|---|
| **READ** | No data mutation | None — safe to run anywhere |
| **WRITE** | Creates or updates Odoo records | `--confirm` required |
| **DESTRUCTIVE** | May permanently delete data | `--confirm` required, warning printed |

```bash
# This will error: --confirm is required
odoo records create res.partner --data '{"name":"Acme"}'

# Correct
odoo records create res.partner --data '{"name":"Acme"}' --confirm

# Preview without executing (no --confirm needed)
odoo records create res.partner --data '{"name":"Acme"}' --dry-run
```

`--dry-run` prints the RPC call that *would* be executed to stderr and exits without contacting Odoo. Use it to verify commands before committing to mutations.

`--read-only` is accepted by `records call` to declare that a method is safe (skips the `--confirm` check).

---

## Global Flags

These flags work on every command:

| Flag | Description |
|---|---|
| `--format json\|table\|csv\|ndjson` | Output format |
| `--no-color` | Disable ANSI colors (also: `NO_COLOR` env var) |
| `-q, --quiet` | Suppress stderr progress and warnings |
| `-v, --version` | Show version |
| `-h, --help` | Show help |
| `--help-extra` | Show extended documentation for a command group |

---

## Exit Codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Usage error |
| 2 | Auth / network error |
| 3 | Not found |
| 4 | Permission denied |
| 5 | Validation error |
| 6 | Conflict |
| 10 | Partial success |

---

## As a Library

`odoo-cli` is built on `@marcfargas/odoo-client` for all Odoo communication. If you want to automate Odoo programmatically instead of shelling out:

```typescript
import { createClient } from '@marcfargas/odoo-client';

const client = await createClient(); // reads ODOO_* env vars
const leads = await client.searchRead('crm.lead', [['stage_id.name', '=', 'Won']]);
await client.mail.postInternalNote('crm.lead', leads[0].id, '<p>Processed by CI</p>');
```

See the [odoo-toolbox monorepo](../../README.md) for the full ecosystem: RPC client, schema introspection, and Odoo knowledge modules.

---

## License

[LGPL-3.0](./LICENSE) — Marc Fargas
