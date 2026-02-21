/**
 * Error formatting and exit-code mapping for odoo-cli.
 *
 * ALL error output goes to stderr. stdout is reserved for data.
 *
 * Exit codes:
 *   0  = success
 *   1  = usage error (bad flags, missing args, --confirm missing)
 *   2  = auth / network error
 *   3  = not found (record, model, module)
 *   4  = permission denied
 *   5  = validation error (Odoo rejected write)
 *   6  = conflict (already clocked in, timer running)
 *   10 = partial success (batch, some failed)
 */

import {
  OdooAuthError,
  OdooNetworkError,
  OdooTimeoutError,
  OdooValidationError,
  OdooAccessError,
  OdooMissingError,
} from '@marcfargas/odoo-client';

// ── Global quiet / no-color flags ────────────────────────────────────

let _quiet = false;
let _noColor = false;

/** Suppress stderr progress/warnings. Called from cli.ts preAction hook. */
export function setQuiet(v: boolean): void {
  _quiet = v;
}

/** Disable ANSI color in stderr output. Called from cli.ts preAction hook. */
export function setNoColor(v: boolean): void {
  _noColor = v;
}

export const EXIT_CODES = {
  SUCCESS: 0,
  USAGE_ERROR: 1,
  AUTH_NETWORK_ERROR: 2,
  NOT_FOUND: 3,
  PERMISSION_DENIED: 4,
  VALIDATION_ERROR: 5,
  CONFLICT: 6,
  PARTIAL_SUCCESS: 10,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

/**
 * Format and print an error to stderr, return the appropriate exit code.
 */
export function handleError(err: unknown): ExitCode {
  if (err instanceof OdooAuthError) {
    printError('Cannot authenticate to Odoo', err.message, [
      'Check ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD',
    ]);
    return EXIT_CODES.AUTH_NETWORK_ERROR;
  }

  if (err instanceof OdooTimeoutError || err instanceof OdooNetworkError) {
    printError('Connection failed', err.message, ['Check that ODOO_URL is reachable']);
    return EXIT_CODES.AUTH_NETWORK_ERROR;
  }

  if (err instanceof OdooAccessError) {
    printError('Permission denied', err.message, ['You may lack the required access rights']);
    return EXIT_CODES.PERMISSION_DENIED;
  }

  if (err instanceof OdooMissingError) {
    printError('Record not found', err.message);
    return EXIT_CODES.NOT_FOUND;
  }

  if (err instanceof OdooValidationError) {
    printError('Validation error', err.message, ['Odoo rejected the request']);
    return EXIT_CODES.VALIDATION_ERROR;
  }

  if (err instanceof CliUsageError) {
    printError(err.message, undefined, err.hints);
    return EXIT_CODES.USAGE_ERROR;
  }

  if (err instanceof CliNotFoundError) {
    printError(err.message, undefined, err.hints);
    return EXIT_CODES.NOT_FOUND;
  }

  if (err instanceof CliConflictError) {
    printError(err.message, undefined, err.hints);
    return EXIT_CODES.CONFLICT;
  }

  if (err instanceof CliAuthError) {
    printError(err.message, undefined, err.hints);
    return EXIT_CODES.AUTH_NETWORK_ERROR;
  }

  if (err instanceof Error) {
    // Check message patterns for categorization
    const msg = err.message.toLowerCase();
    if (msg.includes('not found') || msg.includes("doesn't exist")) {
      printError('Not found', err.message);
      return EXIT_CODES.NOT_FOUND;
    }
    if (msg.includes('missing environment variable') || msg.includes('missing env')) {
      printError('Configuration error', err.message, [
        'Set ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD',
        'Or use --url, --db, --user, --password flags',
      ]);
      return EXIT_CODES.AUTH_NETWORK_ERROR;
    }
    printError('Unexpected error', err.message);
    return EXIT_CODES.USAGE_ERROR;
  }

  printError('Unknown error', String(err));
  return EXIT_CODES.USAGE_ERROR;
}

/**
 * Print a formatted error to stderr.
 */
export function printError(message: string, detail?: string, hints?: string[]): void {
  const noColor = _noColor || process.env.NO_COLOR !== undefined || !process.stderr.isTTY;
  const red = noColor ? '' : '\x1b[31m';
  const dim = noColor ? '' : '\x1b[2m';
  const reset = noColor ? '' : '\x1b[0m';

  process.stderr.write(`${red}✗ Error:${reset} ${message}\n`);
  if (detail) {
    process.stderr.write(`  ${dim}Details:${reset} ${detail}\n`);
  }
  for (const hint of hints ?? []) {
    process.stderr.write(`  → ${hint}\n`);
  }
}

/**
 * Print a success message to stderr (decorative, not data).
 */
export function printSuccess(message: string): void {
  const noColor = _noColor || process.env.NO_COLOR !== undefined || !process.stderr.isTTY;
  const green = noColor ? '' : '\x1b[32m';
  const reset = noColor ? '' : '\x1b[0m';
  process.stderr.write(`${green}✓${reset} ${message}\n`);
}

/**
 * Print an info/progress message to stderr.
 * Suppressed in --quiet mode.
 */
export function printInfo(message: string): void {
  if (_quiet) return;
  process.stderr.write(`  ${message}\n`);
}

/**
 * Print a warning to stderr.
 * Suppressed in --quiet mode.
 */
export function printWarning(message: string): void {
  if (_quiet) return;
  const noColor = _noColor || process.env.NO_COLOR !== undefined || !process.stderr.isTTY;
  const yellow = noColor ? '' : '\x1b[33m';
  const reset = noColor ? '' : '\x1b[0m';
  process.stderr.write(`${yellow}⚠${reset} ${message}\n`);
}

// ── CLI-specific errors ──────────────────────────────────────────────

export class CliUsageError extends Error {
  constructor(
    message: string,
    public readonly hints: string[] = []
  ) {
    super(message);
    this.name = 'CliUsageError';
  }
}

export class CliNotFoundError extends Error {
  constructor(
    message: string,
    public readonly hints: string[] = []
  ) {
    super(message);
    this.name = 'CliNotFoundError';
  }
}

export class CliConflictError extends Error {
  constructor(
    message: string,
    public readonly hints: string[] = []
  ) {
    super(message);
    this.name = 'CliConflictError';
  }
}

export class CliAuthError extends Error {
  constructor(
    message: string,
    public readonly hints: string[] = []
  ) {
    super(message);
    this.name = 'CliAuthError';
  }
}
