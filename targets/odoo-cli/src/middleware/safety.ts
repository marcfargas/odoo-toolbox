/**
 * Safety enforcement middleware for odoo-cli.
 *
 * Every command has a safety level: READ | WRITE | DESTRUCTIVE.
 *
 * - READ:         No requirements. Safe to run anywhere.
 * - WRITE:        Requires --confirm. Clear error if missing.
 * - DESTRUCTIVE:  Requires --confirm. Prints a DESTRUCTIVE warning.
 *
 * The CLI enforces safety at the command level, independently of the
 * odoo-client safety guard (which uses a confirm callback). Here we
 * use a simpler model: just check if the --confirm flag is present.
 */

import debug from 'debug';
import { CliUsageError } from '../output/errors';

const log = debug('odoo-cli:safety');

export type SafetyLevel = 'READ' | 'WRITE' | 'DESTRUCTIVE';

export interface SafetyOptions {
  confirm?: boolean;
  dryRun?: boolean;
}

/**
 * Assert that a WRITE or DESTRUCTIVE operation has --confirm.
 *
 * Throws CliUsageError (exit 1) if --confirm is missing.
 * In --dry-run mode, skips the check (we're not actually mutating).
 */
export function requireConfirm(
  level: SafetyLevel,
  options: SafetyOptions,
  commandDescription: string
): void {
  log('Safety check: level=%s confirm=%s dryRun=%s', level, options.confirm, options.dryRun);

  if (level === 'READ') return;
  // --dry-run bypasses confirm: safe because no RPC is executed.
  // This allows previewing any operation without --confirm.
  if (options.dryRun) {
    log('Skipping safety check: --dry-run mode');
    return;
  }

  if (!options.confirm) {
    const levelStr = level === 'DESTRUCTIVE' ? 'DESTRUCTIVE ⚠' : 'WRITE';
    throw new CliUsageError(
      `${commandDescription} is a ${levelStr} operation and requires --confirm`,
      [
        'Add --confirm to execute the operation',
        'Add --dry-run to preview the RPC call without executing',
        `This command modifies Odoo data. Safety level: ${level}`,
      ]
    );
  }

  if (level === 'DESTRUCTIVE') {
    process.stderr.write(`⚠  DESTRUCTIVE operation: ${commandDescription}\n`);
  }
}

/**
 * Format a dry-run message to stderr showing what WOULD be called.
 */
export function printDryRun(
  model: string,
  method: string,
  args: any[],
  kwargs: Record<string, any> = {}
): void {
  process.stderr.write(`DRY RUN: Would call execute_kw\n`);
  process.stderr.write(`  model:  ${model}\n`);
  process.stderr.write(`  method: ${method}\n`);
  process.stderr.write(`  args:   ${JSON.stringify(args)}\n`);
  if (Object.keys(kwargs).length > 0) {
    process.stderr.write(`  kwargs: ${JSON.stringify(kwargs)}\n`);
  }
}
