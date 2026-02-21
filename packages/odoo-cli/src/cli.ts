#!/usr/bin/env node
/**
 * odoo-cli — CLI for Odoo ERP
 *
 * Entry point. Sets up Commander program with global flags and all command groups.
 *
 * Output contract:
 *   stdout = data only (JSON, table, CSV, ndjson) — always parseable
 *   stderr = errors, progress, warnings, decorative messages
 *
 * Safety model:
 *   READ        → no --confirm required
 *   WRITE       → --confirm required
 *   DESTRUCTIVE → --confirm required (+ explicit warning)
 *
 * Exit codes:
 *   0  success
 *   1  usage error
 *   2  auth / network error
 *   3  not found
 *   4  permission denied
 *   5  validation error
 *   6  conflict
 *   10 partial success
 */

import { Command } from 'commander';
import { buildConfigCommand } from './commands/config';
import { buildRecordsCommand } from './commands/records';
import { buildMailCommand } from './commands/mail';
import { buildModulesCommand } from './commands/modules';
import { buildAttendanceCommand } from './commands/attendance';
import { buildTimesheetsCommand } from './commands/timesheets';
import { buildAccountingCommand } from './commands/accounting';
import { buildUrlCommand } from './commands/url';
import { buildSchemaCommand } from './commands/schema';
import { buildStateCommand } from './commands/state';
import { handleError, setQuiet, setNoColor as setErrorsNoColor } from './output/errors';
import {
  urlOption,
  dbOption,
  userOption,
  passwordOption,
  formatOption,
  noColorOption,
  quietOption,
} from './middleware/common-params';
import { setNoColor } from './output/formatter';

// Resolve package version at runtime (CJS-compatible)
let version = '0.1.0';
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pkg = require('../package.json') as { version: string };
  version = pkg.version;
} catch {
  // fallback to default
}

const program = new Command();

program
  .name('odoo')
  .description(
    `CLI for Odoo ERP — records, mail, modules, attendance, timesheets, accounting, schema

AUTHENTICATION (env vars or flags)
  ODOO_URL       Odoo base URL        (or --url)
  ODOO_DB        Database name        (or --db)
  ODOO_USERNAME  Username             (or --user)
  ODOO_PASSWORD  Password             (or --password, avoid in CLI!)

SAFETY MODEL
  READ        No confirmation needed. Safe to run anywhere.
  WRITE       Requires --confirm. Mutates Odoo data.
  DESTRUCTIVE Requires --confirm. May permanently delete data. ⚠

Each command's help shows its safety level: [READ], [WRITE], or [DESTRUCTIVE].

OUTPUT
  stdout = data only (json, table, csv, ndjson) — always parseable
  stderr = errors, progress, warnings

  Format auto-detection: TTY → table, pipe → json
  Override with --format json|table|csv|ndjson

FIRST RUN
  odoo config check           # verify connection
  odoo records search res.partner --limit 5
  odoo schema models --search sale
`
  )
  .version(version, '-v, --version', 'Show version')
  .helpOption('-h, --help', 'Show help')
  .addHelpText(
    'after',
    `
More help:
  odoo <command> --help         # command-specific help
  odoo <command> --help-extra   # full skill documentation (paged)

Examples:
  odoo config check
  odoo records search crm.lead --fields id,name,stage_id --limit 20
  odoo records create res.partner --data '{"name":"Acme"}' --confirm
  odoo mail note crm.lead 42 "Called customer" --confirm
  odoo modules list --filter installed
  odoo schema fields crm.lead --type many2one
`
  );

// ── Global flags ────────────────────────────────────────────────────
// These are available on the root program and inherited by subcommands.
// Defined in common-params.ts (single source of truth).

program.addOption(urlOption());
program.addOption(dbOption());
program.addOption(userOption());
program.addOption(passwordOption());
program.addOption(formatOption());
program.addOption(noColorOption());
program.addOption(quietOption());

// Wire --quiet and --no-color flags into output modules.
// Commander sets opts.color = false when --no-color is passed.
program.hook('preAction', (thisCommand) => {
  const opts = thisCommand.optsWithGlobals();
  setQuiet(!!opts.quiet);
  setNoColor(opts.color === false);
  setErrorsNoColor(opts.color === false);
});

// ── Commands ────────────────────────────────────────────────────────

program.addCommand(buildConfigCommand());
program.addCommand(buildRecordsCommand());
program.addCommand(buildMailCommand());
program.addCommand(buildModulesCommand());
program.addCommand(buildAttendanceCommand());
program.addCommand(buildTimesheetsCommand());
program.addCommand(buildAccountingCommand());
program.addCommand(buildUrlCommand());
program.addCommand(buildSchemaCommand());
program.addCommand(buildStateCommand());

// ── Error handling ──────────────────────────────────────────────────

// Commander's built-in error handling — exit 1 on usage errors
program.exitOverride((err) => {
  if (err.code === 'commander.helpDisplayed') {
    process.exit(0);
  }
  if (err.code === 'commander.version') {
    process.exit(0);
  }
  process.stderr.write(err.message + '\n');
  process.exit(1);
});

// Global uncaught error handler — last resort
process.on('uncaughtException', (err) => {
  const code = handleError(err);
  process.exit(code);
});

process.on('unhandledRejection', (err) => {
  const code = handleError(err);
  process.exit(code);
});

// ── Main ────────────────────────────────────────────────────────────

program.parseAsync(process.argv).catch((err) => {
  const code = handleError(err);
  process.exit(code);
});
