"use strict";
/**
 * E2E tests for `odoo mail` commands.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const helpers_1 = require("./helpers");
const skip = !(0, helpers_1.hasOdooCredentials)();
(0, vitest_1.describe)('mail (no Odoo)', () => {
    (0, vitest_1.it)('mail note requires --confirm', () => {
        const { exitCode, stderr } = (0, helpers_1.runCLI)(['mail', 'note', 'res.partner', '1', 'Test message'], {
            ODOO_URL: 'http://fake',
            ODOO_DB: 'fake',
            ODOO_USERNAME: 'fake',
            ODOO_PASSWORD: 'fake',
        });
        (0, vitest_1.expect)(exitCode).toBe(1);
        (0, vitest_1.expect)(stderr).toMatch(/--confirm/i);
    });
    (0, vitest_1.it)('mail post requires --confirm', () => {
        const { exitCode, stderr } = (0, helpers_1.runCLI)(['mail', 'post', 'res.partner', '1', 'Test message'], {
            ODOO_URL: 'http://fake',
            ODOO_DB: 'fake',
            ODOO_USERNAME: 'fake',
            ODOO_PASSWORD: 'fake',
        });
        (0, vitest_1.expect)(exitCode).toBe(1);
        (0, vitest_1.expect)(stderr).toMatch(/--confirm/i);
    });
    (0, vitest_1.it)('mail note --dry-run does not require auth', () => {
        const { exitCode } = (0, helpers_1.runCLI)(['mail', 'note', 'res.partner', '1', 'Test', '--confirm', '--dry-run'], { ODOO_URL: 'http://fake', ODOO_DB: 'fake', ODOO_USERNAME: 'fake', ODOO_PASSWORD: 'fake' });
        // dry-run exits 0 without making network calls (no auth needed)
        (0, vitest_1.expect)(exitCode).toBe(0);
    });
});
vitest_1.describe.skipIf(skip)('mail e2e', () => {
    // Need a record to post on — use res.users (id=2 is usually admin portal)
    // We use res.partner (1 = OdooBot or company) which always exists
    (0, vitest_1.it)('mail note posts successfully to an existing record', () => {
        // Find a partner to post on
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
            return;
        const id = partners[0].id;
        const { exitCode, stderr } = (0, helpers_1.runCLI)([
            'mail',
            'note',
            'res.partner',
            String(id),
            'CI test note from odoo-cli',
            '--confirm',
        ]);
        (0, vitest_1.expect)(exitCode).toBe(0);
        (0, vitest_1.expect)(stderr).toMatch(/posted/i);
    });
});
//# sourceMappingURL=mail.e2e.test.js.map