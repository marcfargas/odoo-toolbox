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

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createOdooMcpServer } from '../src/server';
import {
  handleAuthenticate,
  handleLogout,
  handleConnectionStatus,
  handleSearch,
  handleRead,
  handleSearchRead,
  handleCreate,
  handleWrite,
  handleUnlink,
  handleGetModels,
  handleGetFields,
  handleGetModelMetadata,
  handleModuleList,
} from '../src/tools/index';
import { SessionManager } from '../src/session/session-manager';

// Test configuration from environment
const testConfig = {
  url: process.env.ODOO_URL || 'http://localhost:8069',
  database: process.env.ODOO_DB_NAME || 'odoo',
  username: process.env.ODOO_DB_USER || 'admin',
  password: process.env.ODOO_DB_PASSWORD || 'admin',
};

describe('MCP Server Integration', () => {
  let session: SessionManager;
  const createdRecordIds: number[] = [];

  beforeAll(async () => {
    const { session: serverSession } = createOdooMcpServer();
    session = serverSession;
  });

  afterAll(async () => {
    // Cleanup any created records
    if (session.isAuthenticated()) {
      for (const id of createdRecordIds) {
        try {
          await handleUnlink(session, { model: 'res.partner', ids: id });
        } catch {
          // Ignore cleanup errors
        }
      }
      session.logout();
    }
  });

  describe('Server Creation', () => {
    it('creates server with session manager', () => {
      const { server, session } = createOdooMcpServer();

      expect(server).toBeDefined();
      expect(session).toBeDefined();
      expect(session.isAuthenticated()).toBe(false);
    });
  });

  describe('Authentication Flow', () => {
    it('authenticates with valid credentials', async () => {
      const result = await handleAuthenticate(session, testConfig);

      expect(result.success).toBe(true);
      expect((result as any).uid).toBeGreaterThan(0);
      expect(session.isAuthenticated()).toBe(true);
    });

    it('reports authenticated status', () => {
      const result = handleConnectionStatus(session);

      expect(result.success).toBe(true);
      expect((result as any).connected).toBe(true);
      expect((result as any).authenticated).toBe(true);
      expect((result as any).database).toBe(testConfig.database);
    });
  });

  describe('CRUD Operations', () => {
    it('searches for records', async () => {
      const result = await handleSearch(session, {
        model: 'res.partner',
        domain: [],
        limit: 5,
      });

      expect(result.success).toBe(true);
      expect((result as any).ids.length).toBeGreaterThanOrEqual(0);
      expect((result as any).ids.length).toBeLessThanOrEqual(5);
    });

    it('reads records by ID', async () => {
      // First search to get some IDs
      const searchResult = await handleSearch(session, {
        model: 'res.partner',
        domain: [],
        limit: 1,
      });

      if ((searchResult as any).ids.length > 0) {
        const result = await handleRead(session, {
          model: 'res.partner',
          ids: (searchResult as any).ids[0],
          fields: ['name', 'email'],
        });

        expect(result.success).toBe(true);
        expect((result as any).records.length).toBe(1);
        expect((result as any).records[0]).toHaveProperty('name');
      }
    });

    it('performs searchRead', async () => {
      const result = await handleSearchRead(session, {
        model: 'res.partner',
        domain: [],
        fields: ['name', 'email'],
        limit: 3,
      });

      expect(result.success).toBe(true);
      expect(Array.isArray((result as any).records)).toBe(true);
    });

    it('creates a record', async () => {
      const uniqueName = `MCP Test Partner ${Date.now()}`;
      const result = await handleCreate(session, {
        model: 'res.partner',
        values: {
          name: uniqueName,
          is_company: true,
        },
      });

      expect(result.success).toBe(true);
      expect((result as any).id).toBeGreaterThan(0);

      // Track for cleanup
      createdRecordIds.push((result as any).id);
    });

    it('updates a record', async () => {
      // Create a record first
      const createResult = await handleCreate(session, {
        model: 'res.partner',
        values: { name: `MCP Test Update ${Date.now()}` },
      });

      const id = (createResult as any).id;
      createdRecordIds.push(id);

      // Update it
      const result = await handleWrite(session, {
        model: 'res.partner',
        ids: id,
        values: { name: 'Updated MCP Test Partner' },
      });

      expect(result.success).toBe(true);
      expect((result as any).updated).toBe(true);

      // Verify the update
      const readResult = await handleRead(session, {
        model: 'res.partner',
        ids: id,
        fields: ['name'],
      });

      expect((readResult as any).records[0].name).toBe('Updated MCP Test Partner');
    });

    it('deletes a record', async () => {
      // Create a record to delete
      const createResult = await handleCreate(session, {
        model: 'res.partner',
        values: { name: `MCP Test Delete ${Date.now()}` },
      });

      const id = (createResult as any).id;

      // Delete it
      const result = await handleUnlink(session, {
        model: 'res.partner',
        ids: id,
      });

      expect(result.success).toBe(true);
      expect((result as any).deleted).toBe(true);

      // Verify deletion - search should not find it
      const searchResult = await handleSearch(session, {
        model: 'res.partner',
        domain: [['id', '=', id]],
      });

      expect((searchResult as any).ids).toHaveLength(0);
    });
  });

  describe('Introspection', () => {
    it('lists available models', async () => {
      const result = await handleGetModels(session, {});

      expect(result.success).toBe(true);
      expect((result as any).models.length).toBeGreaterThan(0);

      // Should include common models
      const modelNames = (result as any).models.map((m: any) => m.model);
      expect(modelNames).toContain('res.partner');
      expect(modelNames).toContain('res.users');
    });

    it('gets fields for a model', async () => {
      const result = await handleGetFields(session, {
        model: 'res.partner',
      });

      expect(result.success).toBe(true);
      expect((result as any).fields.length).toBeGreaterThan(0);

      // Should include common fields
      const fieldNames = (result as any).fields.map((f: any) => f.name);
      expect(fieldNames).toContain('name');
      expect(fieldNames).toContain('email');
    });

    it('gets complete model metadata', async () => {
      const result = await handleGetModelMetadata(session, {
        model: 'res.partner',
      });

      expect(result.success).toBe(true);
      expect((result as any).metadata.model.model).toBe('res.partner');
      expect((result as any).metadata.fields.length).toBeGreaterThan(0);
    });
  });

  describe('Module Operations', () => {
    it('lists installed modules', async () => {
      const result = await handleModuleList(session, {
        state: 'installed',
        limit: 10,
      });

      expect(result.success).toBe(true);
      expect((result as any).modules.length).toBeGreaterThan(0);

      // Base module should always be installed
      const moduleNames = (result as any).modules.map((m: any) => m.name);
      expect(moduleNames).toContain('base');
    });
  });

  describe('Logout', () => {
    it('logs out successfully', () => {
      // Re-authenticate if not authenticated
      if (!session.isAuthenticated()) {
        // Skip this test if we're not authenticated
        return;
      }

      const result = handleLogout(session);

      expect(result.success).toBe(true);
      expect(session.isAuthenticated()).toBe(false);
    });

    it('reports disconnected after logout', () => {
      const result = handleConnectionStatus(session);

      expect(result.success).toBe(true);
      expect((result as any).authenticated).toBe(false);
    });
  });
});
