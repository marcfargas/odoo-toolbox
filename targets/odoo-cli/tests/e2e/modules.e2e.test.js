"use strict";
/**
 * E2E tests for `odoo modules` commands.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const helpers_1 = require("./helpers");
const skip = !(0, helpers_1.hasOdooCredentials)();
vitest_1.describe.skipIf(skip)('modules e2e', () => {
    (0, vitest_1.it)('modules list returns an array', () => {
        const { stdout, exitCode } = (0, helpers_1.runCLI)(['modules', 'list', '--format', 'json']);
        (0, vitest_1.expect)(exitCode).toBe(0);
        const data = JSON.parse(stdout);
        (0, vitest_1.expect)(Array.isArray(data)).toBe(true);
        (0, vitest_1.expect)(data.length).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('modules list --filter installed returns only installed', () => {
        const { stdout } = (0, helpers_1.runCLI)(['modules', 'list', '--filter', 'installed', '--format', 'json']);
        const data = JSON.parse(stdout);
        // All should have state=installed
        for (const m of data) {
            (0, vitest_1.expect)(m.state).toBe('installed');
        }
    });
    (0, vitest_1.it)('modules status for an installed module', () => {
        // base is always installed
        const { stdout, exitCode } = (0, helpers_1.runCLI)(['modules', 'status', 'base']);
        (0, vitest_1.expect)(exitCode).toBe(0);
        (0, vitest_1.expect)(stdout.trim()).toBe('installed');
    });
    (0, vitest_1.it)('modules status exits 3 for non-existent module', () => {
        const { exitCode } = (0, helpers_1.runCLI)([
            'modules',
            'status',
            'this-module-absolutely-does-not-exist-xyz123',
        ]);
        (0, vitest_1.expect)(exitCode).toBe(3);
    });
    (0, vitest_1.it)('modules info shows module details', () => {
        const { stdout, exitCode } = (0, helpers_1.runCLI)(['modules', 'info', 'base', '--format', 'json']);
        (0, vitest_1.expect)(exitCode).toBe(0);
        const data = JSON.parse(stdout);
        (0, vitest_1.expect)(data.name).toBe('base');
        (0, vitest_1.expect)(data.state).toBe('installed');
    });
    (0, vitest_1.it)('modules install requires --confirm', () => {
        const { exitCode, stderr } = (0, helpers_1.runCLI)(['modules', 'install', 'some_module']);
        (0, vitest_1.expect)(exitCode).toBe(1);
        (0, vitest_1.expect)(stderr).toMatch(/--confirm/i);
    });
    (0, vitest_1.it)('modules uninstall requires --confirm', () => {
        const { exitCode, stderr } = (0, helpers_1.runCLI)(['modules', 'uninstall', 'some_module']);
        (0, vitest_1.expect)(exitCode).toBe(1);
        (0, vitest_1.expect)(stderr).toMatch(/--confirm/i);
    });
    (0, vitest_1.it)('modules upgrade requires --confirm', () => {
        const { exitCode, stderr } = (0, helpers_1.runCLI)(['modules', 'upgrade', 'base']);
        (0, vitest_1.expect)(exitCode).toBe(1);
        (0, vitest_1.expect)(stderr).toMatch(/--confirm/i);
    });
    (0, vitest_1.it)('modules list --search filters by name', () => {
        const { stdout, exitCode } = (0, helpers_1.runCLI)([
            'modules',
            'list',
            '--search',
            'base',
            '--format',
            'json',
        ]);
        (0, vitest_1.expect)(exitCode).toBe(0);
        const data = JSON.parse(stdout);
        // Should include 'base' module
        const names = data.map((m) => m.technical_name);
        (0, vitest_1.expect)(names).toContain('base');
    });
});
(0, vitest_1.describe)('modules (no Odoo)', () => {
    (0, vitest_1.it)('modules install requires --confirm before auth', () => {
        const { exitCode, stderr } = (0, helpers_1.runCLI)(['modules', 'install', 'hr_timesheet'], {
            ODOO_URL: 'http://fake',
            ODOO_DB: 'fake',
            ODOO_USERNAME: 'fake',
            ODOO_PASSWORD: 'fake',
        });
        (0, vitest_1.expect)(exitCode).toBe(1);
        (0, vitest_1.expect)(stderr).toMatch(/--confirm/i);
    });
});
//# sourceMappingURL=modules.e2e.test.js.map