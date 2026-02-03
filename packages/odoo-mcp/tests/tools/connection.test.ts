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

import { describe, it, expect, vi } from 'vitest';
import {
  handleAuthenticate,
  handleLogout,
  handleConnectionStatus,
} from '../../src/tools/connection';
import { SessionManager } from '../../src/session/session-manager';

// Create mock session
const createMockSession = (authenticated = false) => {
  const mockSession = {
    authenticate: vi.fn().mockResolvedValue({ uid: 1 }),
    logout: vi.fn(),
    isAuthenticated: vi.fn().mockReturnValue(authenticated),
    getStatus: vi.fn().mockReturnValue({
      isConnected: authenticated,
      isAuthenticated: authenticated,
      config: authenticated ? { url: 'http://localhost:8069', database: 'test-db' } : null,
      uid: authenticated ? 1 : null,
      connectedAt: authenticated ? new Date() : null,
    }),
    getClient: vi.fn(),
    getIntrospector: vi.fn(),
    getModuleManager: vi.fn(),
  };
  return mockSession as unknown as SessionManager;
};

describe('Connection Tools', () => {
  describe('handleAuthenticate', () => {
    it('authenticates with valid credentials', async () => {
      const session = createMockSession();

      const result = await handleAuthenticate(session, {
        url: 'http://localhost:8069',
        database: 'test-db',
        username: 'admin',
        password: 'admin',
      });

      expect(result.success).toBe(true);
      expect((result as any).uid).toBe(1);
      expect((result as any).database).toBe('test-db');
    });

    it('returns error for invalid input - missing url', async () => {
      const session = createMockSession();

      const result = await handleAuthenticate(session, {
        database: 'test-db',
        username: 'admin',
        password: 'admin',
      });

      expect(result.success).toBe(false);
      expect((result as any).error.code).toBe('INVALID_INPUT');
    });

    it('returns error for invalid input - invalid url', async () => {
      const session = createMockSession();

      const result = await handleAuthenticate(session, {
        url: 'not-a-url',
        database: 'test-db',
        username: 'admin',
        password: 'admin',
      });

      expect(result.success).toBe(false);
      expect((result as any).error.code).toBe('INVALID_INPUT');
    });

    it('returns error for empty database', async () => {
      const session = createMockSession();

      const result = await handleAuthenticate(session, {
        url: 'http://localhost:8069',
        database: '',
        username: 'admin',
        password: 'admin',
      });

      expect(result.success).toBe(false);
      expect((result as any).error.code).toBe('INVALID_INPUT');
    });

    it('handles authentication failure', async () => {
      const session = createMockSession();
      (session.authenticate as any).mockRejectedValue(new Error('Invalid credentials'));

      const result = await handleAuthenticate(session, {
        url: 'http://localhost:8069',
        database: 'test-db',
        username: 'admin',
        password: 'wrong',
      });

      expect(result.success).toBe(false);
      expect((result as any).error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('handleLogout', () => {
    it('logs out successfully when authenticated', () => {
      const session = createMockSession(true);

      const result = handleLogout(session);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully logged out');
      expect(session.logout).toHaveBeenCalled();
    });

    it('handles logout when not authenticated', () => {
      const session = createMockSession(false);

      const result = handleLogout(session);

      expect(result.success).toBe(true);
      expect(result.message).toContain('No active session');
    });
  });

  describe('handleConnectionStatus', () => {
    it('returns connected status when authenticated', () => {
      const session = createMockSession(true);

      const result = handleConnectionStatus(session);

      expect(result.success).toBe(true);
      expect((result as any).connected).toBe(true);
      expect((result as any).authenticated).toBe(true);
      expect((result as any).uid).toBe(1);
    });

    it('returns disconnected status when not authenticated', () => {
      const session = createMockSession(false);

      const result = handleConnectionStatus(session);

      expect(result.success).toBe(true);
      expect((result as any).connected).toBe(false);
      expect((result as any).authenticated).toBe(false);
      expect((result as any).message).toBe('Not connected');
    });

    it('includes database and url when connected', () => {
      const session = createMockSession(true);

      const result = handleConnectionStatus(session);

      expect((result as any).url).toBe('http://localhost:8069');
      expect((result as any).database).toBe('test-db');
    });
  });
});
