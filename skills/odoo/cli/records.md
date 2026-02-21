# `odoo records` — Generic CRUD on Any Odoo Model

The most important CLI command. Perform any read, write, or delete operation on any Odoo model.

**Safety levels:**

| Level | Commands | Requires |
|-------|----------|---------|
| READ | `search`, `get`, `count`, `call --read-only` | Nothing |
| WRITE | `create`, `write`, `call` | `--confirm` |
| DESTRUCTIVE | `delete` | `--confirm` |

## Quick Reference

```bash
# Search / list
odoo records search res.partner --fields id,name,email --limit 10
odoo records count crm.lead --filter stage_id.name=Won

# Read single record
odoo records get crm.lead 42

# Write (all require --confirm)
odoo records create res.partner --data '{"name":"Acme Corp"}' --confirm
odoo records write crm.lead 42 --data '{"stage_id":5}' --confirm
odoo records delete crm.lead 42 --confirm
```

---

## `records search` — Filter and List Records [READ]

```bash
odoo records search <model> [options]
```

### Basic search

```bash
# All partners (first 50 by default on TTY)
odoo records search res.partner

# Select specific fields
odoo records search res.partner --fields id,name,email,phone

# Limit results
odoo records search crm.lead --fields id,name --limit 20

# Get ALL records (paginated automatically, streams for csv/ndjson)
odoo records search account.move --all --format ndjson > invoices.ndjson
```

### Filtering

Three ways to express a domain — pick the most convenient:

**`--filter` (simple equality, key=value):**
```bash
# Single filter
odoo records search res.partner --filter is_company=true

# Multiple filters (ANDed together)
odoo records search res.partner --filter is_company=true --filter country_id=68

# Related field via dot notation
odoo records search crm.lead --filter stage_id.name=Won
```

**`--domain` (Odoo domain syntax as shell argument):**
```bash
# Simple domain
odoo records search sale.order --domain '[["state","=","sale"]]'

# Complex domain with OR
odoo records search crm.lead --domain '["|",["stage_id.name","=","Won"],["stage_id.name","=","Qualified"]]'
```

**`--domain-json` (JSON string, same as --domain but explicit):**
```bash
odoo records search res.partner --domain-json '[["is_company","=",true],["email","!=",false]]'
```

**`--domain-file` (read domain from a JSON file):**
```bash
# domain.json: [["date_order",">=","2024-01-01"],["state","=","sale"]]
odoo records search sale.order --domain-file domain.json
```

**Combining `--filter` with `--domain` (ANDed together):**
```bash
odoo records search sale.order --domain '[["state","=","sale"]]' --filter partner_id=42
```

### Pagination and ordering

```bash
# Offset-based pagination
odoo records search res.partner --limit 100 --offset 0
odoo records search res.partner --limit 100 --offset 100

# Custom sort order
odoo records search sale.order --order "date_order desc" --limit 20

# All records — fetches in pages of 500 automatically
odoo records search account.move --all --order "date desc"
```

### Count shorthand

```bash
# Print a count instead of records
odoo records search res.partner --filter is_company=true --count

# Same as records count (see below)
```

### Output formats

| Format | Description | Default when |
|--------|-------------|-------------|
| `table` | Human-readable aligned table | TTY (interactive terminal) |
| `json` | JSON array | Pipe / redirect |
| `csv` | CSV with header row | Explicit `--format csv` |
| `ndjson` | Newline-delimited JSON (streaming) | Explicit `--format ndjson` |

```bash
# Export to CSV
odoo records search sale.order --all --format csv > orders.csv

# Pipe to jq
odoo records search res.partner --limit 5 --format json | jq '.[].email'

# Stream large datasets
odoo records search account.move --all --format ndjson | wc -l
```

### Context

```bash
# Pass Odoo context (e.g., include archived records)
odoo records search res.partner --context '{"active_test":false}'

# Multi-company
odoo records search account.move --context '{"allowed_company_ids":[1,5]}'
```

---

## `records get` — Fetch a Single Record [READ]

```bash
odoo records get <model> <id> [options]
```

Default fields: `id`, `display_name`. Use `--fields` to request more.

```bash
# Default: id + display_name
odoo records get crm.lead 42

# Specific fields
odoo records get res.partner 7 --fields id,name,email,phone,street,city

# JSON output
odoo records get sale.order 88 --format json

# Exit code 3 if record not found
odoo records get crm.lead 99999 || echo "Not found"
```

---

## `records count` — Count Matching Records [READ]

```bash
odoo records count <model> [options]
```

Always outputs a bare integer. Ideal for scripts and conditionals.

```bash
# Count all
odoo records count res.partner

# Count with filter
odoo records count res.partner --filter is_company=true

# Count with domain
odoo records count crm.lead --domain '[["stage_id.name","=","Won"]]'

# Use in shell variable
COUNT=$(odoo records count crm.lead --filter active=true)
echo "Active leads: $COUNT"

# Conditional
if [ "$(odoo records count project.task --filter stage_id.name=Done)" -gt 0 ]; then
  echo "Tasks completed"
fi
```

---

## `records create` — Create a Record [WRITE — requires `--confirm`]

```bash
odoo records create <model> --data '<json>' --confirm
```

```bash
# Basic create
odoo records create res.partner --data '{"name":"Acme Corp","is_company":true}' --confirm

# Create with relational fields (pass the ID)
odoo records create crm.lead --data '{"name":"New Lead","partner_id":42,"stage_id":1}' --confirm

# Read data from file
odoo records create res.partner --data-file partner.json --confirm

# Read from stdin
echo '{"name":"Test Partner"}' | odoo records create res.partner --data-file - --confirm

# Dry run — show what would be sent without executing
odoo records create res.partner --data '{"name":"Test"}' --confirm --dry-run

# With context
odoo records create res.partner --data '{"name":"Test"}' \
  --context '{"mail_create_nolog":true}' --confirm
```

**Output:** On success, prints the created record ID to stdout.
```
✓ Created res.partner id=123
123
```

---

## `records write` — Update Records [WRITE — requires `--confirm`]

```bash
odoo records write <model> <ids> --data '<json>' --confirm
```

Supports batch update with comma-separated IDs.

```bash
# Update a single record
odoo records write crm.lead 42 --data '{"stage_id":5}' --confirm

# Update multiple records at once (same values applied to all)
odoo records write res.partner 1,2,3 --data '{"active":false}' --confirm

# Update from file
odoo records write sale.order 88 --data-file updates.json --confirm

# Dry run
odoo records write crm.lead 42 --data '{"name":"New Name"}' --confirm --dry-run

# With context (e.g., suppress tracking)
odoo records write res.partner 42 --data '{"email":"new@acme.com"}' \
  --context '{"tracking_disable":true}' --confirm
```

---

## `records delete` — Delete Records [DESTRUCTIVE — requires `--confirm`]

```bash
odoo records delete <model> <ids> --confirm
```

Fetches `display_name` before deleting and shows it for confirmation.

```bash
# Delete a single record
odoo records delete crm.lead 42 --confirm

# Delete multiple records
odoo records delete res.partner 1,2,3 --confirm

# Dry run — shows what would be deleted
odoo records delete crm.lead 42 --confirm --dry-run
```

**Output before deleting:**
```
Deleting crm.lead#42 (Interested in Product Demo)
✓ Deleted crm.lead ids=[42]
```

For batch deletes: `Deleting 3 records from res.partner`

---

## `records call` — Call an Arbitrary Method [WRITE — requires `--confirm` for mutations]

```bash
odoo records call <model> <method> [options]
```

Calls any method on any Odoo model. Default: requires `--confirm`.
Use `--read-only` to skip `--confirm` for read methods.

```bash
# Confirm a sale order (WRITE — needs --confirm)
odoo records call sale.order action_confirm --ids 42 --confirm

# Cancel multiple orders
odoo records call sale.order action_cancel --ids 42,43 --confirm

# Post an invoice with extra kwargs
odoo records call account.move action_post --ids 101 \
  --kwargs '{"force_whole_entry":true}' --confirm

# Read method — skip --confirm with --read-only
odoo records call sale.order name_get --ids 42 --read-only
odoo records call res.partner name_search --args '["Acme"]' --read-only

# Model-level call (no --ids)
odoo records call res.partner fields_get --read-only

# Dry run
odoo records call sale.order action_confirm --ids 42 --confirm --dry-run
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--ids <n,n,...>` | Record IDs (prepended to args array) |
| `--args <json>` | Positional args as JSON array (default: `[]`) |
| `--kwargs <json>` | Keyword args as JSON object (default: `{}`) |
| `--read-only` | Skip `--confirm` requirement (use for read methods) |
| `--context <json>` | Odoo context object |
| `--confirm` | Required for WRITE operations |
| `--dry-run` | Show what would be called without executing |
| `--format` | Output format for returned data |

---

## Common Patterns

### Export all records of a model

```bash
# Stream as ndjson (memory-efficient for large datasets)
odoo records search account.move.line --all --format ndjson > lines.ndjson

# Export as CSV
odoo records search sale.order --all \
  --fields id,name,date_order,state,amount_total \
  --order "date_order desc" \
  --format csv > sales.csv
```

### Bulk update with domain-filtered IDs

```bash
# Get IDs first, then write
IDS=$(odoo records search crm.lead --filter active=false \
  --fields id --all --format json | jq -r '.[].id' | paste -sd,)
odoo records write crm.lead "$IDS" --data '{"active":true}' --confirm
```

### Create and immediately get the URL

```bash
ID=$(odoo records create res.partner --data '{"name":"New Co.","is_company":true}' --confirm)
odoo url record res.partner "$ID"
```

### Check if a record exists

```bash
COUNT=$(odoo records count res.partner --filter email=admin@example.com)
[ "$COUNT" -gt 0 ] && echo "Exists" || echo "Not found"
```

### Post a note after creating

```bash
LEAD_ID=$(odoo records create crm.lead \
  --data '{"name":"Hot Prospect","partner_id":42}' --confirm)
odoo mail note crm.lead "$LEAD_ID" "Lead created via automation" --confirm
```

---

## Flags Reference

### Shared read flags (`search`, `count`)

| Flag | Description |
|------|-------------|
| `--domain <d>` | Odoo domain syntax as shell string |
| `--domain-json <d>` | Same, as explicit JSON string |
| `--domain-file <file>` | Read domain from a JSON file |
| `--filter <k=v>` | Simple equality filter (repeatable, ANDed) |

### Search-specific flags

| Flag | Description |
|------|-------------|
| `--fields <f,f,...>` | Comma-separated field names to return |
| `--limit <n>` | Max records (default: 50 on TTY, 0 in pipe) |
| `--all` | Fetch all records (paginated, overrides --limit) |
| `--offset <n>` | Skip first N records |
| `--order <clause>` | SQL-style order, e.g. `"name asc"` |
| `--count` | Print count instead of records |
| `--format <fmt>` | `table` / `json` / `csv` / `ndjson` |
| `--context <json>` | Odoo context object |

### Write flags (`create`, `write`, `delete`, `call`)

| Flag | Description |
|------|-------------|
| `--confirm` | Required for WRITE/DESTRUCTIVE operations |
| `--dry-run` | Show what would happen without executing |
| `--context <json>` | Odoo context object |

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Usage error (bad flags, missing `--confirm`) |
| `2` | Auth / network error |
| `3` | Record not found |
| `4` | Permission denied |
| `5` | Validation error (Odoo rejected the values) |
| `6` | Conflict |
