"use strict";
/**
 * E2E tests for `odoo records` commands.
 *
 * Requires a running Odoo instance.
 * Tests the full command path including exit codes and output format.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const helpers_1 = require("./helpers");
const skip = !(0, helpers_1.hasOdooCredentials)();
vitest_1.describe.skipIf(skip)('records e2e', () => {
    // Track created record IDs for cleanup
    const createdIds = [];
    (0, vitest_1.afterAll)(() => {
        // Clean up any created test records
        for (const id of createdIds) {
            (0, helpers_1.runCLI)(['records', 'delete', 'res.partner', String(id), '--confirm']);
        }
    });
    // ── search ─────────────────────────────────────────────────────────
    (0, vitest_1.describe)('records search', () => {
        (0, vitest_1.it)('returns JSON array by default (piped)', () => {
            const { stdout, exitCode } = (0, helpers_1.runCLI)([
                'records',
                'search',
                'res.partner',
                '--format',
                'json',
                '--limit',
                '5',
            ]);
            (0, vitest_1.expect)(exitCode).toBe(0);
            const data = JSON.parse(stdout);
            (0, vitest_1.expect)(Array.isArray(data)).toBe(true);
            (0, vitest_1.expect)(data.length).toBeGreaterThan(0);
        });
        (0, vitest_1.it)('returns objects with id field', () => {
            const { stdout } = (0, helpers_1.runCLI)([
                'records',
                'search',
                'res.partner',
                '--format',
                'json',
                '--limit',
                '5',
            ]);
            const data = JSON.parse(stdout);
            (0, vitest_1.expect)(data[0]).toHaveProperty('id');
        });
        (0, vitest_1.it)('respects --fields flag', () => {
            const { stdout } = (0, helpers_1.runCLI)([
                'records',
                'search',
                'res.partner',
                '--format',
                'json',
                '--limit',
                '3',
                '--fields',
                'id,name',
            ]);
            const data = JSON.parse(stdout);
            (0, vitest_1.expect)(data[0]).toHaveProperty('id');
            (0, vitest_1.expect)(data[0]).toHaveProperty('name');
            (0, vitest_1.expect)(Object.keys(data[0])).toEqual(vitest_1.expect.arrayContaining(['id', 'name']));
        });
        (0, vitest_1.it)('respects --limit flag', () => {
            const { stdout } = (0, helpers_1.runCLI)([
                'records',
                'search',
                'res.partner',
                '--format',
                'json',
                '--limit',
                '3',
            ]);
            const data = JSON.parse(stdout);
            (0, vitest_1.expect)(data.length).toBeLessThanOrEqual(3);
        });
        (0, vitest_1.it)('--count outputs a bare integer', () => {
            const { stdout, exitCode } = (0, helpers_1.runCLI)(['records', 'search', 'res.partner', '--count']);
            (0, vitest_1.expect)(exitCode).toBe(0);
            const count = parseInt(stdout.trim(), 10);
            (0, vitest_1.expect)(isNaN(count)).toBe(false);
            (0, vitest_1.expect)(count).toBeGreaterThanOrEqual(0);
        });
        (0, vitest_1.it)('--filter works for simple equality', () => {
            const { stdout, exitCode } = (0, helpers_1.runCLI)([
                'records',
                'search',
                'res.partner',
                '--filter',
                'active=true',
                '--format',
                'json',
                '--limit',
                '5',
            ]);
            (0, vitest_1.expect)(exitCode).toBe(0);
            const data = JSON.parse(stdout);
            (0, vitest_1.expect)(Array.isArray(data)).toBe(true);
        });
        (0, vitest_1.it)('exits 0 for empty results', () => {
            const { stdout, exitCode } = (0, helpers_1.runCLI)([
                'records',
                'search',
                'res.partner',
                '--domain',
                '[["name","=","THIS-RECORD-DEFINITELY-DOES-NOT-EXIST-XYZ123"]]',
                '--format',
                'json',
            ]);
            (0, vitest_1.expect)(exitCode).toBe(0);
            (0, vitest_1.expect)(JSON.parse(stdout)).toEqual([]);
        });
    });
    // ── get ─────────────────────────────────────────────────────────────
    (0, vitest_1.describe)('records get', () => {
        (0, vitest_1.it)('returns default fields id + display_name', () => {
            // Get any partner ID first
            const { stdout: listOut } = (0, helpers_1.runCLI)([
                'records',
                'search',
                'res.partner',
                '--format',
                'json',
                '--limit',
                '1',
                '--fields',
                'id',
            ]);
            const partners = JSON.parse(listOut);
            if (partners.length === 0)
                return; // Skip if no partners
            const id = partners[0].id;
            const { stdout, exitCode } = (0, helpers_1.runCLI)([
                'records',
                'get',
                'res.partner',
                String(id),
                '--format',
                'json',
            ]);
            (0, vitest_1.expect)(exitCode).toBe(0);
            const rec = JSON.parse(stdout);
            (0, vitest_1.expect)(rec).toHaveProperty('id', id);
            (0, vitest_1.expect)(rec).toHaveProperty('display_name');
        });
        (0, vitest_1.it)('exits 3 for non-existent record', () => {
            const { exitCode } = (0, helpers_1.runCLI)(['records', 'get', 'res.partner', '9999999']);
            (0, vitest_1.expect)(exitCode).toBe(3);
        });
    });
    // ── create ──────────────────────────────────────────────────────────
    (0, vitest_1.describe)('records create', () => {
        (0, vitest_1.it)('requires --confirm', () => {
            const { exitCode, stderr } = (0, helpers_1.runCLI)([
                'records',
                'create',
                'res.partner',
                '--data',
                '{"name":"Test CI Partner"}',
            ]);
            (0, vitest_1.expect)(exitCode).toBe(1);
            (0, vitest_1.expect)(stderr).toMatch(/--confirm/i);
        });
        (0, vitest_1.it)('creates a record and returns ID with --confirm', () => {
            const { stdout, exitCode } = (0, helpers_1.runCLI)([
                'records',
                'create',
                'res.partner',
                '--data',
                '{"name":"odoo-cli CI Test Partner","active":true}',
                '--confirm',
                '--format',
                'json',
            ]);
            (0, vitest_1.expect)(exitCode).toBe(0);
            const result = JSON.parse(stdout);
            (0, vitest_1.expect)(result).toHaveProperty('id');
            (0, vitest_1.expect)(typeof result.id).toBe('number');
            createdIds.push(result.id);
        });
        (0, vitest_1.it)('--dry-run does not create record', () => {
            const { exitCode } = (0, helpers_1.runCLI)([
                'records',
                'create',
                'res.partner',
                '--data',
                '{"name":"DRY RUN SHOULD NOT EXIST"}',
                '--confirm',
                '--dry-run',
            ]);
            (0, vitest_1.expect)(exitCode).toBe(0);
            // Verify record was not created
            const { stdout } = (0, helpers_1.runCLI)([
                'records',
                'search',
                'res.partner',
                '--domain',
                '[["name","=","DRY RUN SHOULD NOT EXIST"]]',
                '--format',
                'json',
            ]);
            (0, vitest_1.expect)(JSON.parse(stdout)).toEqual([]);
        });
    });
    // ── write ──────────────────────────────────────────────────────────
    (0, vitest_1.describe)('records write', () => {
        (0, vitest_1.it)('requires --confirm', () => {
            const { exitCode, stderr } = (0, helpers_1.runCLI)([
                'records',
                'write',
                'res.partner',
                '1',
                '--data',
                '{"name":"New Name"}',
            ]);
            (0, vitest_1.expect)(exitCode).toBe(1);
            (0, vitest_1.expect)(stderr).toMatch(/--confirm/i);
        });
    });
    // ── delete ─────────────────────────────────────────────────────────
    (0, vitest_1.describe)('records delete', () => {
        (0, vitest_1.it)('requires --confirm', () => {
            const { exitCode, stderr } = (0, helpers_1.runCLI)(['records', 'delete', 'res.partner', '9999999']);
            (0, vitest_1.expect)(exitCode).toBe(1);
            (0, vitest_1.expect)(stderr).toMatch(/--confirm/i);
        });
    });
    // ── count ──────────────────────────────────────────────────────────
    (0, vitest_1.describe)('records count', () => {
        (0, vitest_1.it)('outputs bare integer', () => {
            const { stdout, exitCode } = (0, helpers_1.runCLI)(['records', 'count', 'res.partner']);
            (0, vitest_1.expect)(exitCode).toBe(0);
            const n = parseInt(stdout.trim(), 10);
            (0, vitest_1.expect)(isNaN(n)).toBe(false);
            (0, vitest_1.expect)(n).toBeGreaterThan(0);
        });
    });
    // ── CRUD round trip ─────────────────────────────────────────────────
    (0, vitest_1.describe)('CRUD round trip', () => {
        (0, vitest_1.it)('create → get → write → delete', () => {
            // Create
            const { stdout: createOut } = (0, helpers_1.runCLI)([
                'records',
                'create',
                'res.partner',
                '--data',
                '{"name":"odoo-cli CRUD Test"}',
                '--confirm',
                '--format',
                'json',
            ]);
            const created = JSON.parse(createOut);
            const id = created.id;
            (0, vitest_1.expect)(typeof id).toBe('number');
            // Get
            const { stdout: getOut, exitCode: getCode } = (0, helpers_1.runCLI)([
                'records',
                'get',
                'res.partner',
                String(id),
                '--format',
                'json',
            ]);
            (0, vitest_1.expect)(getCode).toBe(0);
            const fetched = JSON.parse(getOut);
            (0, vitest_1.expect)(fetched.id).toBe(id);
            // Write
            const { exitCode: writeCode } = (0, helpers_1.runCLI)([
                'records',
                'write',
                'res.partner',
                String(id),
                '--data',
                '{"name":"odoo-cli CRUD Updated"}',
                '--confirm',
            ]);
            (0, vitest_1.expect)(writeCode).toBe(0);
            // Delete
            const { exitCode: deleteCode } = (0, helpers_1.runCLI)([
                'records',
                'delete',
                'res.partner',
                String(id),
                '--confirm',
            ]);
            (0, vitest_1.expect)(deleteCode).toBe(0);
            // Verify gone
            const { exitCode: gone } = (0, helpers_1.runCLI)(['records', 'get', 'res.partner', String(id)]);
            (0, vitest_1.expect)(gone).toBe(3);
        });
    });
});
// ── Tests that don't require Odoo ────────────────────────────────────
(0, vitest_1.describe)('records (no Odoo)', () => {
    (0, vitest_1.it)('returns exit 2 with missing credentials', () => {
        const { exitCode } = (0, helpers_1.runCLI)(['records', 'search', 'res.partner'], {
            ODOO_URL: '',
            ODOO_DB: '',
            ODOO_USERNAME: '',
            ODOO_PASSWORD: '',
        });
        (0, vitest_1.expect)(exitCode).toBe(2);
    });
    (0, vitest_1.it)('records create requires --confirm (no Odoo needed)', () => {
        const { exitCode, stderr } = (0, helpers_1.runCLI)(['records', 'create', 'res.partner', '--data', '{"name":"Test"}'], { ODOO_URL: '', ODOO_DB: '', ODOO_USERNAME: '', ODOO_PASSWORD: '' });
        // Exit 1 = usage error (--confirm missing), checked before auth
        (0, vitest_1.expect)(exitCode).toBe(1);
        (0, vitest_1.expect)(stderr).toMatch(/--confirm/i);
    });
});
//# sourceMappingURL=records.e2e.test.js.map