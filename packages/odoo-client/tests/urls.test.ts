/**
 * Unit tests for URL generation: getBaseUrl, getRecordUrl, getPortalUrl
 */

import { vi } from 'vitest';
import { getBaseUrl, getRecordUrl, getPortalUrl } from '../src/services/urls/functions';
import type { OdooClient } from '../src/client/odoo-client';

/**
 * Create a mock OdooClient with configurable call/read responses.
 */
function mockClient(
  overrides: {
    callFn?: (...args: any[]) => any;
    readFn?: (...args: any[]) => any;
  } = {}
): OdooClient {
  return {
    call: overrides.callFn ?? vi.fn(),
    read: overrides.readFn ?? vi.fn(),
  } as unknown as OdooClient;
}

describe('getBaseUrl', () => {
  it('should read web.base.url from ir.config_parameter', async () => {
    const callFn = vi.fn().mockResolvedValue('https://mycompany.odoo.com');
    const client = mockClient({ callFn });

    const result = await getBaseUrl(client);

    expect(result).toBe('https://mycompany.odoo.com');
    expect(callFn).toHaveBeenCalledWith(
      'ir.config_parameter',
      'get_param',
      ['web.base.url'],
      {},
      { safetyLevel: 'READ' }
    );
  });

  it('should strip trailing slash from base URL', async () => {
    const client = mockClient({
      callFn: vi.fn().mockResolvedValue('https://mycompany.odoo.com/'),
    });

    const result = await getBaseUrl(client);
    expect(result).toBe('https://mycompany.odoo.com');
  });

  it('should strip multiple trailing slashes', async () => {
    const client = mockClient({
      callFn: vi.fn().mockResolvedValue('https://mycompany.odoo.com///'),
    });

    const result = await getBaseUrl(client);
    expect(result).toBe('https://mycompany.odoo.com');
  });

  it('should cache result and not call again', async () => {
    const callFn = vi.fn().mockResolvedValue('https://cached.odoo.com');
    const client = mockClient({ callFn });

    const first = await getBaseUrl(client);
    const second = await getBaseUrl(client);

    expect(first).toBe('https://cached.odoo.com');
    expect(second).toBe('https://cached.odoo.com');
    expect(callFn).toHaveBeenCalledTimes(1);
  });

  it('should bypass cache when forceRefresh is true', async () => {
    const callFn = vi
      .fn()
      .mockResolvedValueOnce('https://first.odoo.com')
      .mockResolvedValueOnce('https://second.odoo.com');
    const client = mockClient({ callFn });

    const first = await getBaseUrl(client);
    const second = await getBaseUrl(client, true);

    expect(first).toBe('https://first.odoo.com');
    expect(second).toBe('https://second.odoo.com');
    expect(callFn).toHaveBeenCalledTimes(2);
  });

  it('should throw when web.base.url is empty', async () => {
    const client = mockClient({
      callFn: vi.fn().mockResolvedValue(''),
    });

    await expect(getBaseUrl(client)).rejects.toThrow(/web\.base\.url/);
  });

  it('should throw when web.base.url is falsy', async () => {
    const client = mockClient({
      callFn: vi.fn().mockResolvedValue(false),
    });

    await expect(getBaseUrl(client)).rejects.toThrow(/web\.base\.url/);
  });
});

describe('getRecordUrl', () => {
  it('should build a /mail/view URL with model and res_id', async () => {
    const client = mockClient({
      callFn: vi.fn().mockResolvedValue('https://mycompany.odoo.com'),
    });

    const url = await getRecordUrl(client, 'crm.lead', 42);

    expect(url).toBe('https://mycompany.odoo.com/mail/view?model=crm.lead&res_id=42');
  });

  it('should handle models with multiple dots correctly', async () => {
    const client = mockClient({
      callFn: vi.fn().mockResolvedValue('https://test.odoo.com'),
    });

    const url = await getRecordUrl(client, 'account.move.line', 100);

    expect(url).toBe('https://test.odoo.com/mail/view?model=account.move.line&res_id=100');
  });

  it('should encode model and res_id as query params', async () => {
    const client = mockClient({
      callFn: vi.fn().mockResolvedValue('https://test.odoo.com'),
    });

    const url = await getRecordUrl(client, 'res.partner', 1);

    expect(url).toContain('model=res.partner');
    expect(url).toContain('res_id=1');
  });
});

describe('getPortalUrl', () => {
  it('should build a portal URL with access_url and access_token', async () => {
    const callFn = vi.fn().mockResolvedValue('https://mycompany.odoo.com');
    const readFn = vi.fn().mockResolvedValue([
      {
        id: 15,
        access_url: '/my/orders/15',
        access_token: 'abc-123-token',
      },
    ]);
    const client = mockClient({ callFn, readFn });

    const result = await getPortalUrl(client, 'sale.order', 15);

    expect(result.url).toBe('https://mycompany.odoo.com/my/orders/15?access_token=abc-123-token');
    expect(result.accessUrl).toBe('/my/orders/15');
    expect(result.accessToken).toBe('abc-123-token');
  });

  it('should append suffix before query string', async () => {
    const callFn = vi.fn().mockResolvedValue('https://mycompany.odoo.com');
    const readFn = vi.fn().mockResolvedValue([
      {
        id: 15,
        access_url: '/my/orders/15',
        access_token: 'token-xyz',
      },
    ]);
    const client = mockClient({ callFn, readFn });

    const result = await getPortalUrl(client, 'sale.order', 15, {
      suffix: '/accept',
    });

    expect(result.url).toBe(
      'https://mycompany.odoo.com/my/orders/15/accept?access_token=token-xyz'
    );
  });

  it('should include reportType and download params', async () => {
    const callFn = vi.fn().mockResolvedValue('https://mycompany.odoo.com');
    const readFn = vi.fn().mockResolvedValue([
      {
        id: 7,
        access_url: '/my/invoices/7',
        access_token: 'inv-token',
      },
    ]);
    const client = mockClient({ callFn, readFn });

    const result = await getPortalUrl(client, 'account.move', 7, {
      reportType: 'pdf',
      download: true,
    });

    expect(result.url).toBe(
      'https://mycompany.odoo.com/my/invoices/7?access_token=inv-token&report_type=pdf&download=true'
    );
  });

  it('should throw when record not found', async () => {
    const callFn = vi.fn().mockResolvedValue('https://mycompany.odoo.com');
    const readFn = vi.fn().mockResolvedValue([]);
    const client = mockClient({ callFn, readFn });

    await expect(getPortalUrl(client, 'sale.order', 999)).rejects.toThrow(/not found/);
  });

  it('should throw when access_url is "#" (no portal.mixin implementation)', async () => {
    const callFn = vi.fn().mockResolvedValue('https://mycompany.odoo.com');
    const readFn = vi.fn().mockResolvedValue([
      {
        id: 42,
        access_url: '#',
        access_token: false,
      },
    ]);
    const client = mockClient({ callFn, readFn });

    await expect(getPortalUrl(client, 'crm.lead', 42)).rejects.toThrow(/portal\.mixin/);
  });

  it('should throw when access_url is empty', async () => {
    const callFn = vi.fn().mockResolvedValue('https://mycompany.odoo.com');
    const readFn = vi.fn().mockResolvedValue([
      {
        id: 42,
        access_url: '',
        access_token: false,
      },
    ]);
    const client = mockClient({ callFn, readFn });

    await expect(getPortalUrl(client, 'some.model', 42)).rejects.toThrow(/portal URL/);
  });

  it('should trigger _portal_ensure_token when access_token is false', async () => {
    const callFn = vi
      .fn()
      .mockResolvedValueOnce('https://mycompany.odoo.com') // getBaseUrl
      .mockResolvedValueOnce('generated-token'); // _portal_ensure_token
    const readFn = vi.fn().mockResolvedValue([
      {
        id: 15,
        access_url: '/my/orders/15',
        access_token: false,
      },
    ]);
    const client = mockClient({ callFn, readFn });

    const result = await getPortalUrl(client, 'sale.order', 15);

    // Should have called _portal_ensure_token
    expect(callFn).toHaveBeenCalledWith('sale.order', '_portal_ensure_token', [[15]]);
    expect(result.accessToken).toBe('generated-token');
    expect(result.url).toContain('access_token=generated-token');
  });
});
