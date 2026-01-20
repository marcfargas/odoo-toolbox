/**
 * Main Odoo client with typed access to models and methods
 *
 * Provides a high-level API for interacting with Odoo
 */

import { JsonRpcTransport, OdooSessionInfo } from '../rpc/transport';
import { OdooAuthError } from '../types/errors';
import { Introspector } from '../introspection/introspect';
import type {
  OdooModel,
  OdooField,
  ModelMetadata,
  IntrospectionOptions,
} from '../introspection/types';

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
  private introspector: Introspector;

  constructor(config: OdooClientConfig) {
    this.config = config;
    this.transport = new JsonRpcTransport(config.url, config.database);
    this.introspector = new Introspector(this);
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

  /**
   * Get all available models from Odoo.
   * 
   * Queries ir.model to retrieve all model definitions. Results are cached
   * to minimize RPC overhead.
   * 
   * @param options - Introspection options
   * @returns Array of model metadata
   * 
   * @example
   * ```typescript
   * const models = await client.getModels();
   * console.log(models.map(m => m.model)); // ['res.partner', 'project.task', ...]
   * ```
   */
  async getModels(options?: IntrospectionOptions): Promise<OdooModel[]> {
    return this.introspector.getModels(options);
  }

  /**
   * Get all fields for a specific model.
   * 
   * Queries ir.model.fields to retrieve field definitions. Results are cached.
   * 
   * @param modelName - Technical model name (e.g., 'res.partner')
   * @param options - Introspection options
   * @returns Array of field metadata
   * 
   * @example
   * ```typescript
   * const fields = await client.getFields('res.partner');
   * const nameField = fields.find(f => f.name === 'name');
   * ```
   */
  async getFields(
    modelName: string,
    options?: IntrospectionOptions
  ): Promise<OdooField[]> {
    return this.introspector.getFields(modelName, options);
  }

  /**
   * Get complete metadata for a model (model info + fields).
   * 
   * Convenience method that combines model and field metadata in a single call.
   * Results are cached.
   * 
   * @param modelName - Technical model name
   * @param options - Introspection options
   * @returns Combined model and field metadata
   * 
   * @example
   * ```typescript
   * const metadata = await client.getModelMetadata('res.partner');
   * console.log(metadata.model.name); // 'Contact'
   * console.log(metadata.fields.length); // 50+ fields
   * ```
   */
  async getModelMetadata(
    modelName: string,
    options?: IntrospectionOptions
  ): Promise<ModelMetadata> {
    return this.introspector.getModelMetadata(modelName, options);
  }

  /**
   * Clear the introspection cache.
   * 
   * Use this after installing or upgrading Odoo modules, which can
   * add new models or fields.
   */
  clearIntrospectionCache(): void {
    this.introspector.clearCache();
  }

  /**
   * Clear cached introspection data for a specific model.
   * 
   * @param modelName - Model to clear from cache
   */
  clearModelCache(modelName: string): void {
    this.introspector.clearModelCache(modelName);
  }
}
