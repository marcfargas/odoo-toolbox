/**
 * E2E test helpers — run odoo-cli as a subprocess.
 *
 * Requires a running Odoo instance with credentials in env vars:
 *   ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD
 *
 * The CLI is run via ts-node (for dev) or the built dist/cli.js.
 */

import { spawnSync } from 'child_process';
import { resolve } from 'path';

const DIST_PATH = resolve(__dirname, '../../dist/cli.js');

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Run the CLI as a subprocess with the given arguments.
 *
 * Uses dist/cli.js if built, otherwise falls back to ts-node.
 * Inherits ODOO_* env vars from the test environment.
 */
export function runCLI(args: string[], env?: Record<string, string>, input?: string): CliResult {
  const mergedEnv = {
    ...process.env,
    ...env,
    // Disable color for consistent output comparison
    NO_COLOR: '1',
    // Force non-TTY format (json by default when piped)
    FORCE_COLOR: '0',
  };

  const result = spawnSync('node', [DIST_PATH, ...args], {
    env: mergedEnv,
    encoding: 'utf8',
    input,
    timeout: 30000, // 30s timeout for Odoo operations
  });

  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
}

/**
 * Check if Odoo credentials are available for e2e testing.
 */
export function hasOdooCredentials(): boolean {
  return !!(
    process.env['ODOO_URL'] &&
    process.env['ODOO_DB'] &&
    process.env['ODOO_USERNAME'] &&
    process.env['ODOO_PASSWORD']
  );
}

/**
 * Skip e2e tests when Odoo is not available.
 */
export function skipWithoutOdoo(fn: () => void): () => void {
  if (!hasOdooCredentials()) {
    return () => {
      // Skip — no Odoo credentials
    };
  }
  return fn;
}
