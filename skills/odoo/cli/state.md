# `odoo state` — Experimental State Management

Declare desired state for Odoo configuration records, see what's drifted, and apply changes.

**⚠ EXPERIMENTAL** — all state commands require `--experimental`. This flag prevents accidental use in production scripts. Behavior may change in future releases.

Similar to Terraform: write a spec → plan → review → apply.

**Safety:**

| Command | Level | Requires |
|---------|-------|---------|
| `state plan` | READ | `--experimental` |
| `state diff` | READ | `--experimental` |
| `state apply` | WRITE | `--experimental` + `--confirm` |

## Use Cases

State management is ideal for **configuration records** that should be consistent across environments — not for business data:

- CRM stages / pipeline configuration
- Project stages
- Email templates
- Pricelists
- Product categories
- Country / currency configuration

## State Spec Format

Create a JSON file describing the desired state:

```json
{
  "model": "crm.stage",
  "match_field": "name",
  "records": [
    { "name": "New", "sequence": 1 },
    { "name": "Qualified", "sequence": 20 },
    { "name": "Proposition", "sequence": 30 },
    { "name": "Won", "sequence": 70 }
  ]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `model` | ✅ | Odoo model name |
| `match_field` | No (default: `name`) | Field used to identify records (must be unique) |
| `records` | ✅ | Array of desired record values |
| `prune` | No (default: `false`) | If `true`, destroy records present in Odoo but not in spec |

**`match_field`** is used to find existing records — if a record with that value exists, it's updated; otherwise it's created. Choose a field that is stable and unique (e.g., `name`, `code`, `key`).

## Commands

### `odoo state plan` — Show Drift [READ]

Compare your spec to what's currently in Odoo. No changes are made.

```bash
odoo state plan ./crm-stages.json --experimental
```

**Output:**
```
  + crm.stage "Proposal"
      name: "Proposal"
      sequence: 40
  ~ crm.stage "Qualified"
      sequence: 15 → 20
  - crm.stage "Old Stage"
      id: 7

Plan: 1 to add, 1 to change, 1 to destroy.
Run 'odoo state apply ./crm-stages.json --experimental --confirm' to execute.
```

**Symbols:**
- `+` — will be created
- `~` — will be updated
- `-` — will be destroyed (only with `"prune": true`)

```bash
# JSON output for scripting
odoo state plan ./crm-stages.json --experimental --format json
```

### `odoo state apply` — Apply State [WRITE]

Apply the changes shown by `plan`. Creates, updates, and optionally destroys records.

```bash
odoo state apply ./crm-stages.json --experimental --confirm
```

**Dry run — simulate without executing:**
```bash
odoo state apply ./crm-stages.json --experimental --confirm --dry-run
```

**CI/CD with `--auto-approve` (alias for `--confirm`):**
```bash
odoo state apply ./crm-stages.json --experimental --auto-approve
```

**Output:**
```
  + Created crm.stage "Proposal"
  ~ Updated crm.stage "Qualified"
✓ Applied: 1 created, 1 updated, 0 destroyed
```

### `odoo state diff` — Show Current State [READ]

Fetch and display the current state of all records for a model. Useful for creating an initial spec.

```bash
odoo state diff crm.stage --experimental

# Export as JSON to create a spec from current state
odoo state diff crm.stage --experimental --format json > current-stages.json
```

## Workflow: Bootstrap from Existing Data

1. **Export current state** to use as a starting spec:
   ```bash
   odoo state diff crm.stage --experimental --format json > crm-stages-raw.json
   ```

2. **Edit** to select only the fields you want to manage (remove `id`, computed fields, etc.):
   ```json
   {
     "model": "crm.stage",
     "match_field": "name",
     "records": [
       { "name": "New", "sequence": 1 },
       { "name": "Qualified", "sequence": 20 }
     ]
   }
   ```

3. **Plan** to verify no unintended changes:
   ```bash
   odoo state plan ./crm-stages.json --experimental
   ```

4. **Apply** when the plan looks correct:
   ```bash
   odoo state apply ./crm-stages.json --experimental --confirm
   ```

## Pruning

By default, records in Odoo that are NOT in your spec are left alone.

Set `"prune": true` to also delete records not in the spec:

```json
{
  "model": "crm.stage",
  "match_field": "name",
  "prune": true,
  "records": [
    { "name": "New" },
    { "name": "Won" }
  ]
}
```

With `prune: true`, any CRM stage NOT named "New" or "Won" will be destroyed on apply.

**⚠ Use prune with caution** — it can destroy records with associated data. Always review the plan before applying.

## Flags Reference

### Common to all state commands

| Flag | Description |
|------|-------------|
| `--experimental` | **Required** — enables experimental commands |
| `--url`, `--db`, `--user`, `--password` | Auth override flags |
| `--format <fmt>` | `table` / `json` / `csv` / `ndjson` |

### `state apply` only

| Flag | Description |
|------|-------------|
| `--confirm` | Required for apply (WRITE operation) |
| `--dry-run` | Simulate without executing |
| `--auto-approve` | Alias for `--confirm` — for CI/CD pipelines |

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success (or no changes needed) |
| `1` | Usage error (missing `--experimental`, bad file, missing `--confirm`) |
| `2` | Auth / network error |

## Limitations (Experimental)

- One model per spec file (no multi-model transactions)
- No dependency ordering between models
- No rollback on partial failure
- `match_field` must be unique across records in the spec
- Does not diff relational fields deeply — compares serialized JSON values
