/**
 * Shared CRUD contract for Odoo client implementations.
 *
 * Implementations:
 *   - {@link OdooClient}            — direct Odoo, api-key/password auth via common.login
 *   - {@link OAuthProxyClient}      — proxy-fronted, OAuth bearer auth (no common.login)
 *
 * Call sites that want to swap providers should program against this interface,
 * not the concrete classes.
 */

import type { SafetyLevel } from '../safety';

/**
 * Options for {@link OdooCrudClient.search} and the search half of
 * {@link OdooCrudClient.searchRead}.
 */
export interface SearchOptions {
  offset?: number;
  limit?: number;
  order?: string;
  context?: Record<string, any>;
}

/**
 * Options for {@link OdooCrudClient.searchRead} — search options plus
 * an optional `fields` projection.
 */
export interface SearchReadOptions extends SearchOptions {
  fields?: string[];
}

/**
 * Options for {@link OdooCrudClient.call} — primarily a safety-level
 * override for methods whose name does not infer correctly.
 */
export interface CallOptions {
  safetyLevel?: SafetyLevel;
}

/**
 * Surface-parity CRUD contract shared by every Odoo client implementation.
 *
 * Method signatures are byte-identical to the corresponding methods on
 * the concrete classes. Adding a method here REQUIRES updating every
 * implementation; removing or weakening a method REQUIRES coordinated
 * updates to every call site.
 */
export interface OdooCrudClient {
  /**
   * Make a raw RPC call to a model method.
   *
   * Safety level is inferred from the method name; override with
   * `options.safetyLevel` for methods the inference gets wrong.
   */
  call<T = any>(
    model: string,
    method: string,
    args?: any[],
    kwargs?: Record<string, any>,
    options?: CallOptions
  ): Promise<T>;

  /**
   * Search for records matching a domain, returning record IDs.
   */
  search(model: string, domain?: any[], options?: SearchOptions): Promise<number[]>;

  /**
   * Read records by ID.
   */
  read<T extends Record<string, any> = Record<string, any>>(
    model: string,
    ids: number | number[],
    fields?: string[],
    context?: Record<string, any>
  ): Promise<T[]>;

  /**
   * Search and read records in a single call.
   */
  searchRead<T extends Record<string, any> = Record<string, any>>(
    model: string,
    domain?: any[],
    options?: SearchReadOptions
  ): Promise<T[]>;

  /**
   * Create a new record, returning its ID.
   */
  create(
    model: string,
    values: Record<string, any>,
    context?: Record<string, any>
  ): Promise<number>;

  /**
   * Update records by ID.
   */
  write(
    model: string,
    ids: number | number[],
    values: Record<string, any>,
    context?: Record<string, any>
  ): Promise<boolean>;

  /**
   * Delete records by ID.
   */
  unlink(model: string, ids: number | number[]): Promise<boolean>;

  /**
   * Count records matching a domain.
   */
  searchCount(model: string, domain?: any[], context?: Record<string, any>): Promise<number>;
}
