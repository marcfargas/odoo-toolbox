/**
 * Unit tests for SessionManager.
 *
 * Tests cover:
 * - Authentication flow
 * - Logout and state cleanup
 * - State transitions
 * - Error handling for unauthenticated access
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionManager } from '../src/session/session-manager';

// Mock the dependencies
vi.mock('@odoo-toolbox/client', () => {
  return {
    OdooClient: class MockOdooClient {
      async authenticate() {
        return { uid: 1, session_id: 'test-session', db: 'test-db' };
      }
      logout() {}
    },
    ModuleManager: class MockModuleManager {},
    OdooError: class OdooError extends Error {},
    OdooRpcError: class OdooRpcError extends Error {
      code?: number;
      data?: unknown;
    },
    OdooAuthError: class OdooAuthError extends Error {},
    OdooNetworkError: class OdooNetworkError extends Error {
      cause?: Error;
    },
  };
});

vi.mock('@odoo-toolbox/introspection', () => {
  return {
    Introspector: class MockIntrospector {},
  };
});

describe('SessionManager', () => {
  let session: SessionManager;

  beforeEach(() => {
    session = new SessionManager();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('starts as not authenticated', () => {
      expect(session.isAuthenticated()).toBe(false);
    });

    it('returns disconnected status', () => {
      const status = session.getStatus();
      expect(status.isConnected).toBe(false);
      expect(status.isAuthenticated).toBe(false);
      expect(status.uid).toBeNull();
      expect(status.client).toBeNull();
    });
  });

  describe('authenticate', () => {
    const testConfig = {
      url: 'http://localhost:8069',
      database: 'test-db',
      username: 'admin',
      password: 'admin',
    };

    it('successfully authenticates with valid credentials', async () => {
      const result = await session.authenticate(testConfig);

      expect(result.uid).toBe(1);
      expect(session.isAuthenticated()).toBe(true);
    });

    it('sets up client and introspector after authentication', async () => {
      await session.authenticate(testConfig);

      const status = session.getStatus();
      expect(status.isConnected).toBe(true);
      expect(status.client).not.toBeNull();
      expect(status.introspector).not.toBeNull();
      expect(status.moduleManager).not.toBeNull();
    });

    it('stores connection configuration', async () => {
      await session.authenticate(testConfig);

      const status = session.getStatus();
      expect(status.config?.url).toBe(testConfig.url);
      expect(status.config?.database).toBe(testConfig.database);
    });

    it('sets connectedAt timestamp', async () => {
      const before = new Date();
      await session.authenticate(testConfig);
      const after = new Date();

      const status = session.getStatus();
      expect(status.connectedAt).not.toBeNull();
      expect(status.connectedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(status.connectedAt!.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('clears previous session when re-authenticating', async () => {
      await session.authenticate(testConfig);
      session.getStatus(); // Ensure first auth works

      await session.authenticate({ ...testConfig, database: 'other-db' });
      const secondStatus = session.getStatus();

      expect(secondStatus.config?.database).toBe('other-db');
    });
  });

  describe('logout', () => {
    it('clears authenticated state', async () => {
      await session.authenticate({
        url: 'http://localhost:8069',
        database: 'test-db',
        username: 'admin',
        password: 'admin',
      });

      session.logout();

      expect(session.isAuthenticated()).toBe(false);
    });

    it('clears all session state', async () => {
      await session.authenticate({
        url: 'http://localhost:8069',
        database: 'test-db',
        username: 'admin',
        password: 'admin',
      });

      session.logout();

      const status = session.getStatus();
      expect(status.isConnected).toBe(false);
      expect(status.client).toBeNull();
      expect(status.introspector).toBeNull();
      expect(status.moduleManager).toBeNull();
      expect(status.uid).toBeNull();
      expect(status.config).toBeNull();
    });

    it('is safe to call when not authenticated', () => {
      expect(() => session.logout()).not.toThrow();
    });
  });

  describe('getClient', () => {
    it('returns client when authenticated', async () => {
      await session.authenticate({
        url: 'http://localhost:8069',
        database: 'test-db',
        username: 'admin',
        password: 'admin',
      });

      expect(() => session.getClient()).not.toThrow();
    });

    it('throws when not authenticated', () => {
      expect(() => session.getClient()).toThrow('Not authenticated');
    });
  });

  describe('getIntrospector', () => {
    it('returns introspector when authenticated', async () => {
      await session.authenticate({
        url: 'http://localhost:8069',
        database: 'test-db',
        username: 'admin',
        password: 'admin',
      });

      expect(() => session.getIntrospector()).not.toThrow();
    });

    it('throws when not authenticated', () => {
      expect(() => session.getIntrospector()).toThrow('Not authenticated');
    });
  });

  describe('getModuleManager', () => {
    it('returns module manager when authenticated', async () => {
      await session.authenticate({
        url: 'http://localhost:8069',
        database: 'test-db',
        username: 'admin',
        password: 'admin',
      });

      expect(() => session.getModuleManager()).not.toThrow();
    });

    it('throws when not authenticated', () => {
      expect(() => session.getModuleManager()).toThrow('Not authenticated');
    });
  });
});
