"use strict";
/**
 * Integration tests for odoo-client examples
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const src_1 = require("../src");
(0, vitest_1.describe)('odoo-client examples', () => {
    let client;
    (0, vitest_1.beforeAll)(async () => {
        client = new src_1.OdooClient({
            url: process.env.ODOO_URL || 'http://localhost:8069',
            database: process.env.ODOO_DB || 'odoo',
            username: process.env.ODOO_USER || 'admin',
            password: process.env.ODOO_PASSWORD || 'admin',
        });
        await client.authenticate();
    });
    (0, vitest_1.afterAll)(async () => {
        await client.logout();
    });
    (0, vitest_1.describe)('Example 1: Basic Connection', () => {
        (0, vitest_1.it)('should authenticate successfully', async () => {
            const sessionInfo = await client.authenticate();
            (0, vitest_1.expect)(sessionInfo).toBeDefined();
            (0, vitest_1.expect)(sessionInfo.uid).toBeGreaterThan(0);
        });
        (0, vitest_1.it)('should verify connection by reading partner', async () => {
            const sessionInfo = await client.authenticate();
            const [partnerId] = await client.search('res.partner', [['id', '=', sessionInfo.partner_id]]);
            const [partner] = await client.read('res.partner', [partnerId], ['name', 'email']);
            (0, vitest_1.expect)(partner).toBeDefined();
            (0, vitest_1.expect)(partner.name).toBeDefined();
        });
    });
    (0, vitest_1.describe)('Example 2: CRUD Operations', () => {
        let testPartnerId;
        (0, vitest_1.it)('should create a new partner', async () => {
            testPartnerId = await client.create('res.partner', {
                name: 'Test Partner',
                email: 'test@example.com',
                is_company: false,
            });
            (0, vitest_1.expect)(testPartnerId).toBeGreaterThan(0);
        });
        (0, vitest_1.it)('should read the created partner', async () => {
            const [partner] = await client.read('res.partner', [testPartnerId], ['id', 'name', 'email']);
            (0, vitest_1.expect)(partner).toBeDefined();
            (0, vitest_1.expect)(partner.name).toBe('Test Partner');
            (0, vitest_1.expect)(partner.email).toBe('test@example.com');
        });
        (0, vitest_1.it)('should update the partner', async () => {
            const success = await client.write('res.partner', [testPartnerId], {
                email: 'updated@example.com',
            });
            (0, vitest_1.expect)(success).toBe(true);
            const [partner] = await client.read('res.partner', [testPartnerId], ['email']);
            (0, vitest_1.expect)(partner.email).toBe('updated@example.com');
        });
        (0, vitest_1.it)('should delete the partner', async () => {
            const success = await client.unlink('res.partner', [testPartnerId]);
            (0, vitest_1.expect)(success).toBe(true);
            // Verify deletion using search (bypasses read cache)
            await new Promise((resolve) => setTimeout(resolve, 1000));
            const foundIds = await client.search('res.partner', [['id', '=', testPartnerId]]);
            (0, vitest_1.expect)(foundIds.length).toBe(0);
        });
        (0, vitest_1.it)('should batch create partners', async () => {
            const ids = await Promise.all([
                client.create('res.partner', { name: 'Batch 1', is_company: false }),
                client.create('res.partner', { name: 'Batch 2', is_company: false }),
                client.create('res.partner', { name: 'Batch 3', is_company: false }),
            ]);
            (0, vitest_1.expect)(ids).toHaveLength(3);
            ids.forEach((id) => (0, vitest_1.expect)(id).toBeGreaterThan(0));
            // Cleanup and verify deletion
            await client.unlink('res.partner', ids);
            await new Promise((resolve) => setTimeout(resolve, 1000));
            const foundIds = await client.search('res.partner', [['id', 'in', ids]]);
            (0, vitest_1.expect)(foundIds.length).toBe(0);
        });
    });
    (0, vitest_1.describe)('Example 3: Search and Filtering', () => {
        (0, vitest_1.it)('should search all partners', async () => {
            const allIds = await client.search('res.partner', []);
            (0, vitest_1.expect)(allIds).toBeDefined();
            (0, vitest_1.expect)(allIds.length).toBeGreaterThan(0);
        });
        (0, vitest_1.it)('should search with exact match', async () => {
            const companyIds = await client.search('res.partner', [['is_company', '=', true]]);
            (0, vitest_1.expect)(companyIds).toBeDefined();
            (0, vitest_1.expect)(Array.isArray(companyIds)).toBe(true);
        });
        (0, vitest_1.it)('should search with IN operator', async () => {
            const allIds = await client.search('res.partner', []);
            const targetIds = allIds.slice(0, Math.min(3, allIds.length));
            if (targetIds.length > 0) {
                const matchingIds = await client.search('res.partner', [['id', 'in', targetIds]]);
                (0, vitest_1.expect)(matchingIds.length).toBeLessThanOrEqual(targetIds.length);
            }
        });
        (0, vitest_1.it)('should search with OR logic', async () => {
            const orIds = await client.search('res.partner', [
                '|',
                ['is_company', '=', true],
                ['email', '!=', false],
            ]);
            (0, vitest_1.expect)(orIds).toBeDefined();
            (0, vitest_1.expect)(Array.isArray(orIds)).toBe(true);
        });
        (0, vitest_1.it)('should search with pagination', async () => {
            const paginated = await client.search('res.partner', [], {
                limit: 5,
                offset: 0,
                order: 'name ASC',
            });
            (0, vitest_1.expect)(paginated).toBeDefined();
            (0, vitest_1.expect)(paginated.length).toBeLessThanOrEqual(5);
        });
        (0, vitest_1.it)('should use searchRead for combined operation', async () => {
            const results = await client.searchRead('res.partner', [['is_company', '=', true]]);
            (0, vitest_1.expect)(results).toBeDefined();
            (0, vitest_1.expect)(Array.isArray(results)).toBe(true);
            if (results.length > 0) {
                (0, vitest_1.expect)(results[0]).toHaveProperty('id');
                (0, vitest_1.expect)(results[0]).toHaveProperty('name');
            }
        });
        (0, vitest_1.it)('should filter by many2one relationship', async () => {
            const usaPartners = await client.search('res.partner', [['country_id', '=', 1]]);
            (0, vitest_1.expect)(usaPartners).toBeDefined();
            (0, vitest_1.expect)(Array.isArray(usaPartners)).toBe(true);
        });
    });
    (0, vitest_1.describe)('Example 4: Context Variables and Batch Operations', () => {
        const batchIds = [];
        (0, vitest_1.it)('should batch create with context', async () => {
            const names = ['Context Test 1', 'Context Test 2', 'Context Test 3'];
            for (const name of names) {
                const id = await client.create('res.partner', { name, is_company: false }, { lang: 'en_US', tz: 'UTC' });
                batchIds.push(id);
            }
            (0, vitest_1.expect)(batchIds).toHaveLength(3);
            batchIds.forEach((id) => (0, vitest_1.expect)(id).toBeGreaterThan(0));
        });
        (0, vitest_1.it)('should batch update with context', async () => {
            const success = await client.write('res.partner', batchIds, { email: 'batch@test.com' }, { lang: 'en_US' });
            (0, vitest_1.expect)(success).toBe(true);
            const results = await client.read('res.partner', batchIds, ['email']);
            results.forEach((partner) => {
                (0, vitest_1.expect)(partner.email).toBe('batch@test.com');
            });
        });
        (0, vitest_1.it)('should search with context', async () => {
            const results = await client.searchRead('res.partner', [['id', 'in', batchIds]]);
            (0, vitest_1.expect)(results).toHaveLength(batchIds.length);
        });
        (0, vitest_1.afterAll)(async () => {
            // Cleanup
            if (batchIds.length > 0) {
                await client.unlink('res.partner', batchIds);
            }
        });
    });
});
//# sourceMappingURL=examples.integration.test.js.map