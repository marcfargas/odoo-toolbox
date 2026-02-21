# `odoo config` — Connection Configuration

Manage and verify your Odoo connection configuration.

**Safety: READ** — no confirmation required for any config command.

## Quick Start

```bash
# Always run this first to confirm your environment is set up correctly
odoo config check

# See exactly which values are being used and where they came from
odoo config show
```

## Environment Variables

The CLI reads these environment variables (all required unless passed as flags):

| Variable | Alt Variable | Description |
|----------|-------------|-------------|
| `ODOO_URL` | — | Base URL of the Odoo instance, e.g. `https://mycompany.odoo.com` |
| `ODOO_DB` | `ODOO_DATABASE` | Database name |
| `ODOO_USER` | `ODOO_USERNAME` | Login username |
| `ODOO_PASSWORD` | — | Login password |

All variables can be overridden via flags: `--url`, `--db`, `--user`, `--password`.

**⚠ Avoid `--password` on the command line** — it appears in shell history and process lists.
Use the environment variable instead.

## Commands

### `odoo config check`

Verify that the connection works and show who you are logged in as.

```bash
odoo config check
```

**Output on success:**
```
✓ Connected to https://mycompany.odoo.com (db: mycompany)
  User: Administrator (admin) [id: 2]
  Installed modules: 143
```

**Override credentials inline:**
```bash
odoo config check --url https://staging.odoo.com --db staging --user admin
```

**Use in scripts to gate further work:**
```bash
odoo config check || { echo "Odoo connection failed"; exit 1; }
```

**Exit codes:**

| Code | Meaning |
|------|---------|
| `0` | Connected successfully |
| `2` | Authentication or network error (wrong URL, wrong password, Odoo unreachable) |

### `odoo config show`

Show the resolved configuration without making an RPC call. The password is always redacted.

```bash
odoo config show
```

**Output:**
```
URL       https://mycompany.odoo.com  (from ODOO_URL)
Database  mycompany                   (from ODOO_DB)
Username  admin                       (from ODOO_USER)
Password  ****                        (from ODOO_PASSWORD)
Format    table                       (TTY default)
```

**JSON output (for scripts):**
```bash
odoo config show --format json
# {"url":"https://mycompany.odoo.com","db":"mycompany","username":"admin","password":"REDACTED"}
```

The `(from ...)` annotations tell you whether each value came from an env var or a flag.
This is invaluable for debugging environment configuration issues.

## Troubleshooting

### `config check` fails with exit code 2

1. **Run `odoo config show`** to confirm the values are what you expect.
2. **Check the URL** — must include `https://` and no trailing path.
3. **Check the database name** — it's case-sensitive and must match exactly.
4. **Test network access** — `curl $ODOO_URL/web/database/list` should respond.
5. **Verify credentials** — log in via the web UI to confirm user/password.

### Common mistakes

```bash
# ❌ Wrong — trailing slash
ODOO_URL=https://mycompany.odoo.com/

# ✅ Correct
ODOO_URL=https://mycompany.odoo.com

# ❌ Wrong — database name from URL is not always the subdomain
ODOO_DB=mycompany   # check the actual db name in Settings > Technical > Databases

# ❌ Wrong — ODOO_USER is the login, not the display name
ODOO_USER="Administrator"   # use "admin" or the actual login
```

## Flags Reference

All config subcommands support these authentication override flags:

| Flag | Description |
|------|-------------|
| `--url <url>` | Override `ODOO_URL` |
| `--db <name>` | Override `ODOO_DB` / `ODOO_DATABASE` |
| `--user <login>` | Override `ODOO_USER` / `ODOO_USERNAME` |
| `--password <pw>` | Override `ODOO_PASSWORD` ⚠ (avoid in scripts) |
| `--format <fmt>` | Output format: `table` (default on TTY), `json`, `csv`, `ndjson` |
