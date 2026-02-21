/**
 * Centralized parameter definitions for odoo-cli commands.
 *
 * ONE implementation for all shared flags:
 *   - --fields, --domain, --domain-json, --domain-file, --filter
 *   - --limit, --all, --offset, --page-size, --order
 *   - --format, --confirm, --dry-run, --context
 *   - Auth: --url, --db, --user, --password
 *
 * Commands compose these via Commander .addOption() calls.
 * Never duplicate these definitions in individual command files.
 */

import { Command, Option } from 'commander';

// ── Option factories ─────────────────────────────────────────────────

/** --url: Odoo base URL */
export const urlOption = () => new Option('--url <url>', 'Odoo URL').env('ODOO_URL');

/** --db: Database name */
export const dbOption = () => new Option('--db <db>', 'Database name').env('ODOO_DB');

/** --user: Username */
export const userOption = () => new Option('--user <user>', 'Username').env('ODOO_USERNAME');

/** --password: Password (use env var instead) */
export const passwordOption = () =>
  new Option('--password <password>', 'Password ⚠ use env instead').env('ODOO_PASSWORD').hideHelp();

/** All auth options as a group */
export function addAuthOptions(cmd: Command): Command {
  return cmd
    .addOption(urlOption())
    .addOption(dbOption())
    .addOption(userOption())
    .addOption(passwordOption());
}

/** --format: Output format */
export const formatOption = () =>
  new Option('--format <format>', 'Output format: json | table | csv | ndjson').choices([
    'json',
    'table',
    'csv',
    'ndjson',
  ]);

/** --fields: Comma-separated fields */
export const fieldsOption = () =>
  new Option('--fields <fields>', 'Comma-separated fields to include');

/** --domain: Odoo domain filter */
export const domainOption = () =>
  new Option('--domain <domain>', 'Odoo domain filter (Python syntax): \'["name","=","Acme"]\'');

/** --domain-json: Strict JSON domain */
export const domainJsonOption = () =>
  new Option('--domain-json <json>', 'Strict JSON domain: \'[["name","=","Acme"]]\'');

/** --domain-file: Read domain from file */
export const domainFileOption = () =>
  new Option('--domain-file <file>', "Read domain from file ('-' for stdin)");

/** --filter: Simple K=V equality shorthand — repeatable, values collected into array */
export const filterOption = () =>
  new Option('--filter <k=v>', "Simple equality filter (repeatable, AND'd)")
    .argParser<string[]>((val: string, prev: string[] = []) => [...prev, val])
    .default([]);

/** --limit: Max records */
export const limitOption = (defaultVal: number = 80) =>
  new Option('--limit <n>', `Max records (default: ${defaultVal}, 0 = all)`)
    .default(defaultVal)
    .argParser((v) => parseInt(v, 10));

/** --all: Fetch all records (--limit 0 alias) */
export const allOption = () => new Option('--all', 'Fetch all records (alias for --limit 0)');

/** --offset: Skip first N records */
export const offsetOption = () =>
  new Option('--offset <n>', 'Skip first N records (default: 0)')
    .default(0)
    .argParser((v) => parseInt(v, 10));

/** --page-size: Paging chunk size */
export const pageSizeOption = () =>
  new Option('--page-size <n>', 'Records per page when fetching all (default: 500)')
    .default(500)
    .argParser((v) => parseInt(v, 10));

/** --order: Sort order */
export const orderOption = () => new Option('--order <order>', 'Sort: "date_order desc,name asc"');

/** --count: Print count instead of records */
export const countOption = () => new Option('--count', 'Print count instead of records');

/** --confirm: Required for WRITE/DESTRUCTIVE */
export const confirmOption = () =>
  new Option('--confirm', 'Confirm mutation (required for WRITE/DESTRUCTIVE operations)');

/** --dry-run: Preview without executing */
export const dryRunOption = () =>
  new Option('--dry-run', 'Show RPC call without executing — does not require --confirm');

/** --context: Extra Odoo context JSON */
export const contextOption = () =>
  new Option('--context <json>', 'Extra Odoo context: \'{"lang":"fr_FR","company_id":3}\'');

/** --no-color: Disable ANSI colors */
export const noColorOption = () => new Option('--no-color', 'Disable ANSI colors').env('NO_COLOR');

/** --quiet: Suppress stderr progress/warnings */
export const quietOption = () => new Option('-q, --quiet', 'Suppress stderr progress and warnings');

/** --experimental: Required for experimental commands */
export const experimentalOption = () =>
  new Option('--experimental', 'Enable experimental features (required for `state` commands)');

// ── Option groups ────────────────────────────────────────────────────

/**
 * Add search/filter options to a command.
 * Used by: records search, records count, attendance list, timesheets list, etc.
 */
export function addSearchOptions(cmd: Command): Command {
  return cmd
    .addOption(domainOption())
    .addOption(domainJsonOption())
    .addOption(domainFileOption())
    .addOption(filterOption());
}

/**
 * Add pagination options to a command.
 */
export function addPaginationOptions(cmd: Command, defaultLimit: number = 80): Command {
  return cmd
    .addOption(limitOption(defaultLimit))
    .addOption(allOption())
    .addOption(offsetOption())
    .addOption(pageSizeOption())
    .addOption(orderOption());
}

/**
 * Add output options (format + fields) to a command.
 */
export function addOutputOptions(cmd: Command): Command {
  return cmd.addOption(formatOption()).addOption(fieldsOption());
}

/**
 * Add write safety options to a command.
 */
export function addWriteOptions(cmd: Command): Command {
  return cmd.addOption(confirmOption()).addOption(dryRunOption()).addOption(contextOption());
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Parse --fields value into an array of field names.
 * Returns empty array if not specified (means "all fields").
 */
export function parseFields(fields?: string): string[] {
  if (!fields) return [];
  return fields
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);
}

/**
 * Resolve the effective limit.
 * --all overrides --limit (sets to 0 = all).
 */
export function resolveLimit(options: { limit?: number; all?: boolean }): number {
  if (options.all) return 0;
  return options.limit ?? 80;
}
