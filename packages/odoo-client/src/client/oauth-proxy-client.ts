/**
 * OAuth-fronted Odoo client.
 *
 * Sibling to {@link OdooClient}. Same CRUD surface (via the
 * {@link OdooCrudClient} interface), different transport: every RPC POSTs to
 * `${proxyBaseUrl}/jsonrpc` with `Authorization: Bearer <token>`. The bearer
 * token comes from the user-supplied `getAccessToken()` callback and is
 * fetched per-request (no client-side caching — that's the user's job).
 *
 * ## Key differences from OdooClient
 *
 * - **No `common.login`.** The OAuth bearer IS the session. `authenticate()`
 *   is a no-op stub for source-compat with existing call sites that do
 *   `await client.authenticate()`. No fetch is made.
 * - **No password / api-key.** The proxy resolves the tenant from the bearer
 *   token and substitutes db / uid / api_key into the wire envelope server-side.
 *   The client sends sentinel stubs at args[0..2].
 * - **No safety guard** (v1). The `safetyLevel` option on `call()` is accepted
 *   for source-compat with `OdooCrudClient` but is IGNORED. A safety guard
 *   can be added later via the same opt-in machinery as `OdooClient` if needed.
 * - **No service accessors** (v1). `client.mail`, `client.modules`, etc. live
 *   on `OdooClient` only. They will be threaded through `OdooCrudClient` in
 *   a follow-up phase if/when needed.
 *
 * ## Usage
 *
 * ```typescript
 * import { OAuthProxyClient } from '@marcfargas/odoo-client';
 *
 * const client = new OAuthProxyClient({
 *   proxyBaseUrl: 'https://proxy.example.com',
 *   getAccessToken: async () => myAuthLib.getAccessToken(),
 * });
 *
 * const partners = await client.searchRead('res.partner', [], {
 *   fields: ['name', 'email'],
 *   limit: 10,
 * });
 * ```
 *
 * @see Plan 07-02 in odoo-api-proxy/.planning/phases/07-cross-repo-oauthproxyclient/
 */

import { BearerJsonRpcTransport } from '../rpc/bearer-transport';
import type { OdooSessionInfo } from '../rpc/types';
import type { OdooCrudClient, SearchOptions, SearchReadOptions, CallOptions } from './types';

/**
 * Configuration for {@link OAuthProxyClient}.
 */
export interface OAuthProxyClientConfig {
  /**
   * Base URL of the OAuth-fronted proxy (e.g. `https://proxy.example.com`).
   * Trailing slashes are stripped; `/jsonrpc` is appended for every request.
   */
  proxyBaseUrl: string;
  /**
   * Async callback returning the current bearer token. Called once per RPC;
   * called a SECOND time on HTTP 401 to signal token-refresh. The callback
   * owns caching and refresh logic — this client never caches.
   */
  getAccessToken: () => Promise<string>;
}

/**
 * Stub session returned by {@link OAuthProxyClient#authenticate} and
 * {@link OAuthProxyClient#getSession}.
 *
 * The OAuth bearer is the session — there is no `common.login`, no uid lookup,
 * no session_id. Returning a stub keeps callers that legacy on the OdooClient
 * shape working without code changes.
 */
const STUB_SESSION: OdooSessionInfo = { uid: 0, db: '', session_id: '' };

/**
 * Odoo client that talks to an OAuth-fronted proxy.
 *
 * Implements {@link OdooCrudClient} so existing call sites can swap from
 * {@link OdooClient} with only a constructor change.
 */
export class OAuthProxyClient implements OdooCrudClient {
  private transport: BearerJsonRpcTransport;

  constructor(config: OAuthProxyClientConfig) {
    this.transport = new BearerJsonRpcTransport({
      proxyBaseUrl: config.proxyBaseUrl,
      getAccessToken: config.getAccessToken,
    });
  }

  // ── Auth (source-compat shims) ──────────────────────────────────────

  /**
   * No-op authenticate() for source-compat with OdooClient callers.
   *
   * The OAuth bearer token IS the session — there is no separate login step.
   * Returns a stub OdooSessionInfo so existing call sites that do
   * `await client.authenticate()` keep working without code changes.
   *
   * Per CONTEXT.md §Authentication call: this is documented source-compat,
   * not a hidden behaviour. Callers should remove the `authenticate()` call
   * when migrating to OAuthProxyClient.
   */
  async authenticate(): Promise<OdooSessionInfo> {
    return STUB_SESSION;
  }

  /**
   * Always returns `true` — the bearer token IS the authentication state.
   * There is no separate login flag to track.
   *
   * @deprecated Source-compat shim. The bearer is the auth; check token
   * validity in your `getAccessToken` callback instead.
   */
  isAuthenticated(): boolean {
    return true;
  }

  /**
   * Returns the stub session `{uid: 0, db: '', session_id: ''}`.
   *
   * @deprecated Source-compat shim. There is no real session — the proxy
   * resolves the tenant from the bearer token on every request.
   */
  getSession(): OdooSessionInfo {
    return STUB_SESSION;
  }

  /**
   * No-op for source-compat with OdooClient.
   *
   * @deprecated Source-compat shim. There is no session to invalidate;
   * revoke the bearer token via your auth provider instead.
   */
  logout(): void {
    // No-op. The bearer token is owned by the user's auth provider; this
    // client does not store any session state to drop.
  }

  // ── RPC ─────────────────────────────────────────────────────────────

  /**
   * Make a raw RPC call to a model method.
   *
   * The `options.safetyLevel` parameter is accepted for source-compat with
   * {@link OdooCrudClient} but is IGNORED in v1 — there is no safety guard.
   * If you need safety guards for proxy-fronted calls, file an issue.
   *
   * @param model  - Model name (e.g. `res.partner`)
   * @param method - Method name (e.g. `search_read`, `unlink`)
   * @param args   - Positional arguments
   * @param kwargs - Keyword arguments (context, etc)
   * @param _options - IGNORED (source-compat only)
   * @returns Method result, typed as T
   */
  async call<T = any>(
    model: string,
    method: string,
    args: any[] = [],
    kwargs: Record<string, any> = {},
    _options?: CallOptions
  ): Promise<T> {
    // _options.safetyLevel is intentionally ignored. v1 has no safety guard.
    return this.transport.call<T>(model, method, args, kwargs);
  }

  // ── CRUD ────────────────────────────────────────────────────────────
  //
  // Method bodies mirror OdooClient byte-for-byte (modulo the `safetyContext`
  // / `guard` / `isAuthenticated` checks that don't apply here). Keeping the
  // shapes identical is what guarantees surface parity (SC1).

  async search(model: string, domain: any[] = [], options: SearchOptions = {}): Promise<number[]> {
    const kwargs: Record<string, any> = {};
    if (options.offset !== undefined) kwargs.offset = options.offset;
    if (options.limit !== undefined) kwargs.limit = options.limit;
    if (options.order !== undefined) kwargs.order = options.order;
    if (options.context !== undefined) kwargs.context = options.context;

    return this.call<number[]>(model, 'search', [domain], kwargs);
  }

  async read<T extends Record<string, any> = Record<string, any>>(
    model: string,
    ids: number | number[],
    fields: string[] = [],
    context?: Record<string, any>
  ): Promise<T[]> {
    const idArray = Array.isArray(ids) ? ids : [ids];
    const kwargs: Record<string, any> = {};
    if (context !== undefined) kwargs.context = context;
    return this.call<T[]>(model, 'read', [idArray, fields], kwargs);
  }

  async searchRead<T extends Record<string, any> = Record<string, any>>(
    model: string,
    domain: any[] = [],
    options: SearchReadOptions = {}
  ): Promise<T[]> {
    const kwargs: Record<string, any> = {};
    if (options.fields !== undefined && options.fields.length > 0) {
      kwargs.fields = options.fields;
    }
    if (options.offset !== undefined) kwargs.offset = options.offset;
    if (options.limit !== undefined) kwargs.limit = options.limit;
    if (options.order !== undefined) kwargs.order = options.order;
    if (options.context !== undefined) kwargs.context = options.context;

    return this.call<T[]>(model, 'search_read', [domain], kwargs);
  }

  async create(
    model: string,
    values: Record<string, any>,
    context: Record<string, any> = {}
  ): Promise<number> {
    return this.call<number>(model, 'create', [values], { context });
  }

  async write(
    model: string,
    ids: number | number[],
    values: Record<string, any>,
    context: Record<string, any> = {}
  ): Promise<boolean> {
    const idArray = Array.isArray(ids) ? ids : [ids];
    return this.call<boolean>(model, 'write', [idArray, values], { context });
  }

  async unlink(model: string, ids: number | number[]): Promise<boolean> {
    const idArray = Array.isArray(ids) ? ids : [ids];
    return this.call<boolean>(model, 'unlink', [idArray]);
  }

  async searchCount(
    model: string,
    domain: any[] = [],
    context?: Record<string, any>
  ): Promise<number> {
    const kwargs: Record<string, any> = {};
    if (context !== undefined) kwargs.context = context;
    return this.call<number>(model, 'search_count', [domain], kwargs);
  }
}
