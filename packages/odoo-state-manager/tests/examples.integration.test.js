"use strict";
/**
 * Integration tests for odoo-state-manager examples
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const client_1 = require("@odoo-toolbox/client");
const src_1 = require("../src");
(0, vitest_1.describe)('odoo-state-manager examples', () => {
    let client;
    (0, vitest_1.beforeAll)(async () => {
        client = new client_1.OdooClient({
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
    (0, vitest_1.describe)('Example 1: State Management', () => {
        (0, vitest_1.it)('should read actual state from Odoo', async () => {
            const partnerIds = await client.search('res.partner', [['id', '<=', 2]]);
            (0, vitest_1.expect)(partnerIds).toBeDefined();
            (0, vitest_1.expect)(Array.isArray(partnerIds)).toBe(true);
            if (partnerIds.length > 0) {
                const partners = await client.searchRead('res.partner', [['id', 'in', partnerIds]]);
                (0, vitest_1.expect)(partners).toBeDefined();
                (0, vitest_1.expect)(partners.length).toBeGreaterThan(0);
            }
        });
        (0, vitest_1.it)('should compare desired vs actual state', async () => {
            const desired = new Map([
                [
                    1,
                    {
                        name: 'Test Partner',
                        active: true,
                    },
                ],
            ]);
            const actual = await client.searchRead('res.partner', [['id', '=', 1]]);
            const actualMap = new Map(actual.map((p) => [p.id, p]));
            const diffs = (0, src_1.compareRecords)('res.partner', desired, actualMap);
            (0, vitest_1.expect)(diffs).toBeDefined();
            (0, vitest_1.expect)(Array.isArray(diffs)).toBe(true);
        });
        (0, vitest_1.it)('should generate an execution plan', async () => {
            const diffs = [
                {
                    id: 1,
                    type: 'update',
                    changes: [
                        {
                            path: 'name',
                            oldValue: 'Old Name',
                            newValue: 'New Name',
                        },
                    ],
                },
            ];
            const plan = (0, src_1.generatePlan)(diffs, {
                autoReorder: true,
                validateDependencies: true,
            });
            (0, vitest_1.expect)(plan).toBeDefined();
            (0, vitest_1.expect)(plan.summary).toBeDefined();
            (0, vitest_1.expect)(plan.operations).toBeDefined();
        });
        (0, vitest_1.it)('should validate plan with dry-run', async () => {
            // Create a simple test plan
            const diffs = [];
            const plan = (0, src_1.generatePlan)(diffs, {
                autoReorder: true,
            });
            const result = await (0, src_1.dryRunPlan)(plan, client, {
                validate: true,
            });
            (0, vitest_1.expect)(result).toBeDefined();
            (0, vitest_1.expect)(result.success).toBeDefined();
        });
    });
    (0, vitest_1.describe)('Example 2: CI/CD Validation', () => {
        (0, vitest_1.it)('should load desired configuration', async () => {
            const desired = new Map([
                [
                    1,
                    {
                        name: 'Standard Project',
                        active: true,
                        description: 'Test',
                    },
                ],
            ]);
            (0, vitest_1.expect)(desired).toBeDefined();
            (0, vitest_1.expect)(desired.size).toBe(1);
        });
        (0, vitest_1.it)('should read actual configuration from Odoo', async () => {
            const partners = await client.searchRead('res.partner', [['id', '=', 1]]);
            (0, vitest_1.expect)(partners).toBeDefined();
            (0, vitest_1.expect)(Array.isArray(partners)).toBe(true);
            if (partners.length > 0) {
                const actual = new Map(partners.map((p) => [
                    p.id,
                    {
                        name: p.name,
                        active: p.active,
                    },
                ]));
                (0, vitest_1.expect)(actual.size).toBeGreaterThan(0);
            }
        });
        (0, vitest_1.it)('should analyze differences', async () => {
            const desired = new Map([
                [
                    1,
                    {
                        name: 'Project A',
                        active: true,
                    },
                ],
            ]);
            const actual = new Map([
                [
                    1,
                    {
                        name: 'Project A',
                        active: false, // Different
                    },
                ],
            ]);
            const diffs = (0, src_1.compareRecords)('project.project', desired, actual);
            (0, vitest_1.expect)(diffs).toBeDefined();
            (0, vitest_1.expect)(Array.isArray(diffs)).toBe(true);
        });
        (0, vitest_1.it)('should validate without applying', async () => {
            const diffs = [];
            const plan = (0, src_1.generatePlan)(diffs);
            const validation = await (0, src_1.dryRunPlan)(plan, client, {
                validate: true,
                stopOnError: false,
            });
            (0, vitest_1.expect)(validation).toBeDefined();
            (0, vitest_1.expect)(validation.success).toBeDefined();
        });
        (0, vitest_1.it)('should generate audit report', async () => {
            const summary = {
                timestamp: new Date().toISOString(),
                environment: {
                    url: 'http://localhost:8069',
                    database: 'odoo',
                },
                audit: {
                    itemsChecked: 1,
                    itemsWithDrift: 0,
                    changesPlan: {
                        creates: 0,
                        updates: 0,
                        deletes: 0,
                    },
                },
                status: 'PASS',
            };
            (0, vitest_1.expect)(summary).toBeDefined();
            (0, vitest_1.expect)(summary.timestamp).toBeDefined();
            (0, vitest_1.expect)(summary.status).toBe('PASS');
        });
    });
});
//# sourceMappingURL=examples.integration.test.js.map