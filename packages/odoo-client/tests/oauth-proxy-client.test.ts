/**
 * Unit tests for OAuthProxyClient.
 *
 * Mocks `globalThis.fetch` via vitest spies. NO real HTTP. All 15 behaviour
 * cases from Plan 07-02 Task 2 are covered, plus defensive checks.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OAuthProxyClient } from '../src/client/oauth-proxy-client';
import type { OdooCrudClient } from '../src/client/types';
import { OdooClient } from '../src/client/odoo-client';

function mockJsonResponse(body: any): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function getOutboundEnvelope(fetchSpy: ReturnType<typeof vi.fn>, callIndex = 0): any {
  const call = fetchSpy.mock.calls[callIndex];
  const init = call[1] as RequestInit;
  return JSON.parse(init.body as string);
}

function getOutboundHeaders(
  fetchSpy: ReturnType<typeof vi.fn>,
  callIndex = 0
): Record<string, string> {
  const call = fetchSpy.mock.calls[callIndex];
  const init = call[1] as RequestInit;
  return init.headers as Record<string, string>;
}

describe('OAuthProxyClient', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  let getAccessToken: ReturnType<typeof vi.fn>;

  const PROXY_URL = 'https://proxy.example.com';

  beforeEach(() => {
    fetchSpy = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(mockJsonResponse({ jsonrpc: '2.0', id: 1, result: [] }))
      );
    vi.stubGlobal('fetch', fetchSpy);
    getAccessToken = vi.fn().mockResolvedValue('TEST_BEARER_TOKEN');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // ─── Test 1: Constructor stores config ──────────────────────────────

  it('constructor accepts {proxyBaseUrl, getAccessToken}', () => {
    const client = new OAuthProxyClient({ proxyBaseUrl: PROXY_URL, getAccessToken });
    expect(client).toBeInstanceOf(OAuthProxyClient);
  });

  // ─── Test 2: Compile-time implements OdooCrudClient ─────────────────
  // (The type assignment below is compile-time validation; runtime checks
  // every method exists and is callable.)

  it('implements OdooCrudClient (compile-time + runtime)', () => {
    const client = new OAuthProxyClient({ proxyBaseUrl: PROXY_URL, getAccessToken });
    // This line type-checks at compile time — it would fail tsc if the
    // class did not satisfy the interface.
    const asInterface: OdooCrudClient = client;
    expect(typeof asInterface.call).toBe('function');
    expect(typeof asInterface.search).toBe('function');
    expect(typeof asInterface.read).toBe('function');
    expect(typeof asInterface.searchRead).toBe('function');
    expect(typeof asInterface.create).toBe('function');
    expect(typeof asInterface.write).toBe('function');
    expect(typeof asInterface.unlink).toBe('function');
    expect(typeof asInterface.searchCount).toBe('function');
  });

  // ─── Test 3-10: Per-method envelope shapes ─────────────────────────

  it('search shapes envelope as args[4]=search, args[5]=[domain], kwargs in args[6]', async () => {
    fetchSpy.mockImplementation(() =>
      Promise.resolve(mockJsonResponse({ jsonrpc: '2.0', id: 1, result: [1, 2] }))
    );
    const client = new OAuthProxyClient({ proxyBaseUrl: PROXY_URL, getAccessToken });
    const result = await client.search('res.partner', [['active', '=', true]], { limit: 10 });
    expect(result).toEqual([1, 2]);

    const env = getOutboundEnvelope(fetchSpy);
    expect(env.params.args[3]).toBe('res.partner');
    expect(env.params.args[4]).toBe('search');
    expect(env.params.args[5]).toEqual([[['active', '=', true]]]);
    expect(env.params.args[6]).toEqual({ limit: 10 });
  });

  it('read shapes envelope as args[4]=read, args[5]=[ids,fields]', async () => {
    fetchSpy.mockImplementation(() =>
      Promise.resolve(mockJsonResponse({ jsonrpc: '2.0', id: 1, result: [{ id: 1, name: 'X' }] }))
    );
    const client = new OAuthProxyClient({ proxyBaseUrl: PROXY_URL, getAccessToken });
    const result = await client.read('res.partner', [1, 2, 3], ['name', 'email']);
    expect(result).toEqual([{ id: 1, name: 'X' }]);

    const env = getOutboundEnvelope(fetchSpy);
    expect(env.params.args[4]).toBe('read');
    expect(env.params.args[5]).toEqual([
      [1, 2, 3],
      ['name', 'email'],
    ]);
  });

  it('searchRead shapes envelope as args[4]=search_read, args[5]=[domain], options in args[6]', async () => {
    fetchSpy.mockImplementation(() =>
      Promise.resolve(mockJsonResponse({ jsonrpc: '2.0', id: 1, result: [{ id: 1, name: 'X' }] }))
    );
    const client = new OAuthProxyClient({ proxyBaseUrl: PROXY_URL, getAccessToken });
    const result = await client.searchRead('res.partner', [], { fields: ['name'], limit: 5 });
    expect(result).toEqual([{ id: 1, name: 'X' }]);

    const env = getOutboundEnvelope(fetchSpy);
    expect(env.params.args[4]).toBe('search_read');
    expect(env.params.args[5]).toEqual([[]]);
    expect(env.params.args[6]).toEqual({ fields: ['name'], limit: 5 });
  });

  it('create shapes envelope as args[4]=create, args[5]=[values], context in args[6]', async () => {
    fetchSpy.mockImplementation(() =>
      Promise.resolve(mockJsonResponse({ jsonrpc: '2.0', id: 1, result: 42 }))
    );
    const client = new OAuthProxyClient({ proxyBaseUrl: PROXY_URL, getAccessToken });
    const id = await client.create('res.partner', { name: 'X' });
    expect(id).toBe(42);

    const env = getOutboundEnvelope(fetchSpy);
    expect(env.params.args[4]).toBe('create');
    expect(env.params.args[5]).toEqual([{ name: 'X' }]);
    expect(env.params.args[6]).toEqual({ context: {} });
  });

  it('write shapes envelope as args[4]=write, args[5]=[ids,values]', async () => {
    fetchSpy.mockImplementation(() =>
      Promise.resolve(mockJsonResponse({ jsonrpc: '2.0', id: 1, result: true }))
    );
    const client = new OAuthProxyClient({ proxyBaseUrl: PROXY_URL, getAccessToken });
    const ok = await client.write('res.partner', 42, { email: 'x@y' });
    expect(ok).toBe(true);

    const env = getOutboundEnvelope(fetchSpy);
    expect(env.params.args[4]).toBe('write');
    expect(env.params.args[5]).toEqual([[42], { email: 'x@y' }]);
    expect(env.params.args[6]).toEqual({ context: {} });
  });

  it('unlink shapes envelope as args[4]=unlink, args[5]=[ids]', async () => {
    fetchSpy.mockImplementation(() =>
      Promise.resolve(mockJsonResponse({ jsonrpc: '2.0', id: 1, result: true }))
    );
    const client = new OAuthProxyClient({ proxyBaseUrl: PROXY_URL, getAccessToken });
    const ok = await client.unlink('res.partner', [42]);
    expect(ok).toBe(true);

    const env = getOutboundEnvelope(fetchSpy);
    expect(env.params.args[4]).toBe('unlink');
    expect(env.params.args[5]).toEqual([[42]]);
  });

  it('searchCount shapes envelope as args[4]=search_count, args[5]=[domain]', async () => {
    fetchSpy.mockImplementation(() =>
      Promise.resolve(mockJsonResponse({ jsonrpc: '2.0', id: 1, result: 7 }))
    );
    const client = new OAuthProxyClient({ proxyBaseUrl: PROXY_URL, getAccessToken });
    const count = await client.searchCount('res.partner', []);
    expect(count).toBe(7);

    const env = getOutboundEnvelope(fetchSpy);
    expect(env.params.args[4]).toBe('search_count');
    expect(env.params.args[5]).toEqual([[]]);
  });

  it('call shapes envelope as args[4]=<method>, args[5]=posArgs, args[6]=kwargs', async () => {
    fetchSpy.mockImplementation(() =>
      Promise.resolve(mockJsonResponse({ jsonrpc: '2.0', id: 1, result: 'ok' }))
    );
    const client = new OAuthProxyClient({ proxyBaseUrl: PROXY_URL, getAccessToken });
    const result = await client.call('res.partner', 'custom_method', [1, 2], { ctx: 'x' });
    expect(result).toBe('ok');

    const env = getOutboundEnvelope(fetchSpy);
    expect(env.params.args[4]).toBe('custom_method');
    expect(env.params.args[5]).toEqual([1, 2]);
    expect(env.params.args[6]).toEqual({ ctx: 'x' });
  });

  // ─── Test 11: authenticate is no-op ─────────────────────────────────

  it('authenticate() returns stub session and triggers ZERO fetch calls', async () => {
    const client = new OAuthProxyClient({ proxyBaseUrl: PROXY_URL, getAccessToken });
    const session = await client.authenticate();
    expect(session).toEqual({ uid: 0, db: '', session_id: '' });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getAccessToken).not.toHaveBeenCalled();
  });

  // ─── Test 12: NEVER calls common.login ──────────────────────────────

  it('across all CRUD methods, NEVER emits a request body containing service=common+method=login', async () => {
    const client = new OAuthProxyClient({ proxyBaseUrl: PROXY_URL, getAccessToken });

    await client.search('res.partner', []);
    await client.read('res.partner', [1]);
    await client.searchRead('res.partner');
    await client.create('res.partner', { name: 'X' });
    await client.write('res.partner', 1, { name: 'Y' });
    await client.unlink('res.partner', [1]);
    await client.searchCount('res.partner');
    await client.call('res.partner', 'custom_method');
    await client.authenticate();

    for (const callArgs of fetchSpy.mock.calls) {
      const init = callArgs[1] as RequestInit;
      const body = JSON.parse(init.body as string);
      // Defense-in-depth: the proxy ALSO rejects this server-side.
      expect(body.params.service).not.toBe('common');
      // Specifically: never the {service:'common', method:'login'} pair.
      const isCommonLogin = body.params.service === 'common' && body.params.method === 'login';
      expect(isCommonLogin).toBe(false);
    }

    // Negative regex grep over serialized bodies — guards against future drift.
    for (const callArgs of fetchSpy.mock.calls) {
      const init = callArgs[1] as RequestInit;
      const bodyStr = init.body as string;
      // The literal pair `"common"` + `"login"` must not co-occur in any envelope.
      const hasCommon = /"common"/.test(bodyStr);
      const hasLogin = /"login"/.test(bodyStr);
      expect(hasCommon && hasLogin).toBe(false);
    }
  });

  // ─── Test 13: All requests go to /jsonrpc on the proxy ─────────────

  it('all outbound requests use the SAME proxy URL ${proxyBaseUrl}/jsonrpc', async () => {
    const client = new OAuthProxyClient({ proxyBaseUrl: PROXY_URL, getAccessToken });

    await client.search('res.partner', []);
    await client.read('res.partner', [1]);
    await client.create('res.partner', { name: 'X' });
    await client.call('res.partner', 'custom_method');

    const expectedUrl = `${PROXY_URL}/jsonrpc`;
    for (const callArgs of fetchSpy.mock.calls) {
      expect(callArgs[0]).toBe(expectedUrl);
    }
  });

  // ─── Test 14: Bearer header + no Cookie header ─────────────────────

  it('all outbound requests carry Authorization: Bearer <token> and NO Cookie', async () => {
    const client = new OAuthProxyClient({ proxyBaseUrl: PROXY_URL, getAccessToken });

    await client.search('res.partner', []);
    await client.read('res.partner', [1]);
    await client.create('res.partner', { name: 'X' });
    await client.call('res.partner', 'custom_method');

    for (let i = 0; i < fetchSpy.mock.calls.length; i++) {
      const headers = getOutboundHeaders(fetchSpy, i);
      const authKey = Object.keys(headers).find((k) => k.toLowerCase() === 'authorization');
      expect(headers[authKey!]).toBe('Bearer TEST_BEARER_TOKEN');
      const cookieKey = Object.keys(headers).find((k) => k.toLowerCase() === 'cookie');
      expect(cookieKey).toBeUndefined();
    }
  });

  // ─── Test 15: Surface-parity oracle ─────────────────────────────────

  it('returns identical shape to OdooClient for the same call (mocked-fetch parity)', async () => {
    // Mock 1 OdooClient through its transport (it stores password in args[2]).
    // Mock 2 OAuthProxyClient through its transport (sentinel stubs).
    // Both should return the same shape from searchRead given the same upstream payload.
    const expectedRows = [{ id: 1, name: 'Alice' }];

    fetchSpy.mockImplementation(() =>
      Promise.resolve(mockJsonResponse({ jsonrpc: '2.0', id: 1, result: expectedRows }))
    );

    const oauthClient = new OAuthProxyClient({ proxyBaseUrl: PROXY_URL, getAccessToken });
    const oauthResult = await oauthClient.searchRead<{ id: number; name: string }>(
      'res.partner',
      [],
      { fields: ['name'], limit: 5 }
    );

    // Now a fresh OdooClient — it needs authenticate() first; mock that login.
    fetchSpy.mockClear();
    fetchSpy
      .mockImplementationOnce(() =>
        Promise.resolve(mockJsonResponse({ jsonrpc: '2.0', id: 1, result: 7 }))
      ) // common.login → uid=7
      .mockImplementationOnce(() =>
        Promise.resolve(mockJsonResponse({ jsonrpc: '2.0', id: 2, result: expectedRows }))
      );
    const odoo = new OdooClient({
      url: 'https://odoo.example.com',
      database: 'demo',
      username: 'admin',
      password: 'admin',
    });
    await odoo.authenticate();
    const odooResult = await odoo.searchRead<{ id: number; name: string }>('res.partner', [], {
      fields: ['name'],
      limit: 5,
    });

    expect(oauthResult).toEqual(odooResult);
    expect(oauthResult).toEqual(expectedRows);
  });

  // ─── Defense-in-depth: token validation + isAuthenticated/getSession/logout shims ──

  it('isAuthenticated() always returns true (the bearer is the auth)', () => {
    const client = new OAuthProxyClient({ proxyBaseUrl: PROXY_URL, getAccessToken });
    expect(client.isAuthenticated()).toBe(true);
  });

  it('getSession() returns the stub session', () => {
    const client = new OAuthProxyClient({ proxyBaseUrl: PROXY_URL, getAccessToken });
    expect(client.getSession()).toEqual({ uid: 0, db: '', session_id: '' });
  });

  it('logout() is a no-op', () => {
    const client = new OAuthProxyClient({ proxyBaseUrl: PROXY_URL, getAccessToken });
    client.logout();
    expect(client.isAuthenticated()).toBe(true); // still true — no real session to drop
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('call ignores options.safetyLevel without throwing (no-op v1 safety guard)', async () => {
    fetchSpy.mockImplementation(() =>
      Promise.resolve(mockJsonResponse({ jsonrpc: '2.0', id: 1, result: 'ok' }))
    );
    const client = new OAuthProxyClient({ proxyBaseUrl: PROXY_URL, getAccessToken });
    const result = await client.call('res.partner', 'unlink', [[1]], {}, { safetyLevel: 'DELETE' });
    expect(result).toBe('ok');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  // ─── Threat T-07-02-01: token never appears in error messages ──────

  it('does NOT embed token value in OdooAuthError message on bad token', async () => {
    getAccessToken.mockResolvedValue('SUPER_SECRET_TOKEN_VALUE');
    fetchSpy.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: { code: 401, message: 'unauthorized' } }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        })
      )
    );
    const client = new OAuthProxyClient({ proxyBaseUrl: PROXY_URL, getAccessToken });

    let thrown: any;
    try {
      await client.search('res.partner', []);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeDefined();
    expect(thrown.message).not.toContain('SUPER_SECRET_TOKEN_VALUE');
    // Stringified error (toJSON) also must not contain the token.
    expect(JSON.stringify(thrown.toJSON?.() ?? thrown)).not.toContain('SUPER_SECRET_TOKEN_VALUE');
  });
});
