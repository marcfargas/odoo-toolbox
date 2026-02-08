/**
 * Main Odoo client with typed access to models and methods
 *
 * Provides a high-level API for interacting with Odoo.
 * Supports opt-in safety guards for write/delete operations.
 */

import { JsonRpcTransport, OdooSessionInfo } from '../rpc/transport';
import { OdooAuthError, OdooSafetyError } from '../types/errors';
import {
  type SafetyContext,
  type SafetyLevel,
  type OperationInfo,
  inferSafetyLevel,
  resolveSafetyContext,
} from '../safety';
import {
  postInternalNote as _postInternalNote,
  postOpenMessage as _postOpenMessage,
  type PostMessageOptions,
} from './mail';

export interface OdooClientConfig {
  url: string;
  database: string;
  username: string;
  password: string;
  /**
   * Opt-in safety context for this client.
   * - undefined: use global default (setDefaultSafetyContext)
   * - null: explicitly disable safety for this client
   * - SafetyContext: custom confirm callback
   */
  safety?: SafetyContext | null;
}

/**
 * Main client for interacting with Odoo
 *
 * Handles authentication and provides methods for CRUD operations on models.
 * Safety guards are opt-in via `config.safety` or `setDefaultSafetyContext()`.
 */
export class OdooClient {
  private config: OdooClientConfig;
  private transport: JsonRpcTransport;
  private authenticated = false;
  private safetyContext: SafetyContext | null | undefined;

  constructor(config: OdooClientConfig) {
    this.config = config;
    this.transport = new JsonRpcTransport(config.url, config.database);
    this.safetyContext = config.safety;
  }

  /**
   * Override safety context for this client instance.
   * Pass null to explicitly disable, undefined to use global default.
   */
  setSafetyContext(ctx: SafetyContext | null | undefined): void {
    this.safetyContext = ctx;
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
   * Check safety guard for an operation.
   * Throws OdooSafetyError if the operation is blocked.
   */
  private async guard(op: OperationInfo): Promise<void> {
    const ctx = resolveSafetyContext(this.safetyContext);
    if (!ctx) return;
    if (op.level === 'READ') return;

    const confirmed = await ctx.confirm(op);
    if (!confirmed) {
      throw new OdooSafetyError(op);
    }
  }

  /**
   * Make a raw RPC call to a model method
   *
   * Safety level is inferred from the method name:
   * - Known read methods (search, read, fields_get, etc.) → READ (never blocked)
   * - unlink → DELETE
   * - Everything else → WRITE
   *
   * Override with `options.safetyLevel` for methods the inference gets wrong.
   *
   * @param model - Model name (e.g., 'res.partner')
   * @param method - Method name (e.g., 'search', 'read')
   * @param args - Positional arguments
   * @param kwargs - Keyword arguments (context, etc)
   * @param options - Additional options (safetyLevel override)
   * @returns Method result, typed as T
   */
  async call<T = any>(
    model: string,
    method: string,
    args: any[] = [],
    kwargs: Record<string, any> = {},
    options?: { safetyLevel?: SafetyLevel }
  ): Promise<T> {
    if (!this.authenticated) {
      throw new OdooAuthError('Client not authenticated. Call authenticate() first.');
    }

    const level = options?.safetyLevel ?? inferSafetyLevel(method);
    await this.guard({
      name: `odoo.${method}`,
      level,
      model,
      description: `${model}.${method}()`,
      target: this.config.url,
    });

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
   * Count matching records
   *
   * @param model - Model name
   * @param domain - Search domain
   * @returns Number of matching records
   */
  async searchCount(model: string, domain: any[] = []): Promise<number> {
    return this.call<number>(model, 'search_count', [domain]);
  }

  // ── Chatter / Mail helpers ──────────────────────────────────────────
  //
  // Two methods, two intents — no confusion:
  //   postInternalNote()  → staff-only note (invisible to portal/public)
  //   postOpenMessage()   → public message visible to ALL followers
  //
  // Body is HTML. Plain text is auto-wrapped in <p> tags.
  // Empty body throws OdooValidationError — it's always a bug.

  /**
   * Post an internal note on a record's chatter.
   *
   * Internal notes are visible ONLY to internal (staff) users.
   * No email notification is sent. Use for internal communication
   * that customers/portal users must not see.
   *
   * @param model  - Odoo model (must inherit mail.thread)
   * @param resId  - Record ID to post on
   * @param body   - HTML string or plain text (auto-wrapped in `<p>`).
   *                 Example: `'<p>Customer called, wants a <b>callback</b>.</p>'`
   *                 Example: `'Spoke with warehouse — stock arrives Friday.'`
   * @param options - Optional: partnerIds to @mention, attachmentIds
   * @returns Created mail.message ID
   */
  async postInternalNote(
    model: string,
    resId: number,
    body: string,
    options?: PostMessageOptions
  ): Promise<number> {
    return _postInternalNote(this, model, resId, body, options);
  }

  /**
   * Post an open (public) message on a record's chatter.
   *
   * Open messages are visible to ALL followers — including portal users
   * and external partners. Email notifications ARE sent to followers.
   * Use for customer-facing communication and public status updates.
   *
   * @param model  - Odoo model (must inherit mail.thread)
   * @param resId  - Record ID to post on
   * @param body   - HTML string or plain text (auto-wrapped in `<p>`).
   *                 Example: `'<p>Your order has been shipped.</p>'`
   *                 Example: `'Payment received. Thank you!'`
   * @param options - Optional: partnerIds to @mention, attachmentIds
   * @returns Created mail.message ID
   */
  async postOpenMessage(
    model: string,
    resId: number,
    body: string,
    options?: PostMessageOptions
  ): Promise<number> {
    return _postOpenMessage(this, model, resId, body, options);
  }

  /**
   * Logout and close connection
   */
  logout(): void {
    this.transport.logout();
    this.authenticated = false;
  }
}
