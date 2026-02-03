"use strict";
/**
 * Unit tests for SessionManager.
 *
 * Tests cover:
 * - Authentication flow
 * - Logout and state cleanup
 * - State transitions
 * - Error handling for unauthenticated access
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const session_manager_1 = require("../src/session/session-manager");
// Mock the dependencies
vitest_1.vi.mock('@odoo-toolbox/client', () => {
    return {
        OdooClient: class MockOdooClient {
            async authenticate() {
                return { uid: 1, session_id: 'test-session', db: 'test-db' };
            }
            logout() { }
        },
        ModuleManager: class MockModuleManager {
        },
        OdooError: class OdooError extends Error {
        },
        OdooRpcError: class OdooRpcError extends Error {
            code;
            data;
        },
        OdooAuthError: class OdooAuthError extends Error {
        },
        OdooNetworkError: class OdooNetworkError extends Error {
            cause;
        },
    };
});
vitest_1.vi.mock('@odoo-toolbox/introspection', () => {
    return {
        Introspector: class MockIntrospector {
        },
    };
});
(0, vitest_1.describe)('SessionManager', () => {
    let session;
    (0, vitest_1.beforeEach)(() => {
        session = new session_manager_1.SessionManager();
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.describe)('initial state', () => {
        (0, vitest_1.it)('starts as not authenticated', () => {
            (0, vitest_1.expect)(session.isAuthenticated()).toBe(false);
        });
        (0, vitest_1.it)('returns disconnected status', () => {
            const status = session.getStatus();
            (0, vitest_1.expect)(status.isConnected).toBe(false);
            (0, vitest_1.expect)(status.isAuthenticated).toBe(false);
            (0, vitest_1.expect)(status.uid).toBeNull();
            (0, vitest_1.expect)(status.client).toBeNull();
        });
    });
    (0, vitest_1.describe)('authenticate', () => {
        const testConfig = {
            url: 'http://localhost:8069',
            database: 'test-db',
            username: 'admin',
            password: 'admin',
        };
        (0, vitest_1.it)('successfully authenticates with valid credentials', async () => {
            const result = await session.authenticate(testConfig);
            (0, vitest_1.expect)(result.uid).toBe(1);
            (0, vitest_1.expect)(session.isAuthenticated()).toBe(true);
        });
        (0, vitest_1.it)('sets up client and introspector after authentication', async () => {
            await session.authenticate(testConfig);
            const status = session.getStatus();
            (0, vitest_1.expect)(status.isConnected).toBe(true);
            (0, vitest_1.expect)(status.client).not.toBeNull();
            (0, vitest_1.expect)(status.introspector).not.toBeNull();
            (0, vitest_1.expect)(status.moduleManager).not.toBeNull();
        });
        (0, vitest_1.it)('stores connection configuration', async () => {
            await session.authenticate(testConfig);
            const status = session.getStatus();
            (0, vitest_1.expect)(status.config?.url).toBe(testConfig.url);
            (0, vitest_1.expect)(status.config?.database).toBe(testConfig.database);
        });
        (0, vitest_1.it)('sets connectedAt timestamp', async () => {
            const before = new Date();
            await session.authenticate(testConfig);
            const after = new Date();
            const status = session.getStatus();
            (0, vitest_1.expect)(status.connectedAt).not.toBeNull();
            (0, vitest_1.expect)(status.connectedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
            (0, vitest_1.expect)(status.connectedAt.getTime()).toBeLessThanOrEqual(after.getTime());
        });
        (0, vitest_1.it)('clears previous session when re-authenticating', async () => {
            await session.authenticate(testConfig);
            session.getStatus(); // Ensure first auth works
            await session.authenticate({ ...testConfig, database: 'other-db' });
            const secondStatus = session.getStatus();
            (0, vitest_1.expect)(secondStatus.config?.database).toBe('other-db');
        });
    });
    (0, vitest_1.describe)('logout', () => {
        (0, vitest_1.it)('clears authenticated state', async () => {
            await session.authenticate({
                url: 'http://localhost:8069',
                database: 'test-db',
                username: 'admin',
                password: 'admin',
            });
            session.logout();
            (0, vitest_1.expect)(session.isAuthenticated()).toBe(false);
        });
        (0, vitest_1.it)('clears all session state', async () => {
            await session.authenticate({
                url: 'http://localhost:8069',
                database: 'test-db',
                username: 'admin',
                password: 'admin',
            });
            session.logout();
            const status = session.getStatus();
            (0, vitest_1.expect)(status.isConnected).toBe(false);
            (0, vitest_1.expect)(status.client).toBeNull();
            (0, vitest_1.expect)(status.introspector).toBeNull();
            (0, vitest_1.expect)(status.moduleManager).toBeNull();
            (0, vitest_1.expect)(status.uid).toBeNull();
            (0, vitest_1.expect)(status.config).toBeNull();
        });
        (0, vitest_1.it)('is safe to call when not authenticated', () => {
            (0, vitest_1.expect)(() => session.logout()).not.toThrow();
        });
    });
    (0, vitest_1.describe)('getClient', () => {
        (0, vitest_1.it)('returns client when authenticated', async () => {
            await session.authenticate({
                url: 'http://localhost:8069',
                database: 'test-db',
                username: 'admin',
                password: 'admin',
            });
            (0, vitest_1.expect)(() => session.getClient()).not.toThrow();
        });
        (0, vitest_1.it)('throws when not authenticated', () => {
            (0, vitest_1.expect)(() => session.getClient()).toThrow('Not authenticated');
        });
    });
    (0, vitest_1.describe)('getIntrospector', () => {
        (0, vitest_1.it)('returns introspector when authenticated', async () => {
            await session.authenticate({
                url: 'http://localhost:8069',
                database: 'test-db',
                username: 'admin',
                password: 'admin',
            });
            (0, vitest_1.expect)(() => session.getIntrospector()).not.toThrow();
        });
        (0, vitest_1.it)('throws when not authenticated', () => {
            (0, vitest_1.expect)(() => session.getIntrospector()).toThrow('Not authenticated');
        });
    });
    (0, vitest_1.describe)('getModuleManager', () => {
        (0, vitest_1.it)('returns module manager when authenticated', async () => {
            await session.authenticate({
                url: 'http://localhost:8069',
                database: 'test-db',
                username: 'admin',
                password: 'admin',
            });
            (0, vitest_1.expect)(() => session.getModuleManager()).not.toThrow();
        });
        (0, vitest_1.it)('throws when not authenticated', () => {
            (0, vitest_1.expect)(() => session.getModuleManager()).toThrow('Not authenticated');
        });
    });
});
//# sourceMappingURL=session-manager.test.js.map