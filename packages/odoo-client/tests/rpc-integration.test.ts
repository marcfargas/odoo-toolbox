import { OdooClient } from '../src/client/odoo-client';
import { OdooAuthError, OdooRpcError } from '../src/types/errors';

describe('OdooClient RPC Integration', () => {
  const odooUrl = process.env.ODOO_URL || 'http://localhost:8069';
  const odooDb = process.env.ODOO_DB_NAME || 'odoo';
  const odooUser = process.env.ODOO_DB_USER || 'admin';
  const odooPassword = process.env.ODOO_DB_PASSWORD || 'admin';

  describe('authentication', () => {
    it('should authenticate with valid credentials', async () => {
      const client = new OdooClient({
        url: odooUrl,
        database: odooDb,
        username: odooUser,
        password: odooPassword,
      });

      const session = await client.authenticate();
      
      expect(session).toBeDefined();
      expect(session.uid).toBeGreaterThan(0);
      expect(session.db).toBe(odooDb);
      expect(client.isAuthenticated()).toBe(true);
    });

    it('should fail with invalid credentials', async () => {
      const client = new OdooClient({
        url: odooUrl,
        database: odooDb,
        username: 'invalid_user',
        password: 'invalid_password',
      });

      await expect(client.authenticate()).rejects.toThrow(OdooAuthError);
    });

    it('should prevent calls before authentication', async () => {
      const client = new OdooClient({
        url: odooUrl,
        database: odooDb,
        username: odooUser,
        password: odooPassword,
      });

      await expect(client.search('res.partner')).rejects.toThrow(OdooAuthError);
    });
  });

  describe('basic operations', () => {
    let client: OdooClient;

    beforeAll(async () => {
      client = new OdooClient({
        url: odooUrl,
        database: odooDb,
        username: odooUser,
        password: odooPassword,
      });
      await client.authenticate();
    });

    afterAll(() => {
      client.logout();
    });

    it('should search for records', async () => {
      const ids = await client.search('res.partner', [['is_company', '=', true]]);
      
      expect(Array.isArray(ids)).toBe(true);
      expect(ids.length).toBeGreaterThanOrEqual(0);
    });

    it('should read records', async () => {
      const ids = await client.search('res.partner', [], { limit: 1 });
      
      if (ids.length > 0) {
        const records = await client.read('res.partner', ids[0], ['id', 'name']);
        
        expect(Array.isArray(records)).toBe(true);
        expect(records.length).toBe(1);
        expect(records[0]).toHaveProperty('id');
        expect(records[0]).toHaveProperty('name');
      }
    });

    it('should search and read in one call', async () => {
      const records = await client.searchRead('res.partner', [], {
        fields: ['id', 'name'],
        limit: 5,
      });
      
      expect(Array.isArray(records)).toBe(true);
      records.forEach((record) => {
        expect(record).toHaveProperty('id');
        expect(record).toHaveProperty('name');
      });
    });
  });
});
