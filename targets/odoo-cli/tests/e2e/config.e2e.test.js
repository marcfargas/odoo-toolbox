"use strict";
/**
 * E2E tests for `odoo config` commands.
 *
 * Requires a running Odoo instance (ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD).
 * Skips gracefully when credentials are not available.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const helpers_1 = require("./helpers");
const skip = !(0, helpers_1.hasOdooCredentials)();
vitest_1.describe.skipIf(skip)('config e2e', () => {
    (0, vitest_1.it)('config check exits 0 with valid credentials', () => {
        const { exitCode, stderr } = (0, helpers_1.runCLI)(['config', 'check']);
        (0, vitest_1.expect)(exitCode).toBe(0);
        (0, vitest_1.expect)(stderr).toMatch(/Connected to/i);
    });
    (0, vitest_1.it)('config check shows user info', () => {
        const { stderr } = (0, helpers_1.runCLI)(['config', 'check']);
        (0, vitest_1.expect)(stderr).toMatch(/User:/i);
    });
    (0, vitest_1.it)('config check exits 2 with invalid credentials', () => {
        const { exitCode, stderr } = (0, helpers_1.runCLI)(['config', 'check'], {
            ODOO_URL: process.env['ODOO_URL'] ?? '',
            ODOO_DB: process.env['ODOO_DB'] ?? '',
            ODOO_USERNAME: 'invalid-user@nonexistent.com',
            ODOO_PASSWORD: 'wrong-password',
        });
        (0, vitest_1.expect)(exitCode).toBe(2);
        (0, vitest_1.expect)(stderr).toMatch(/error/i);
    });
    (0, vitest_1.it)('config check exits 2 with missing credentials', () => {
        const { exitCode, stderr } = (0, helpers_1.runCLI)(['config', 'check'], {
            ODOO_URL: '',
            ODOO_DB: '',
            ODOO_USERNAME: '',
            ODOO_PASSWORD: '',
        });
        (0, vitest_1.expect)(exitCode).toBe(2);
        (0, vitest_1.expect)(stderr).toMatch(/missing/i);
    });
    (0, vitest_1.it)('config show outputs URL and DB', () => {
        const { exitCode, stdout } = (0, helpers_1.runCLI)(['config', 'show', '--format', 'json']);
        (0, vitest_1.expect)(exitCode).toBe(0);
        const data = JSON.parse(stdout);
        (0, vitest_1.expect)(data.url).toBeTruthy();
        (0, vitest_1.expect)(data.db).toBeTruthy();
    });
    (0, vitest_1.it)('config show redacts password in JSON', () => {
        const { stdout } = (0, helpers_1.runCLI)(['config', 'show', '--format', 'json']);
        const data = JSON.parse(stdout);
        (0, vitest_1.expect)(data.password).toBe('REDACTED');
        // Should not contain the actual password
        (0, vitest_1.expect)(stdout).not.toContain(process.env['ODOO_PASSWORD'] ?? 'XXXNOMATCH');
    });
});
(0, vitest_1.describe)('config e2e (no credentials)', () => {
    (0, vitest_1.it)('config check exits 2 when no env vars set', () => {
        const { exitCode } = (0, helpers_1.runCLI)(['config', 'check'], {
            ODOO_URL: '',
            ODOO_DB: '',
            ODOO_USERNAME: '',
            ODOO_PASSWORD: '',
        });
        (0, vitest_1.expect)(exitCode).toBe(2);
    });
});
//# sourceMappingURL=config.e2e.test.js.map