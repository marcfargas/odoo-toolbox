"use strict";
/**
 * Unit tests for connection tools.
 *
 * Tests cover:
 * - Authentication tool
 * - Logout tool
 * - Connection status tool
 * - Input validation
 * - Error handling
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const connection_1 = require("../../src/tools/connection");
// Create mock session
const createMockSession = (authenticated = false) => {
    const mockSession = {
        authenticate: vitest_1.vi.fn().mockResolvedValue({ uid: 1 }),
        logout: vitest_1.vi.fn(),
        isAuthenticated: vitest_1.vi.fn().mockReturnValue(authenticated),
        getStatus: vitest_1.vi.fn().mockReturnValue({
            isConnected: authenticated,
            isAuthenticated: authenticated,
            config: authenticated ? { url: 'http://localhost:8069', database: 'test-db' } : null,
            uid: authenticated ? 1 : null,
            connectedAt: authenticated ? new Date() : null,
        }),
        getClient: vitest_1.vi.fn(),
        getIntrospector: vitest_1.vi.fn(),
        getModuleManager: vitest_1.vi.fn(),
    };
    return mockSession;
};
(0, vitest_1.describe)('Connection Tools', () => {
    (0, vitest_1.describe)('handleAuthenticate', () => {
        (0, vitest_1.it)('authenticates with valid credentials', async () => {
            const session = createMockSession();
            const result = await (0, connection_1.handleAuthenticate)(session, {
                url: 'http://localhost:8069',
                database: 'test-db',
                username: 'admin',
                password: 'admin',
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.uid).toBe(1);
            (0, vitest_1.expect)(result.database).toBe('test-db');
        });
        (0, vitest_1.it)('returns error for invalid input - missing url', async () => {
            const session = createMockSession();
            const result = await (0, connection_1.handleAuthenticate)(session, {
                database: 'test-db',
                username: 'admin',
                password: 'admin',
            });
            (0, vitest_1.expect)(result.success).toBe(false);
            (0, vitest_1.expect)(result.error.code).toBe('INVALID_INPUT');
        });
        (0, vitest_1.it)('returns error for invalid input - invalid url', async () => {
            const session = createMockSession();
            const result = await (0, connection_1.handleAuthenticate)(session, {
                url: 'not-a-url',
                database: 'test-db',
                username: 'admin',
                password: 'admin',
            });
            (0, vitest_1.expect)(result.success).toBe(false);
            (0, vitest_1.expect)(result.error.code).toBe('INVALID_INPUT');
        });
        (0, vitest_1.it)('returns error for empty database', async () => {
            const session = createMockSession();
            const result = await (0, connection_1.handleAuthenticate)(session, {
                url: 'http://localhost:8069',
                database: '',
                username: 'admin',
                password: 'admin',
            });
            (0, vitest_1.expect)(result.success).toBe(false);
            (0, vitest_1.expect)(result.error.code).toBe('INVALID_INPUT');
        });
        (0, vitest_1.it)('handles authentication failure', async () => {
            const session = createMockSession();
            session.authenticate.mockRejectedValue(new Error('Invalid credentials'));
            const result = await (0, connection_1.handleAuthenticate)(session, {
                url: 'http://localhost:8069',
                database: 'test-db',
                username: 'admin',
                password: 'wrong',
            });
            (0, vitest_1.expect)(result.success).toBe(false);
            (0, vitest_1.expect)(result.error.code).toBe('INTERNAL_ERROR');
        });
    });
    (0, vitest_1.describe)('handleLogout', () => {
        (0, vitest_1.it)('logs out successfully when authenticated', () => {
            const session = createMockSession(true);
            const result = (0, connection_1.handleLogout)(session);
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.message).toContain('Successfully logged out');
            (0, vitest_1.expect)(session.logout).toHaveBeenCalled();
        });
        (0, vitest_1.it)('handles logout when not authenticated', () => {
            const session = createMockSession(false);
            const result = (0, connection_1.handleLogout)(session);
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.message).toContain('No active session');
        });
    });
    (0, vitest_1.describe)('handleConnectionStatus', () => {
        (0, vitest_1.it)('returns connected status when authenticated', () => {
            const session = createMockSession(true);
            const result = (0, connection_1.handleConnectionStatus)(session);
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.connected).toBe(true);
            (0, vitest_1.expect)(result.authenticated).toBe(true);
            (0, vitest_1.expect)(result.uid).toBe(1);
        });
        (0, vitest_1.it)('returns disconnected status when not authenticated', () => {
            const session = createMockSession(false);
            const result = (0, connection_1.handleConnectionStatus)(session);
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.connected).toBe(false);
            (0, vitest_1.expect)(result.authenticated).toBe(false);
            (0, vitest_1.expect)(result.message).toBe('Not connected');
        });
        (0, vitest_1.it)('includes database and url when connected', () => {
            const session = createMockSession(true);
            const result = (0, connection_1.handleConnectionStatus)(session);
            (0, vitest_1.expect)(result.url).toBe('http://localhost:8069');
            (0, vitest_1.expect)(result.database).toBe('test-db');
        });
    });
});
//# sourceMappingURL=connection.test.js.map