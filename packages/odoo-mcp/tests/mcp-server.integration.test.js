"use strict";
/**
 * Integration tests for the MCP server.
 *
 * Tests the full lifecycle against a real Odoo instance:
 * - Server creation and tool registration
 * - Authentication flow
 * - CRUD operations
 * - Module operations
 * - Introspection queries
 *
 * Requires Docker Odoo container to be running.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const server_1 = require("../src/server");
const index_1 = require("../src/tools/index");
// Test configuration from environment
const testConfig = {
    url: process.env.ODOO_URL || 'http://localhost:8069',
    database: process.env.ODOO_DB_NAME || 'odoo',
    username: process.env.ODOO_DB_USER || 'admin',
    password: process.env.ODOO_DB_PASSWORD || 'admin',
};
(0, vitest_1.describe)('MCP Server Integration', () => {
    let session;
    const createdRecordIds = [];
    (0, vitest_1.beforeAll)(async () => {
        const { session: serverSession } = (0, server_1.createOdooMcpServer)();
        session = serverSession;
    });
    (0, vitest_1.afterAll)(async () => {
        // Cleanup any created records
        if (session.isAuthenticated()) {
            for (const id of createdRecordIds) {
                try {
                    await (0, index_1.handleUnlink)(session, { model: 'res.partner', ids: id });
                }
                catch {
                    // Ignore cleanup errors
                }
            }
            session.logout();
        }
    });
    (0, vitest_1.describe)('Server Creation', () => {
        (0, vitest_1.it)('creates server with session manager', () => {
            const { server, session } = (0, server_1.createOdooMcpServer)();
            (0, vitest_1.expect)(server).toBeDefined();
            (0, vitest_1.expect)(session).toBeDefined();
            (0, vitest_1.expect)(session.isAuthenticated()).toBe(false);
        });
    });
    (0, vitest_1.describe)('Authentication Flow', () => {
        (0, vitest_1.it)('authenticates with valid credentials', async () => {
            const result = await (0, index_1.handleAuthenticate)(session, testConfig);
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.uid).toBeGreaterThan(0);
            (0, vitest_1.expect)(session.isAuthenticated()).toBe(true);
        });
        (0, vitest_1.it)('reports authenticated status', () => {
            const result = (0, index_1.handleConnectionStatus)(session);
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.connected).toBe(true);
            (0, vitest_1.expect)(result.authenticated).toBe(true);
            (0, vitest_1.expect)(result.database).toBe(testConfig.database);
        });
    });
    (0, vitest_1.describe)('CRUD Operations', () => {
        (0, vitest_1.it)('searches for records', async () => {
            const result = await (0, index_1.handleSearch)(session, {
                model: 'res.partner',
                domain: [],
                limit: 5,
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.ids.length).toBeGreaterThanOrEqual(0);
            (0, vitest_1.expect)(result.ids.length).toBeLessThanOrEqual(5);
        });
        (0, vitest_1.it)('reads records by ID', async () => {
            // First search to get some IDs
            const searchResult = await (0, index_1.handleSearch)(session, {
                model: 'res.partner',
                domain: [],
                limit: 1,
            });
            if (searchResult.ids.length > 0) {
                const result = await (0, index_1.handleRead)(session, {
                    model: 'res.partner',
                    ids: searchResult.ids[0],
                    fields: ['name', 'email'],
                });
                (0, vitest_1.expect)(result.success).toBe(true);
                (0, vitest_1.expect)(result.records.length).toBe(1);
                (0, vitest_1.expect)(result.records[0]).toHaveProperty('name');
            }
        });
        (0, vitest_1.it)('performs searchRead', async () => {
            const result = await (0, index_1.handleSearchRead)(session, {
                model: 'res.partner',
                domain: [],
                fields: ['name', 'email'],
                limit: 3,
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(Array.isArray(result.records)).toBe(true);
        });
        (0, vitest_1.it)('creates a record', async () => {
            const uniqueName = `MCP Test Partner ${Date.now()}`;
            const result = await (0, index_1.handleCreate)(session, {
                model: 'res.partner',
                values: {
                    name: uniqueName,
                    is_company: true,
                },
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.id).toBeGreaterThan(0);
            // Track for cleanup
            createdRecordIds.push(result.id);
        });
        (0, vitest_1.it)('updates a record', async () => {
            // Create a record first
            const createResult = await (0, index_1.handleCreate)(session, {
                model: 'res.partner',
                values: { name: `MCP Test Update ${Date.now()}` },
            });
            const id = createResult.id;
            createdRecordIds.push(id);
            // Update it
            const result = await (0, index_1.handleWrite)(session, {
                model: 'res.partner',
                ids: id,
                values: { name: 'Updated MCP Test Partner' },
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.updated).toBe(true);
            // Verify the update
            const readResult = await (0, index_1.handleRead)(session, {
                model: 'res.partner',
                ids: id,
                fields: ['name'],
            });
            (0, vitest_1.expect)(readResult.records[0].name).toBe('Updated MCP Test Partner');
        });
        (0, vitest_1.it)('deletes a record', async () => {
            // Create a record to delete
            const createResult = await (0, index_1.handleCreate)(session, {
                model: 'res.partner',
                values: { name: `MCP Test Delete ${Date.now()}` },
            });
            const id = createResult.id;
            // Delete it
            const result = await (0, index_1.handleUnlink)(session, {
                model: 'res.partner',
                ids: id,
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.deleted).toBe(true);
            // Verify deletion - search should not find it
            const searchResult = await (0, index_1.handleSearch)(session, {
                model: 'res.partner',
                domain: [['id', '=', id]],
            });
            (0, vitest_1.expect)(searchResult.ids).toHaveLength(0);
        });
    });
    (0, vitest_1.describe)('Introspection', () => {
        (0, vitest_1.it)('lists available models', async () => {
            const result = await (0, index_1.handleGetModels)(session, {});
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.models.length).toBeGreaterThan(0);
            // Should include common models
            const modelNames = result.models.map((m) => m.model);
            (0, vitest_1.expect)(modelNames).toContain('res.partner');
            (0, vitest_1.expect)(modelNames).toContain('res.users');
        });
        (0, vitest_1.it)('gets fields for a model', async () => {
            const result = await (0, index_1.handleGetFields)(session, {
                model: 'res.partner',
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.fields.length).toBeGreaterThan(0);
            // Should include common fields
            const fieldNames = result.fields.map((f) => f.name);
            (0, vitest_1.expect)(fieldNames).toContain('name');
            (0, vitest_1.expect)(fieldNames).toContain('email');
        });
        (0, vitest_1.it)('gets complete model metadata', async () => {
            const result = await (0, index_1.handleGetModelMetadata)(session, {
                model: 'res.partner',
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.metadata.model.model).toBe('res.partner');
            (0, vitest_1.expect)(result.metadata.fields.length).toBeGreaterThan(0);
        });
    });
    (0, vitest_1.describe)('Module Operations', () => {
        (0, vitest_1.it)('lists installed modules', async () => {
            const result = await (0, index_1.handleModuleList)(session, {
                state: 'installed',
                limit: 10,
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.modules.length).toBeGreaterThan(0);
            // Base module should always be installed
            const moduleNames = result.modules.map((m) => m.name);
            (0, vitest_1.expect)(moduleNames).toContain('base');
        });
    });
    (0, vitest_1.describe)('Logout', () => {
        (0, vitest_1.it)('logs out successfully', () => {
            // Re-authenticate if not authenticated
            if (!session.isAuthenticated()) {
                // Skip this test if we're not authenticated
                return;
            }
            const result = (0, index_1.handleLogout)(session);
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(session.isAuthenticated()).toBe(false);
        });
        (0, vitest_1.it)('reports disconnected after logout', () => {
            const result = (0, index_1.handleConnectionStatus)(session);
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.authenticated).toBe(false);
        });
    });
});
//# sourceMappingURL=mcp-server.integration.test.js.map