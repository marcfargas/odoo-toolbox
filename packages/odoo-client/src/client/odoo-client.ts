/**
 * Main Odoo client with typed access to models and methods
 *
 * Provides a high-level API for interacting with Odoo
 */

import { JsonRpcTransport, OdooSessionInfo } from '../rpc/transport';
import { OdooAuthError } from '../types/errors';

export interface OdooClientConfig {
  url: string;
  database: string;
  username: string;
  password: string;
}

/**
 * Main client for interacting with Odoo
 *
 * Handles authentication and provides methods for CRUD operations on models
 */
export class OdooClient {
  private config: OdooClientConfig;
  private transport: JsonRpcTransport;
  private authenticated = false;

  constructor(config: OdooClientConfig) {
    this.config = config;
    this.transport = new JsonRpcTransport(config.url, config.database);
  }

  /**
   * Authenticate with Odoo
   *
   * Must be called before making any RPC calls
   */
  async authenticate(): Promise<OdooSessionInfo> {
    const session = await this.transport.authenticate(this.config.username, this.config.password);
    this.authenticated = true;
    return session;
  }

  /**
   * Check if client is authenticated
   */
  isAuthenticated(): boolean {
    return this.authenticated;
  }

  /**
   * Get current session info
   */
  getSession(): OdooSessionInfo | null {
    return this.transport.getSession();
  }

  /**
   * Make a raw RPC call to a model method
   *
   * @param model - Model name (e.g., 'res.partner')
   * @param method - Method name (e.g., 'search', 'read')
   * @param args - Positional arguments
   * @param kwargs - Keyword arguments (context, etc)
   * @returns Method result, typed as T
   */
  async call<T = any>(
    model: string,
    method: string,
    args: any[] = [],
    kwargs: Record<string, any> = {}
  ): Promise<T> {
    if (!this.authenticated) {
      throw new OdooAuthError('Client not authenticated. Call authenticate() first.');
    }
    return this.transport.call<T>(model, method, args, kwargs);
  }

  /**
   * Search for records
   *
   * @param model - Model name
   * @param domain - Search domain (e.g., [['active', '=', true]])
   * @param options - Search options (offset, limit, order, etc)
   * @returns Array of record IDs
   */
  async search(
    model: string,
    domain: any[] = [],
    options: {
      offset?: number;
      limit?: number;
      order?: string;
    } = {}
  ): Promise<number[]> {
    const kwargs: Record<string, any> = {};
    if (options.offset !== undefined) kwargs.offset = options.offset;
    if (options.limit !== undefined) kwargs.limit = options.limit;
    if (options.order !== undefined) kwargs.order = options.order;

    return this.call<number[]>(model, 'search', [domain], kwargs);
  }

  /**
   * Read records
   *
   * @param model - Model name
   * @param ids - Record IDs to read
   * @param fields - Fields to read (empty = all fields)
   * @returns Array of record objects
   */
  async read<T extends Record<string, any> = Record<string, any>>(
    model: string,
    ids: number | number[],
    fields: string[] = []
  ): Promise<T[]> {
    const idArray = Array.isArray(ids) ? ids : [ids];
    return this.call<T[]>(model, 'read', [idArray, fields]);
  }

  /**
   * Search and read records in one call
   *
   * @param model - Model name
   * @param domain - Search domain
   * @param options - Search and read options
   * @returns Array of record objects
   */
  async searchRead<T extends Record<string, any> = Record<string, any>>(
    model: string,
    domain: any[] = [],
    options: {
      fields?: string[];
      offset?: number;
      limit?: number;
      order?: string;
    } = {}
  ): Promise<T[]> {
    const kwargs: Record<string, any> = {};
    if (options.fields !== undefined && options.fields.length > 0) {
      kwargs.fields = options.fields;
    }
    if (options.offset !== undefined) kwargs.offset = options.offset;
    if (options.limit !== undefined) kwargs.limit = options.limit;
    if (options.order !== undefined) kwargs.order = options.order;

    return this.call<T[]>(model, 'search_read', [domain], kwargs);
  }

  /**
   * Create a new record
   *
   * @param model - Model name
   * @param values - Record values
   * @param context - Optional context for creation
   * @returns Created record ID
   */
  async create(
    model: string,
    values: Record<string, any>,
    context: Record<string, any> = {}
  ): Promise<number> {
    return this.call<number>(model, 'create', [values], { context });
  }

  /**
   * Update records
   *
   * @param model - Model name
   * @param ids - Record IDs to update
   * @param values - Values to update
   * @param context - Optional context for update
   * @returns True if successful
   */
  async write(
    model: string,
    ids: number | number[],
    values: Record<string, any>,
    context: Record<string, any> = {}
  ): Promise<boolean> {
    const idArray = Array.isArray(ids) ? ids : [ids];
    return this.call<boolean>(model, 'write', [idArray, values], { context });
  }

  /**
   * Delete records
   *
   * @param model - Model name
   * @param ids - Record IDs to delete
   * @returns True if successful
   */
  async unlink(model: string, ids: number | number[]): Promise<boolean> {
    const idArray = Array.isArray(ids) ? ids : [ids];
    return this.call<boolean>(model, 'unlink', [idArray]);
  }

  /**
   * Logout and close connection
   */
  logout(): void {
    this.transport.logout();
    this.authenticated = false;
  }
}
