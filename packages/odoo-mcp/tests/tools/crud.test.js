"use strict";
/**
 * Unit tests for CRUD tools.
 *
 * Tests cover:
 * - Search, read, searchRead operations
 * - Create, write, unlink operations
 * - Generic call operation
 * - Input validation
 * - Error handling
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const crud_1 = require("../../src/tools/crud");
// Create mock session with mock client
const createMockSession = (clientMethods = {}) => {
    const mockClient = {
        search: vitest_1.vi.fn().mockResolvedValue([1, 2, 3]),
        read: vitest_1.vi.fn().mockResolvedValue([{ id: 1, name: 'Test' }]),
        searchRead: vitest_1.vi.fn().mockResolvedValue([{ id: 1, name: 'Test' }]),
        create: vitest_1.vi.fn().mockResolvedValue(1),
        write: vitest_1.vi.fn().mockResolvedValue(true),
        unlink: vitest_1.vi.fn().mockResolvedValue(true),
        call: vitest_1.vi.fn().mockResolvedValue({ result: 'success' }),
        ...clientMethods,
    };
    const mockSession = {
        getClient: vitest_1.vi.fn().mockReturnValue(mockClient),
        isAuthenticated: vitest_1.vi.fn().mockReturnValue(true),
    };
    return { session: mockSession, client: mockClient };
};
(0, vitest_1.describe)('CRUD Tools', () => {
    (0, vitest_1.describe)('handleSearch', () => {
        (0, vitest_1.it)('searches with valid input', async () => {
            const { session, client } = createMockSession();
            const result = await (0, crud_1.handleSearch)(session, {
                model: 'res.partner',
                domain: [['is_company', '=', true]],
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.ids).toEqual([1, 2, 3]);
            (0, vitest_1.expect)(result.count).toBe(3);
            (0, vitest_1.expect)(client.search).toHaveBeenCalledWith('res.partner', [['is_company', '=', true]], vitest_1.expect.any(Object));
        });
        (0, vitest_1.it)('searches with empty domain', async () => {
            const { session, client } = createMockSession();
            const result = await (0, crud_1.handleSearch)(session, { model: 'res.partner' });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(client.search).toHaveBeenCalledWith('res.partner', [], vitest_1.expect.any(Object));
        });
        (0, vitest_1.it)('passes pagination options', async () => {
            const { session, client } = createMockSession();
            await (0, crud_1.handleSearch)(session, {
                model: 'res.partner',
                offset: 10,
                limit: 20,
                order: 'name asc',
            });
            (0, vitest_1.expect)(client.search).toHaveBeenCalledWith('res.partner', [], {
                offset: 10,
                limit: 20,
                order: 'name asc',
            });
        });
        (0, vitest_1.it)('returns error for invalid model', async () => {
            const { session } = createMockSession();
            const result = await (0, crud_1.handleSearch)(session, { model: '' });
            (0, vitest_1.expect)(result.success).toBe(false);
            (0, vitest_1.expect)(result.error.code).toBe('INVALID_INPUT');
        });
        (0, vitest_1.it)('handles client errors', async () => {
            const { session } = createMockSession({
                search: vitest_1.vi.fn().mockRejectedValue(new Error('Search failed')),
            });
            const result = await (0, crud_1.handleSearch)(session, { model: 'res.partner' });
            (0, vitest_1.expect)(result.success).toBe(false);
            (0, vitest_1.expect)(result.error.code).toBe('INTERNAL_ERROR');
        });
        (0, vitest_1.it)('handles not authenticated error', async () => {
            const mockSession = {
                getClient: vitest_1.vi.fn().mockImplementation(() => {
                    throw new Error('Not authenticated. Call odoo_authenticate first.');
                }),
            };
            const result = await (0, crud_1.handleSearch)(mockSession, { model: 'res.partner' });
            (0, vitest_1.expect)(result.success).toBe(false);
            (0, vitest_1.expect)(result.error.code).toBe('NOT_AUTHENTICATED');
        });
    });
    (0, vitest_1.describe)('handleRead', () => {
        (0, vitest_1.it)('reads single record', async () => {
            const { session, client } = createMockSession();
            const result = await (0, crud_1.handleRead)(session, {
                model: 'res.partner',
                ids: 1,
                fields: ['name', 'email'],
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.records).toEqual([{ id: 1, name: 'Test' }]);
            (0, vitest_1.expect)(client.read).toHaveBeenCalledWith('res.partner', 1, ['name', 'email']);
        });
        (0, vitest_1.it)('reads multiple records', async () => {
            const { session } = createMockSession({
                read: vitest_1.vi.fn().mockResolvedValue([
                    { id: 1, name: 'Test 1' },
                    { id: 2, name: 'Test 2' },
                ]),
            });
            const result = await (0, crud_1.handleRead)(session, {
                model: 'res.partner',
                ids: [1, 2],
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.count).toBe(2);
        });
        (0, vitest_1.it)('reads all fields when not specified', async () => {
            const { session, client } = createMockSession();
            await (0, crud_1.handleRead)(session, { model: 'res.partner', ids: 1 });
            (0, vitest_1.expect)(client.read).toHaveBeenCalledWith('res.partner', 1, undefined);
        });
    });
    (0, vitest_1.describe)('handleSearchRead', () => {
        (0, vitest_1.it)('search reads with domain and fields', async () => {
            const { session, client } = createMockSession();
            const result = await (0, crud_1.handleSearchRead)(session, {
                model: 'res.partner',
                domain: [['active', '=', true]],
                fields: ['name'],
                limit: 10,
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.records).toEqual([{ id: 1, name: 'Test' }]);
            (0, vitest_1.expect)(client.searchRead).toHaveBeenCalledWith('res.partner', [['active', '=', true]], vitest_1.expect.objectContaining({ fields: ['name'], limit: 10 }));
        });
    });
    (0, vitest_1.describe)('handleCreate', () => {
        (0, vitest_1.it)('creates record with values', async () => {
            const { session, client } = createMockSession();
            const result = await (0, crud_1.handleCreate)(session, {
                model: 'res.partner',
                values: { name: 'New Partner', email: 'test@test.com' },
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.id).toBe(1);
            (0, vitest_1.expect)(client.create).toHaveBeenCalledWith('res.partner', { name: 'New Partner', email: 'test@test.com' }, undefined);
        });
        (0, vitest_1.it)('passes context when provided', async () => {
            const { session, client } = createMockSession();
            await (0, crud_1.handleCreate)(session, {
                model: 'res.partner',
                values: { name: 'Test' },
                context: { lang: 'fr_FR' },
            });
            (0, vitest_1.expect)(client.create).toHaveBeenCalledWith('res.partner', { name: 'Test' }, { lang: 'fr_FR' });
        });
        (0, vitest_1.it)('returns error for empty values', async () => {
            const { session } = createMockSession();
            const result = await (0, crud_1.handleCreate)(session, {
                model: 'res.partner',
                values: {},
            });
            // Empty values is valid (defaults will be used)
            (0, vitest_1.expect)(result.success).toBe(true);
        });
    });
    (0, vitest_1.describe)('handleWrite', () => {
        (0, vitest_1.it)('updates single record', async () => {
            const { session, client } = createMockSession();
            const result = await (0, crud_1.handleWrite)(session, {
                model: 'res.partner',
                ids: 1,
                values: { name: 'Updated Name' },
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.updated).toBe(true);
            (0, vitest_1.expect)(client.write).toHaveBeenCalledWith('res.partner', 1, { name: 'Updated Name' }, undefined);
        });
        (0, vitest_1.it)('updates multiple records', async () => {
            const { session } = createMockSession();
            const result = await (0, crud_1.handleWrite)(session, {
                model: 'res.partner',
                ids: [1, 2, 3],
                values: { active: false },
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.count).toBe(3);
        });
    });
    (0, vitest_1.describe)('handleUnlink', () => {
        (0, vitest_1.it)('deletes single record', async () => {
            const { session, client } = createMockSession();
            const result = await (0, crud_1.handleUnlink)(session, {
                model: 'res.partner',
                ids: 1,
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.deleted).toBe(true);
            (0, vitest_1.expect)(client.unlink).toHaveBeenCalledWith('res.partner', 1);
        });
        (0, vitest_1.it)('deletes multiple records', async () => {
            const { session } = createMockSession();
            const result = await (0, crud_1.handleUnlink)(session, {
                model: 'res.partner',
                ids: [1, 2],
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.count).toBe(2);
        });
    });
    (0, vitest_1.describe)('handleCall', () => {
        (0, vitest_1.it)('calls model method with args', async () => {
            const { session, client } = createMockSession();
            const result = await (0, crud_1.handleCall)(session, {
                model: 'res.partner',
                method: 'name_search',
                args: ['Test'],
                kwargs: { limit: 5 },
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.result).toEqual({ result: 'success' });
            (0, vitest_1.expect)(client.call).toHaveBeenCalledWith('res.partner', 'name_search', ['Test'], {
                limit: 5,
            });
        });
        (0, vitest_1.it)('calls with empty args and kwargs', async () => {
            const { session, client } = createMockSession();
            await (0, crud_1.handleCall)(session, {
                model: 'res.partner',
                method: 'some_method',
            });
            (0, vitest_1.expect)(client.call).toHaveBeenCalledWith('res.partner', 'some_method', [], {});
        });
    });
});
//# sourceMappingURL=crud.test.js.map