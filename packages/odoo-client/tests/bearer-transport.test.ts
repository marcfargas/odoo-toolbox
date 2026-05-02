/**
 * Unit tests for BearerJsonRpcTransport.
 *
 * Mocks `globalThis.fetch` via vitest spies. NO real HTTP.
 *
 * Coverage matrix (from 07-02 PLAN Task 1):
 *   1. POSTs to `${proxyBaseUrl}/jsonrpc`
 *   2. Outbound envelope shape — args[0..2] are sentinel stubs ('', 0, '')
 *   3. Authorization: Bearer <token>; getAccessToken called once per call
 *   4. NO Cookie header
 *   5. 401 → re-fetch token + retry once; second 401 → OdooAuthError
 *   6. 200 + {error} → categorized via shared categorizeError
 *   7. 429 → OdooRpcError code='rate_limited' + data.retryAfterSeconds
 *   8. fetch rejects → OdooNetworkError
 *   9. Other 5xx → OdooNetworkError with status in message
 *  10. callRaw passthrough for non-execute_kw envelopes
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BearerJsonRpcTransport } from '../src/rpc/bearer-transport';
import {
  OdooAuthError,
  OdooRpcError,
  OdooNetworkError,
  OdooValidationError,
  OdooAccessError,
  OdooMissingError,
} from '../src/types/errors';

type MockResponseInit = {
  status?: number;
  statusText?: string;
  body?: any;
  headers?: Record<string, string>;
};

function mockResponse(init: MockResponseInit = {}): Response {
  const status = init.status ?? 200;
  const headers = new Headers(init.headers ?? {});
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const bodyStr = init.body === undefined ? '{}' : JSON.stringify(init.body);
  return new Response(bodyStr, {
    status,
    statusText: init.statusText ?? '',
    headers,
  });
}

function lastCallBody(fetchSpy: ReturnType<typeof vi.fn>): any {
  const lastCall = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1];
  const init = lastCall[1] as RequestInit;
  return JSON.parse(init.body as string);
}

function lastCallHeaders(fetchSpy: ReturnType<typeof vi.fn>): Record<string, string> {
  const lastCall = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1];
  const init = lastCall[1] as RequestInit;
  // Headers may be a plain object literal (per our impl) — return verbatim.
  return init.headers as Record<string, string>;
}

describe('BearerJsonRpcTransport', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  let getAccessToken: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    getAccessToken = vi.fn().mockResolvedValue('TEST_BEARER_TOKEN');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // ─── Test 1: POST to /jsonrpc ───────────────────────────────────────

  it('POSTs to ${proxyBaseUrl}/jsonrpc', async () => {
    fetchSpy.mockResolvedValue(mockResponse({ body: { jsonrpc: '2.0', id: 1, result: [] } }));

    const transport = new BearerJsonRpcTransport({
      proxyBaseUrl: 'https://proxy.example.com',
      getAccessToken,
    });

    await transport.call('res.partner', 'search_read', [[]], { limit: 5 });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://proxy.example.com/jsonrpc');
    expect((init as RequestInit).method).toBe('POST');
  });

  it('strips trailing slash from proxyBaseUrl before appending /jsonrpc', async () => {
    fetchSpy.mockResolvedValue(mockResponse({ body: { jsonrpc: '2.0', id: 1, result: [] } }));

    const transport = new BearerJsonRpcTransport({
      proxyBaseUrl: 'https://proxy.example.com/',
      getAccessToken,
    });

    await transport.call('res.partner', 'search_read', [[]], { limit: 5 });

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://proxy.example.com/jsonrpc');
  });

  // ─── Test 2: Envelope shape with sentinel stubs ─────────────────────

  it('emits the JSON-RPC envelope with args[0..2] as sentinel stubs', async () => {
    fetchSpy.mockResolvedValue(mockResponse({ body: { jsonrpc: '2.0', id: 1, result: [] } }));

    const transport = new BearerJsonRpcTransport({
      proxyBaseUrl: 'https://proxy.example.com',
      getAccessToken,
    });

    await transport.call('res.partner', 'search_read', [[]], { limit: 5 });

    const body = lastCallBody(fetchSpy);
    expect(body.jsonrpc).toBe('2.0');
    expect(body.method).toBe('call');
    expect(body.params.service).toBe('object');
    expect(body.params.method).toBe('execute_kw');
    expect(Array.isArray(body.params.args)).toBe(true);
    expect(body.params.args[0]).toBe('');
    expect(body.params.args[1]).toBe(0);
    expect(body.params.args[2]).toBe('');
    expect(body.params.args[3]).toBe('res.partner');
    expect(body.params.args[4]).toBe('search_read');
    expect(body.params.args[5]).toEqual([[]]);
    expect(body.params.args[6]).toEqual({ limit: 5 });
    expect(typeof body.id).toBe('number');
  });

  // ─── Test 3: Bearer header + getAccessToken once per call ───────────

  it('attaches Authorization: Bearer <token> from getAccessToken', async () => {
    fetchSpy.mockResolvedValue(mockResponse({ body: { jsonrpc: '2.0', id: 1, result: [] } }));

    const transport = new BearerJsonRpcTransport({
      proxyBaseUrl: 'https://proxy.example.com',
      getAccessToken,
    });

    await transport.call('res.partner', 'search', [[]], {});

    expect(getAccessToken).toHaveBeenCalledTimes(1);
    const headers = lastCallHeaders(fetchSpy);
    // Find auth header case-insensitively.
    const authKey = Object.keys(headers).find((k) => k.toLowerCase() === 'authorization');
    expect(authKey).toBeDefined();
    expect(headers[authKey!]).toBe('Bearer TEST_BEARER_TOKEN');
  });

  it('calls getAccessToken once per .call() invocation (no client-side caching)', async () => {
    // Each fetch must return a fresh Response (body is single-consumption).
    fetchSpy.mockImplementation(() =>
      Promise.resolve(mockResponse({ body: { jsonrpc: '2.0', id: 1, result: [] } }))
    );

    const transport = new BearerJsonRpcTransport({
      proxyBaseUrl: 'https://proxy.example.com',
      getAccessToken,
    });

    await transport.call('res.partner', 'search', [[]], {});
    await transport.call('res.partner', 'search', [[]], {});
    await transport.call('res.partner', 'search', [[]], {});

    expect(getAccessToken).toHaveBeenCalledTimes(3);
  });

  // ─── Test 4: No Cookie header ───────────────────────────────────────

  it('sends NO Cookie header (case-insensitive)', async () => {
    fetchSpy.mockResolvedValue(mockResponse({ body: { jsonrpc: '2.0', id: 1, result: [] } }));

    const transport = new BearerJsonRpcTransport({
      proxyBaseUrl: 'https://proxy.example.com',
      getAccessToken,
    });

    await transport.call('res.partner', 'search', [[]], {});

    const headers = lastCallHeaders(fetchSpy);
    const cookieKey = Object.keys(headers).find((k) => k.toLowerCase() === 'cookie');
    expect(cookieKey).toBeUndefined();
  });

  // ─── Test 5: 401 retry semantics ────────────────────────────────────

  it('on 401, calls getAccessToken AGAIN and retries the request once', async () => {
    fetchSpy
      .mockResolvedValueOnce(
        mockResponse({
          status: 401,
          body: { error: { code: 401, message: 'expired token' } },
        })
      )
      .mockResolvedValueOnce(mockResponse({ body: { jsonrpc: '2.0', id: 1, result: [42] } }));

    getAccessToken.mockResolvedValueOnce('STALE_TOKEN').mockResolvedValueOnce('FRESH_TOKEN');

    const transport = new BearerJsonRpcTransport({
      proxyBaseUrl: 'https://proxy.example.com',
      getAccessToken,
    });

    const result = await transport.call('res.partner', 'search', [[]], {});

    expect(result).toEqual([42]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(getAccessToken).toHaveBeenCalledTimes(2);

    // First call had STALE_TOKEN; second had FRESH_TOKEN.
    const firstHeaders = fetchSpy.mock.calls[0][1].headers as Record<string, string>;
    const secondHeaders = fetchSpy.mock.calls[1][1].headers as Record<string, string>;
    const firstAuth = Object.entries(firstHeaders).find(
      ([k]) => k.toLowerCase() === 'authorization'
    )![1];
    const secondAuth = Object.entries(secondHeaders).find(
      ([k]) => k.toLowerCase() === 'authorization'
    )![1];
    expect(firstAuth).toBe('Bearer STALE_TOKEN');
    expect(secondAuth).toBe('Bearer FRESH_TOKEN');
  });

  it('on second 401, throws OdooAuthError', async () => {
    fetchSpy.mockResolvedValue(
      mockResponse({
        status: 401,
        body: { error: { code: 401, message: 'still bad' } },
      })
    );

    const transport = new BearerJsonRpcTransport({
      proxyBaseUrl: 'https://proxy.example.com',
      getAccessToken,
    });

    await expect(transport.call('res.partner', 'search', [[]], {})).rejects.toBeInstanceOf(
      OdooAuthError
    );
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  // ─── Test 6: 200 + {error} categorization ───────────────────────────

  it('categorizes 200 + {error: AccessError} as OdooAccessError', async () => {
    fetchSpy.mockResolvedValue(
      mockResponse({
        body: {
          jsonrpc: '2.0',
          id: 1,
          error: {
            code: 200,
            message: 'access denied to record',
            data: { name: 'odoo.exceptions.AccessError', message: 'access denied to record' },
          },
        },
      })
    );

    const transport = new BearerJsonRpcTransport({
      proxyBaseUrl: 'https://proxy.example.com',
      getAccessToken,
    });

    await expect(transport.call('res.partner', 'read', [[1]], {})).rejects.toBeInstanceOf(
      OdooAccessError
    );
  });

  it('categorizes 200 + {error: ValidationError} as OdooValidationError', async () => {
    fetchSpy.mockResolvedValue(
      mockResponse({
        body: {
          jsonrpc: '2.0',
          id: 1,
          error: {
            code: 200,
            message: 'required field',
            data: { name: 'odoo.exceptions.ValidationError', message: 'required field' },
          },
        },
      })
    );

    const transport = new BearerJsonRpcTransport({
      proxyBaseUrl: 'https://proxy.example.com',
      getAccessToken,
    });

    await expect(transport.call('res.partner', 'create', [{}], {})).rejects.toBeInstanceOf(
      OdooValidationError
    );
  });

  it('categorizes 200 + {error: MissingError} as OdooMissingError', async () => {
    fetchSpy.mockResolvedValue(
      mockResponse({
        body: {
          jsonrpc: '2.0',
          id: 1,
          error: {
            code: 200,
            message: 'record not found',
            data: { name: 'odoo.exceptions.MissingError', message: 'record not found' },
          },
        },
      })
    );

    const transport = new BearerJsonRpcTransport({
      proxyBaseUrl: 'https://proxy.example.com',
      getAccessToken,
    });

    await expect(transport.call('res.partner', 'read', [[999]], {})).rejects.toBeInstanceOf(
      OdooMissingError
    );
  });

  it('falls back to generic OdooRpcError for unknown error shapes', async () => {
    fetchSpy.mockResolvedValue(
      mockResponse({
        body: {
          jsonrpc: '2.0',
          id: 1,
          error: { code: 200, message: 'something exploded' },
        },
      })
    );

    const transport = new BearerJsonRpcTransport({
      proxyBaseUrl: 'https://proxy.example.com',
      getAccessToken,
    });

    await expect(transport.call('res.partner', 'search', [[]], {})).rejects.toBeInstanceOf(
      OdooRpcError
    );
  });

  // ─── Test 7: 429 with Retry-After ───────────────────────────────────

  it('on 429, throws OdooRpcError with code=rate_limited and retryAfterSeconds', async () => {
    fetchSpy.mockResolvedValue(
      mockResponse({
        status: 429,
        headers: { 'Retry-After': '30' },
        body: { error: { code: 429, message: 'rate limited' } },
      })
    );

    const transport = new BearerJsonRpcTransport({
      proxyBaseUrl: 'https://proxy.example.com',
      getAccessToken,
    });

    let thrown: any;
    try {
      await transport.call('res.partner', 'search', [[]], {});
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(OdooRpcError);
    expect(thrown.code).toBe('rate_limited');
    expect(thrown.data?.retryAfterSeconds).toBe(30);
  });

  it('on 429 without Retry-After, throws OdooRpcError code=rate_limited and omits retryAfterSeconds', async () => {
    fetchSpy.mockResolvedValue(
      mockResponse({
        status: 429,
        body: { error: { code: 429, message: 'rate limited' } },
      })
    );

    const transport = new BearerJsonRpcTransport({
      proxyBaseUrl: 'https://proxy.example.com',
      getAccessToken,
    });

    let thrown: any;
    try {
      await transport.call('res.partner', 'search', [[]], {});
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(OdooRpcError);
    expect(thrown.code).toBe('rate_limited');
    expect(thrown.data?.retryAfterSeconds).toBeUndefined();
  });

  it('on 429 with non-integer Retry-After, omits retryAfterSeconds (HTTP-date form ignored)', async () => {
    fetchSpy.mockResolvedValue(
      mockResponse({
        status: 429,
        headers: { 'Retry-After': 'Wed, 21 Oct 2026 07:28:00 GMT' },
        body: { error: { code: 429, message: 'rate limited' } },
      })
    );

    const transport = new BearerJsonRpcTransport({
      proxyBaseUrl: 'https://proxy.example.com',
      getAccessToken,
    });

    let thrown: any;
    try {
      await transport.call('res.partner', 'search', [[]], {});
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(OdooRpcError);
    expect(thrown.code).toBe('rate_limited');
    expect(thrown.data?.retryAfterSeconds).toBeUndefined();
  });

  // ─── Test 8: fetch rejects → OdooNetworkError ───────────────────────

  it('on fetch rejection (network error), throws OdooNetworkError', async () => {
    fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));

    const transport = new BearerJsonRpcTransport({
      proxyBaseUrl: 'https://proxy.example.com',
      getAccessToken,
    });

    await expect(transport.call('res.partner', 'search', [[]], {})).rejects.toBeInstanceOf(
      OdooNetworkError
    );
  });

  // ─── Test 9: HTTP 5xx → OdooNetworkError with status in message ─────

  it('on HTTP 500, throws OdooNetworkError with status in message', async () => {
    fetchSpy.mockResolvedValue(
      mockResponse({
        status: 500,
        statusText: 'Internal Server Error',
        body: { error: { code: 500, message: 'boom' } },
      })
    );

    const transport = new BearerJsonRpcTransport({
      proxyBaseUrl: 'https://proxy.example.com',
      getAccessToken,
    });

    let thrown: any;
    try {
      await transport.call('res.partner', 'search', [[]], {});
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(OdooNetworkError);
    expect(thrown.message).toContain('500');
  });

  it('on HTTP 502, throws OdooNetworkError with status in message', async () => {
    fetchSpy.mockResolvedValue(
      mockResponse({
        status: 502,
        statusText: 'Bad Gateway',
        body: { error: { code: 502, message: 'upstream' } },
      })
    );

    const transport = new BearerJsonRpcTransport({
      proxyBaseUrl: 'https://proxy.example.com',
      getAccessToken,
    });

    let thrown: any;
    try {
      await transport.call('res.partner', 'search', [[]], {});
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(OdooNetworkError);
    expect(thrown.message).toContain('502');
  });

  // ─── Test 10: callRaw passthrough ───────────────────────────────────

  it('callRaw emits a verbatim envelope (for non-execute_kw services)', async () => {
    fetchSpy.mockResolvedValue(
      mockResponse({ body: { jsonrpc: '2.0', id: 1, result: { server_version: '17.0' } } })
    );

    const transport = new BearerJsonRpcTransport({
      proxyBaseUrl: 'https://proxy.example.com',
      getAccessToken,
    });

    const result = await transport.callRaw<{ server_version: string }>('common', 'version', []);

    expect(result).toEqual({ server_version: '17.0' });
    const body = lastCallBody(fetchSpy);
    expect(body.params.service).toBe('common');
    expect(body.params.method).toBe('version');
    expect(body.params.args).toEqual([]);
  });

  it('callRaw also carries Bearer auth and posts to /jsonrpc', async () => {
    fetchSpy.mockResolvedValue(mockResponse({ body: { jsonrpc: '2.0', id: 1, result: {} } }));

    const transport = new BearerJsonRpcTransport({
      proxyBaseUrl: 'https://proxy.example.com',
      getAccessToken,
    });

    await transport.callRaw('common', 'version', []);

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://proxy.example.com/jsonrpc');
    const headers = lastCallHeaders(fetchSpy);
    const authKey = Object.keys(headers).find((k) => k.toLowerCase() === 'authorization');
    expect(headers[authKey!]).toBe('Bearer TEST_BEARER_TOKEN');
  });

  // ─── Defense-in-depth: token validation ─────────────────────────────

  it('throws OdooAuthError if getAccessToken returns empty string', async () => {
    getAccessToken.mockResolvedValue('');

    const transport = new BearerJsonRpcTransport({
      proxyBaseUrl: 'https://proxy.example.com',
      getAccessToken,
    });

    await expect(transport.call('res.partner', 'search', [[]], {})).rejects.toBeInstanceOf(
      OdooAuthError
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('throws OdooAuthError if getAccessToken returns non-string', async () => {
    getAccessToken.mockResolvedValue(undefined as unknown as string);

    const transport = new BearerJsonRpcTransport({
      proxyBaseUrl: 'https://proxy.example.com',
      getAccessToken,
    });

    await expect(transport.call('res.partner', 'search', [[]], {})).rejects.toBeInstanceOf(
      OdooAuthError
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
