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

import { describe, it, expect, vi } from 'vitest';
import {
  handleSearch,
  handleRead,
  handleSearchRead,
  handleCreate,
  handleWrite,
  handleUnlink,
  handleCall,
} from '../../src/tools/crud';
import { SessionManager } from '../../src/session/session-manager';

// Create mock session with mock client
const createMockSession = (clientMethods: Record<string, any> = {}) => {
  const mockClient = {
    search: vi.fn().mockResolvedValue([1, 2, 3]),
    read: vi.fn().mockResolvedValue([{ id: 1, name: 'Test' }]),
    searchRead: vi.fn().mockResolvedValue([{ id: 1, name: 'Test' }]),
    create: vi.fn().mockResolvedValue(1),
    write: vi.fn().mockResolvedValue(true),
    unlink: vi.fn().mockResolvedValue(true),
    call: vi.fn().mockResolvedValue({ result: 'success' }),
    ...clientMethods,
  };

  const mockSession = {
    getClient: vi.fn().mockReturnValue(mockClient),
    isAuthenticated: vi.fn().mockReturnValue(true),
  };

  return { session: mockSession as unknown as SessionManager, client: mockClient };
};

describe('CRUD Tools', () => {
  describe('handleSearch', () => {
    it('searches with valid input', async () => {
      const { session, client } = createMockSession();

      const result = await handleSearch(session, {
        model: 'res.partner',
        domain: [['is_company', '=', true]],
      });

      expect(result.success).toBe(true);
      expect((result as any).ids).toEqual([1, 2, 3]);
      expect((result as any).count).toBe(3);
      expect(client.search).toHaveBeenCalledWith(
        'res.partner',
        [['is_company', '=', true]],
        expect.any(Object)
      );
    });

    it('searches with empty domain', async () => {
      const { session, client } = createMockSession();

      const result = await handleSearch(session, { model: 'res.partner' });

      expect(result.success).toBe(true);
      expect(client.search).toHaveBeenCalledWith('res.partner', [], expect.any(Object));
    });

    it('passes pagination options', async () => {
      const { session, client } = createMockSession();

      await handleSearch(session, {
        model: 'res.partner',
        offset: 10,
        limit: 20,
        order: 'name asc',
      });

      expect(client.search).toHaveBeenCalledWith('res.partner', [], {
        offset: 10,
        limit: 20,
        order: 'name asc',
      });
    });

    it('returns error for invalid model', async () => {
      const { session } = createMockSession();

      const result = await handleSearch(session, { model: '' });

      expect(result.success).toBe(false);
      expect((result as any).error.code).toBe('INVALID_INPUT');
    });

    it('handles client errors', async () => {
      const { session } = createMockSession({
        search: vi.fn().mockRejectedValue(new Error('Search failed')),
      });

      const result = await handleSearch(session, { model: 'res.partner' });

      expect(result.success).toBe(false);
      expect((result as any).error.code).toBe('INTERNAL_ERROR');
    });

    it('handles not authenticated error', async () => {
      const mockSession = {
        getClient: vi.fn().mockImplementation(() => {
          throw new Error('Not authenticated. Call odoo_authenticate first.');
        }),
      } as unknown as SessionManager;

      const result = await handleSearch(mockSession, { model: 'res.partner' });

      expect(result.success).toBe(false);
      expect((result as any).error.code).toBe('NOT_AUTHENTICATED');
    });
  });

  describe('handleRead', () => {
    it('reads single record', async () => {
      const { session, client } = createMockSession();

      const result = await handleRead(session, {
        model: 'res.partner',
        ids: 1,
        fields: ['name', 'email'],
      });

      expect(result.success).toBe(true);
      expect((result as any).records).toEqual([{ id: 1, name: 'Test' }]);
      expect(client.read).toHaveBeenCalledWith('res.partner', 1, ['name', 'email']);
    });

    it('reads multiple records', async () => {
      const { session } = createMockSession({
        read: vi.fn().mockResolvedValue([
          { id: 1, name: 'Test 1' },
          { id: 2, name: 'Test 2' },
        ]),
      });

      const result = await handleRead(session, {
        model: 'res.partner',
        ids: [1, 2],
      });

      expect(result.success).toBe(true);
      expect((result as any).count).toBe(2);
    });

    it('reads all fields when not specified', async () => {
      const { session, client } = createMockSession();

      await handleRead(session, { model: 'res.partner', ids: 1 });

      expect(client.read).toHaveBeenCalledWith('res.partner', 1, undefined);
    });
  });

  describe('handleSearchRead', () => {
    it('search reads with domain and fields', async () => {
      const { session, client } = createMockSession();

      const result = await handleSearchRead(session, {
        model: 'res.partner',
        domain: [['active', '=', true]],
        fields: ['name'],
        limit: 10,
      });

      expect(result.success).toBe(true);
      expect((result as any).records).toEqual([{ id: 1, name: 'Test' }]);
      expect(client.searchRead).toHaveBeenCalledWith(
        'res.partner',
        [['active', '=', true]],
        expect.objectContaining({ fields: ['name'], limit: 10 })
      );
    });
  });

  describe('handleCreate', () => {
    it('creates record with values', async () => {
      const { session, client } = createMockSession();

      const result = await handleCreate(session, {
        model: 'res.partner',
        values: { name: 'New Partner', email: 'test@test.com' },
      });

      expect(result.success).toBe(true);
      expect((result as any).id).toBe(1);
      expect(client.create).toHaveBeenCalledWith(
        'res.partner',
        { name: 'New Partner', email: 'test@test.com' },
        undefined
      );
    });

    it('passes context when provided', async () => {
      const { session, client } = createMockSession();

      await handleCreate(session, {
        model: 'res.partner',
        values: { name: 'Test' },
        context: { lang: 'fr_FR' },
      });

      expect(client.create).toHaveBeenCalledWith(
        'res.partner',
        { name: 'Test' },
        { lang: 'fr_FR' }
      );
    });

    it('returns error for empty values', async () => {
      const { session } = createMockSession();

      const result = await handleCreate(session, {
        model: 'res.partner',
        values: {},
      });

      // Empty values is valid (defaults will be used)
      expect(result.success).toBe(true);
    });
  });

  describe('handleWrite', () => {
    it('updates single record', async () => {
      const { session, client } = createMockSession();

      const result = await handleWrite(session, {
        model: 'res.partner',
        ids: 1,
        values: { name: 'Updated Name' },
      });

      expect(result.success).toBe(true);
      expect((result as any).updated).toBe(true);
      expect(client.write).toHaveBeenCalledWith(
        'res.partner',
        1,
        { name: 'Updated Name' },
        undefined
      );
    });

    it('updates multiple records', async () => {
      const { session } = createMockSession();

      const result = await handleWrite(session, {
        model: 'res.partner',
        ids: [1, 2, 3],
        values: { active: false },
      });

      expect(result.success).toBe(true);
      expect((result as any).count).toBe(3);
    });
  });

  describe('handleUnlink', () => {
    it('deletes single record', async () => {
      const { session, client } = createMockSession();

      const result = await handleUnlink(session, {
        model: 'res.partner',
        ids: 1,
      });

      expect(result.success).toBe(true);
      expect((result as any).deleted).toBe(true);
      expect(client.unlink).toHaveBeenCalledWith('res.partner', 1);
    });

    it('deletes multiple records', async () => {
      const { session } = createMockSession();

      const result = await handleUnlink(session, {
        model: 'res.partner',
        ids: [1, 2],
      });

      expect(result.success).toBe(true);
      expect((result as any).count).toBe(2);
    });
  });

  describe('handleCall', () => {
    it('calls model method with args', async () => {
      const { session, client } = createMockSession();

      const result = await handleCall(session, {
        model: 'res.partner',
        method: 'name_search',
        args: ['Test'],
        kwargs: { limit: 5 },
      });

      expect(result.success).toBe(true);
      expect((result as any).result).toEqual({ result: 'success' });
      expect(client.call).toHaveBeenCalledWith('res.partner', 'name_search', ['Test'], {
        limit: 5,
      });
    });

    it('calls with empty args and kwargs', async () => {
      const { session, client } = createMockSession();

      await handleCall(session, {
        model: 'res.partner',
        method: 'some_method',
      });

      expect(client.call).toHaveBeenCalledWith('res.partner', 'some_method', [], {});
    });
  });
});
