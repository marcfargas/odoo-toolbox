#!/bin/bash
# Postgres initdb.d script — runs once when a fresh data directory is initialised.
#
# Creates the target database and restores the Odoo seed dump into it.
# The dump is pg_restore -Fc (custom format) produced by the build workflow.
#
# SEED_DB_NAME: name of the database to create/restore into (default: "odoo").
#   globalSetup.ts uses the default.
#   OdooTestContainer passes SEED_DB_NAME=<its configured database>.

set -e

DB="${SEED_DB_NAME:-odoo}"

echo "[seed-db-init] Creating database: ${DB}"
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres \
  -c "CREATE DATABASE \"${DB}\";"

echo "[seed-db-init] Restoring dump into: ${DB}"
pg_restore \
  -U "$POSTGRES_USER" \
  -d "${DB}" \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  /docker-entrypoint-initdb.d/01-odoo-seed.dump

echo "[seed-db-init] Restore complete."
