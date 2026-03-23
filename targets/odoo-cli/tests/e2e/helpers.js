"use strict";
/**
 * E2E test helpers — run odoo-cli as a subprocess.
 *
 * Requires a running Odoo instance with credentials in env vars:
 *   ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD
 *
 * The CLI is run via ts-node (for dev) or the built dist/cli.js.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCLI = runCLI;
exports.hasOdooCredentials = hasOdooCredentials;
exports.skipWithoutOdoo = skipWithoutOdoo;
const child_process_1 = require("child_process");
const path_1 = require("path");
const DIST_PATH = (0, path_1.resolve)(__dirname, '../../dist/cli.js');
/**
 * Run the CLI as a subprocess with the given arguments.
 *
 * Uses dist/cli.js if built, otherwise falls back to ts-node.
 * Inherits ODOO_* env vars from the test environment.
 */
function runCLI(args, env, input) {
    const mergedEnv = {
        ...process.env,
        ...env,
        // Disable color for consistent output comparison
        NO_COLOR: '1',
        // Force non-TTY format (json by default when piped)
        FORCE_COLOR: '0',
    };
    const result = (0, child_process_1.spawnSync)('node', [DIST_PATH, ...args], {
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
function hasOdooCredentials() {
    return !!(process.env['ODOO_URL'] &&
        process.env['ODOO_DB'] &&
        process.env['ODOO_USERNAME'] &&
        process.env['ODOO_PASSWORD']);
}
/**
 * Skip e2e tests when Odoo is not available.
 */
function skipWithoutOdoo(fn) {
    if (!hasOdooCredentials()) {
        return () => {
            // Skip — no Odoo credentials
        };
    }
    return fn;
}
//# sourceMappingURL=helpers.js.map