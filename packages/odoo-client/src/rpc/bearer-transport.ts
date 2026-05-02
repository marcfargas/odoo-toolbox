/**
 * Bearer-token JSON-RPC transport for the OAuth-fronted proxy.
 *
 * SIBLING to {@link JsonRpcTransport}, NOT a subclass — different auth model
 * (header instead of body), different envelope shape (sentinel stubs instead
 * of real db/uid/password), different error surface (no common.login path).
 * Inheritance would couple lifecycles; sibling is cleaner per CONTEXT §Class
 * topology decision.
 *
 * ## Wire envelope contract (mirrors odoo-api-proxy src/surfaces/jsonrpc.ts)
 *
 * For `service='object', method='execute_kw'`, the proxy expects:
 *
 * ```
 *   args = [db, uid, password/api_key, model, method, posArgs, kwargs]
 * ```
 *
 * and rewrites `args[1]` and `args[2]` server-side from the bearer-token-resolved
 * tenant context. This client therefore sends sentinel stubs:
 *
 *   - `args[0] = ''`   (db — proxy will substitute in a future plan; currently
 *                       not rewritten, but the proxy reads tenant.odooDatabase)
 *   - `args[1] = 0`    (uid — rewritten by proxy via userIdOverride ?? minterUserId)
 *   - `args[2] = ''`   (api_key — rewritten by proxy via decryptedKey)
 *
 * `common.login` is REJECTED by the proxy with HTTP 400 + `common_login_rejected`.
 * This client therefore NEVER emits `service='common', method='login'`.
 *
 * ## Authorization contract
 *
 * Every request carries `Authorization: Bearer <token>` where `<token>` comes
 * from the user-supplied `getAccessToken()` callback. The callback is invoked
 * ONCE per `.call()` / `.callRaw()` invocation — this transport does NOT cache
 * tokens (caching is the user's responsibility per CONTEXT §Out of scope).
 *
 * ## 401-retry contract
 *
 * If the proxy returns HTTP 401 on the first attempt, this transport calls
 * `getAccessToken()` AGAIN (signaling to the user's caching layer that the
 * previously-returned token is stale) and retries the SAME request ONCE.
 * If the second attempt also returns 401, it throws {@link OdooAuthError}.
 * No exponential backoff. No infinite loop. Bounded by exactly one retry.
 *
 * ## 429 / rate-limit contract
 *
 * HTTP 429 from the proxy throws an {@link OdooRpcError} with
 * `code = 'rate_limited'`. If the response includes a numeric `Retry-After`
 * header, it is parsed as integer seconds and exposed via
 * `data.retryAfterSeconds`. The HTTP-date form of `Retry-After` (RFC 7231
 * §7.1.3) is NOT parsed — the field is omitted in that case. This is the
 * documented design choice for Plan 07-04 to assert against (chose flag-on-
 * generic-error over a new `OdooRateLimitError` subclass to keep the error
 * hierarchy small; downstream callers `instanceof OdooRpcError` already match).
 */

import debug from 'debug';
import {
  OdooRpcError,
  OdooNetworkError,
  OdooAuthError,
  OdooValidationError,
  OdooAccessError,
  OdooMissingError,
} from '../types/errors';
import { JsonRpcRequest, JsonRpcResponse } from './types';

const log = debug('odoo-client:bearer-rpc');

export interface BearerJsonRpcTransportConfig {
  /**
   * Base URL of the OAuth-fronted proxy (e.g. `https://proxy.example.com`).
   * Trailing slash is stripped; `/jsonrpc` is appended for every request.
   */
  proxyBaseUrl: string;
  /**
   * Async callback that returns the current bearer token. Called once per
   * RPC; called a SECOND time on HTTP 401 to signal token-refresh. The
   * callback owns caching/refresh logic.
   */
  getAccessToken: () => Promise<string>;
}

/**
 * JSON-RPC transport that authenticates via `Authorization: Bearer <token>`.
 *
 * Used by {@link OAuthProxyClient}. Speaks to the odoo-api-proxy `/jsonrpc`
 * endpoint, which mints/substitutes credentials server-side.
 */
export class BearerJsonRpcTransport {
  private rpcUrl: string;
  private getAccessToken: () => Promise<string>;
  private requestId = 0;

  constructor(config: BearerJsonRpcTransportConfig) {
    // Normalize base URL — strip trailing slash, append /jsonrpc.
    const normalized = config.proxyBaseUrl.replace(/\/$/, '');
    this.rpcUrl = `${normalized}/jsonrpc`;
    this.getAccessToken = config.getAccessToken;
  }

  private nextRequestId(): number {
    return ++this.requestId;
  }

  /**
   * Call an Odoo model method via the proxy.
   *
   * Wraps the input as the SPEC §5.1 `execute_kw` envelope with sentinel stubs
   * at args[0..2]. The proxy substitutes the real db / uid / api_key.
   *
   * @param model  - Model name (e.g. `res.partner`)
   * @param method - Method name (e.g. `search_read`)
   * @param args   - Positional arguments
   * @param kwargs - Keyword arguments (context, etc)
   * @returns Method result, typed as T
   */
  async call<T = any>(
    model: string,
    method: string,
    args: any[] = [],
    kwargs: Record<string, any> = {}
  ): Promise<T> {
    log(`→ ${model}.${method}()`);
    const params = {
      service: 'object',
      method: 'execute_kw',
      // Sentinel stubs at [0..2]; user values at [3..6].
      args: ['', 0, '', model, method, args, kwargs],
    };
    return this.requestWithBearer<T>(params);
  }

  /**
   * Lower-level passthrough for non-`execute_kw` services (e.g. `common.version`).
   *
   * Emits the envelope verbatim. Carries the same Bearer auth header. NEVER
   * use this for `service='common', method='login'` — the proxy rejects it.
   *
   * @param service - JSON-RPC service (e.g. `common`, `db`)
   * @param method  - JSON-RPC method (e.g. `version`, `about`)
   * @param args    - Arbitrary positional arguments matching the service spec
   * @returns Method result, typed as T
   */
  async callRaw<T = any>(service: string, method: string, args: any[] = []): Promise<T> {
    log(`→ ${service}.${method}()`);
    const params = { service, method, args };
    return this.requestWithBearer<T>(params);
  }

  /**
   * Internal: emit the envelope with bearer auth, parse response, retry once on 401.
   */
  private async requestWithBearer<T>(params: Record<string, any>): Promise<T> {
    const envelope: JsonRpcRequest = {
      jsonrpc: '2.0',
      method: 'call',
      params,
      id: this.nextRequestId(),
    };

    // First attempt.
    const firstAttempt = await this.singleRequest<T>(envelope);
    if (firstAttempt.kind === 'ok') return firstAttempt.value;
    if (firstAttempt.kind === 'unauthorized') {
      // Token may be stale — re-fetch and retry exactly once.
      const secondAttempt = await this.singleRequest<T>(envelope);
      if (secondAttempt.kind === 'ok') return secondAttempt.value;
      if (secondAttempt.kind === 'unauthorized') {
        throw new OdooAuthError(secondAttempt.message);
      }
      throw secondAttempt.error;
    }
    throw firstAttempt.error;
  }

  /**
   * Internal: a single fetch attempt. Returns a tagged result so the caller
   * can decide whether to retry on 401.
   */
  private async singleRequest<T>(
    envelope: JsonRpcRequest
  ): Promise<
    | { kind: 'ok'; value: T }
    | { kind: 'unauthorized'; message: string }
    | { kind: 'fail'; error: Error }
  > {
    // Defensive: the user's getAccessToken could throw, return non-strings,
    // or return empty strings. Validate before constructing the header. The
    // token VALUE is never embedded in any thrown message (T-07-02-01).
    let token: string;
    try {
      token = await this.getAccessToken();
    } catch (err) {
      return {
        kind: 'fail',
        error: new OdooAuthError(
          `getAccessToken threw: ${err instanceof Error ? err.message : String(err)}`
        ),
      };
    }
    if (typeof token !== 'string' || token.length === 0) {
      return {
        kind: 'fail',
        error: new OdooAuthError('getAccessToken returned an invalid token'),
      };
    }

    let response: Response;
    try {
      response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(envelope),
      });
    } catch (err) {
      return {
        kind: 'fail',
        error: new OdooNetworkError(
          `RPC fetch failed: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err : new Error(String(err))
        ),
      };
    }

    // 401 → caller decides whether to retry.
    if (response.status === 401) {
      let message = 'Unauthorized';
      try {
        const body = (await response.json()) as JsonRpcResponse;
        message = body.error?.message || message;
      } catch {
        /* swallow JSON parse errors on 401 — message stays default */
      }
      return { kind: 'unauthorized', message };
    }

    // 429 → rate-limited; map to OdooRpcError with code='rate_limited'.
    if (response.status === 429) {
      let message = 'Rate limited';
      try {
        const body = (await response.json()) as JsonRpcResponse;
        message = body.error?.message || message;
      } catch {
        /* keep default message */
      }
      const data: Record<string, any> = {};
      const retryAfterRaw = response.headers.get('Retry-After');
      if (retryAfterRaw !== null) {
        // RFC 7231 §7.1.3 — only the integer-seconds form. HTTP-date form
        // (e.g. "Wed, 21 Oct 2026 07:28:00 GMT") is intentionally ignored.
        const trimmed = retryAfterRaw.trim();
        if (/^\d+$/.test(trimmed)) {
          data.retryAfterSeconds = parseInt(trimmed, 10);
        }
      }
      return {
        kind: 'fail',
        error: new OdooRpcError(message, { code: 'rate_limited', data }),
      };
    }

    // Other non-2xx → network-class error.
    if (!response.ok) {
      return {
        kind: 'fail',
        error: new OdooNetworkError(
          `HTTP ${response.status}: ${response.statusText}`,
          new Error(`HTTP Error ${response.status}`)
        ),
      };
    }

    // 2xx → parse body; surface JSON-RPC `error` shape via categorizeError.
    let data: JsonRpcResponse<T>;
    try {
      data = (await response.json()) as JsonRpcResponse<T>;
    } catch (err) {
      return {
        kind: 'fail',
        error: new OdooNetworkError(
          `RPC response parse failed: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err : new Error(String(err))
        ),
      };
    }

    if (data.error) {
      return { kind: 'fail', error: categorizeError(data.error) };
    }

    if (data.result === undefined) {
      return {
        kind: 'fail',
        error: new OdooRpcError('Invalid RPC response: missing result field'),
      };
    }

    return { kind: 'ok', value: data.result };
  }
}

/**
 * Categorize a JSON-RPC `error` payload into a typed OdooRpcError subclass.
 *
 * MUST mirror `JsonRpcTransport.categorizeError` byte-for-byte so error
 * surfaces stay parity across transports. If the password-auth transport's
 * categorizer changes, this one MUST change too.
 *
 * @see {@link JsonRpcTransport#categorizeError} in src/rpc/transport.ts
 */
function categorizeError(error: {
  code?: number;
  message?: string;
  data?: Record<string, any>;
}): OdooRpcError {
  const errorData = error.data;
  const exceptionType = errorData?.exception_type || '';
  const exceptionName = errorData?.name || '';
  const errorMessage = errorData?.message || error.message || 'Unknown RPC error';
  const opts = { code: String(error.code ?? ''), data: errorData };

  // Authentication errors
  if (exceptionType === 'access_denied' || exceptionName.includes('AccessDenied')) {
    return new OdooAuthError(errorMessage);
  }

  // Access/permission errors
  if (exceptionType === 'access_error' || exceptionName.includes('AccessError')) {
    return new OdooAccessError(errorMessage, opts);
  }

  // Validation / business logic errors
  if (
    exceptionType === 'validation_error' ||
    exceptionType === 'user_error' ||
    exceptionName.includes('ValidationError') ||
    exceptionName.includes('UserError')
  ) {
    return new OdooValidationError(errorMessage, opts);
  }

  // Missing record errors
  if (exceptionType === 'missing_error' || exceptionName.includes('MissingError')) {
    return new OdooMissingError(errorMessage, opts);
  }

  // Generic RPC error
  return new OdooRpcError(errorMessage, opts);
}
