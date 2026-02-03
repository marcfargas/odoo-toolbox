/**
 * Integration tests for odoo-client examples
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { OdooClient } from '../src';

describe('odoo-client examples', () => {
  let client: OdooClient;

  beforeAll(async () => {
    client = new OdooClient({
      url: process.env.ODOO_URL || 'http://localhost:8069',
      database: process.env.ODOO_DB || 'odoo',
      username: process.env.ODOO_USER || 'admin',
      password: process.env.ODOO_PASSWORD || 'admin',
    });
    await client.authenticate();
  });

  afterAll(async () => {
    await client.logout();
  });

  describe('Example 1: Basic Connection', () => {
    it('should authenticate successfully', async () => {
      const sessionInfo = await client.authenticate();
      expect(sessionInfo).toBeDefined();
      expect(sessionInfo.uid).toBeGreaterThan(0);
    });

    it('should verify connection by reading partner', async () => {
      const sessionInfo = await client.authenticate();
      const [partnerId] = await client.search('res.partner', [['id', '=', sessionInfo.partner_id]]);
      const [partner] = await client.read('res.partner', [partnerId], ['name', 'email']);
      expect(partner).toBeDefined();
      expect(partner.name).toBeDefined();
    });
  });

  describe('Example 2: CRUD Operations', () => {
    let testPartnerId: number;

    it('should create a new partner', async () => {
      testPartnerId = await client.create('res.partner', {
        name: 'Test Partner',
        email: 'test@example.com',
        is_company: false,
      });
      expect(testPartnerId).toBeGreaterThan(0);
    });

    it('should read the created partner', async () => {
      const [partner] = await client.read('res.partner', [testPartnerId], ['id', 'name', 'email']);
      expect(partner).toBeDefined();
      expect(partner.name).toBe('Test Partner');
      expect(partner.email).toBe('test@example.com');
    });

    it('should update the partner', async () => {
      const success = await client.write('res.partner', [testPartnerId], {
        email: 'updated@example.com',
      });
      expect(success).toBe(true);

      const [partner] = await client.read('res.partner', [testPartnerId], ['email']);
      expect(partner.email).toBe('updated@example.com');
    });

    it('should delete the partner', async () => {
      const success = await client.unlink('res.partner', [testPartnerId]);
      expect(success).toBe(true);

      // Verify deletion using search (bypasses read cache)
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const foundIds = await client.search('res.partner', [['id', '=', testPartnerId]]);
      expect(foundIds.length).toBe(0);
    });

    it('should batch create partners', async () => {
      const ids = await Promise.all([
        client.create('res.partner', { name: 'Batch 1', is_company: false }),
        client.create('res.partner', { name: 'Batch 2', is_company: false }),
        client.create('res.partner', { name: 'Batch 3', is_company: false }),
      ]);

      expect(ids).toHaveLength(3);
      ids.forEach((id) => expect(id).toBeGreaterThan(0));

      // Cleanup and verify deletion
      await client.unlink('res.partner', ids);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const foundIds = await client.search('res.partner', [['id', 'in', ids]]);
      expect(foundIds.length).toBe(0);
    });
  });

  describe('Example 3: Search and Filtering', () => {
    it('should search all partners', async () => {
      const allIds = await client.search('res.partner', []);
      expect(allIds).toBeDefined();
      expect(allIds.length).toBeGreaterThan(0);
    });

    it('should search with exact match', async () => {
      const companyIds = await client.search('res.partner', [['is_company', '=', true]]);
      expect(companyIds).toBeDefined();
      expect(Array.isArray(companyIds)).toBe(true);
    });

    it('should search with IN operator', async () => {
      const allIds = await client.search('res.partner', []);
      const targetIds = allIds.slice(0, Math.min(3, allIds.length));

      if (targetIds.length > 0) {
        const matchingIds = await client.search('res.partner', [['id', 'in', targetIds]]);
        expect(matchingIds.length).toBeLessThanOrEqual(targetIds.length);
      }
    });

    it('should search with OR logic', async () => {
      const orIds = await client.search('res.partner', [
        '|',
        ['is_company', '=', true],
        ['email', '!=', false],
      ]);
      expect(orIds).toBeDefined();
      expect(Array.isArray(orIds)).toBe(true);
    });

    it('should search with pagination', async () => {
      const paginated = await client.search('res.partner', [], {
        limit: 5,
        offset: 0,
        order: 'name ASC',
      });
      expect(paginated).toBeDefined();
      expect(paginated.length).toBeLessThanOrEqual(5);
    });

    it('should use searchRead for combined operation', async () => {
      const results = await client.searchRead('res.partner', [['is_company', '=', true]]);
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      if (results.length > 0) {
        expect(results[0]).toHaveProperty('id');
        expect(results[0]).toHaveProperty('name');
      }
    });

    it('should filter by many2one relationship', async () => {
      const usaPartners = await client.search('res.partner', [['country_id', '=', 1]]);
      expect(usaPartners).toBeDefined();
      expect(Array.isArray(usaPartners)).toBe(true);
    });
  });

  describe('Example 4: Context Variables and Batch Operations', () => {
    const batchIds: number[] = [];

    it('should batch create with context', async () => {
      const names = ['Context Test 1', 'Context Test 2', 'Context Test 3'];
      for (const name of names) {
        const id = await client.create(
          'res.partner',
          { name, is_company: false },
          { lang: 'en_US', tz: 'UTC' }
        );
        batchIds.push(id);
      }
      expect(batchIds).toHaveLength(3);
      batchIds.forEach((id) => expect(id).toBeGreaterThan(0));
    });

    it('should batch update with context', async () => {
      const success = await client.write(
        'res.partner',
        batchIds,
        { email: 'batch@test.com' },
        { lang: 'en_US' }
      );
      expect(success).toBe(true);

      const results = await client.read('res.partner', batchIds, ['email']);
      results.forEach((partner) => {
        expect(partner.email).toBe('batch@test.com');
      });
    });

    it('should search with context', async () => {
      const results = await client.searchRead('res.partner', [['id', 'in', batchIds]]);
      expect(results).toHaveLength(batchIds.length);
    });

    afterAll(async () => {
      // Cleanup
      if (batchIds.length > 0) {
        await client.unlink('res.partner', batchIds);
      }
    });
  });
});
