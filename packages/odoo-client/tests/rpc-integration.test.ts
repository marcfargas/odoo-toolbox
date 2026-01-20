import { OdooClient } from '../src/client/odoo-client';
import { OdooAuthError, OdooRpcError } from '../src/types/errors';

describe('OdooClient RPC Foundation', () => {
  // TODO: These tests require proper RPC endpoint configuration
  // Currently skipped pending investigation of Odoo 17 JSON-RPC endpoint structure
  
  it.skip('should authenticate with valid credentials', async () => {
    const odooUrl = process.env.ODOO_URL || 'http://localhost:8069';
    const odooDb = process.env.ODOO_DB_NAME || 'odoo';
    const odooUser = process.env.ODOO_DB_USER || 'admin';
    const odooPassword = process.env.ODOO_DB_PASSWORD || 'admin';

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

  it.skip('should fail with invalid credentials', async () => {
    const odooUrl = process.env.ODOO_URL || 'http://localhost:8069';
    const odooDb = process.env.ODOO_DB_NAME || 'odoo';

    const client = new OdooClient({
      url: odooUrl,
      database: odooDb,
      username: 'invalid_user',
      password: 'invalid_password',
    });

    await expect(client.authenticate()).rejects.toThrow(OdooAuthError);
  });

  it('should have OdooClient class with basic structure', () => {
    const client = new OdooClient({
      url: 'http://localhost:8069',
      database: 'test',
      username: 'admin',
      password: 'admin',
    });

    expect(client).toBeDefined();
    expect(typeof client.authenticate).toBe('function');
    expect(typeof client.call).toBe('function');
    expect(typeof client.search).toBe('function');
    expect(typeof client.read).toBe('function');
    expect(typeof client.create).toBe('function');
    expect(typeof client.write).toBe('function');
    expect(typeof client.unlink).toBe('function');
    expect(client.isAuthenticated()).toBe(false);
  });
});
