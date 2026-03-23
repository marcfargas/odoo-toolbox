/**
 * E2E test helpers — run odoo-cli as a subprocess.
 *
 * Requires a running Odoo instance with credentials in env vars:
 *   ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD
 *
 * The CLI is run via ts-node (for dev) or the built dist/cli.js.
 */
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
export declare function runCLI(
  args: string[],
  env?: Record<string, string>,
  input?: string
): CliResult;
/**
 * Check if Odoo credentials are available for e2e testing.
 */
export declare function hasOdooCredentials(): boolean;
/**
 * Skip e2e tests when Odoo is not available.
 */
export declare function skipWithoutOdoo(fn: () => void): () => void;
//# sourceMappingURL=helpers.d.ts.map
