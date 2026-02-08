/**
 * Main Odoo client — RPC transport, CRUD, and safety guards.
 *
 * Domain-specific helpers (mail, accounting, etc.) are accessed via lazy
 * service accessors:
 *
 *   client.mail.postInternalNote(...)
 *   client.modules.isModuleInstalled(...)
 *
 * OdooClient itself is strictly RPC/CRUD/auth/safety. No business logic.
 *
 * ## Adding a new service accessor
 *
 * 1. Create `services/{module}/` directory
 * 2. Add a lazy getter here (3 lines: private field + getter)
 * 3. Export from `services/index.ts`
 * 4. Update skill docs to show `client.{module}.*` pattern
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
import { MailService } from '../services/mail/mail-service';
import { ModuleManager } from '../services/modules/module-manager';

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
 * Main client for interacting with Odoo.
 *
 * Core: authentication, CRUD operations, raw RPC calls, safety guards.
 * Services: accessed via lazy getters — `client.mail`, `client.modules`, etc.
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

  // ── Service accessors (lazy) ────────────────────────────────────────
  //
  // Each service is created on first access and reused thereafter.
  // Adding a service: private field + getter + import. That's it.

  private _mail?: MailService;

  /**
   * Mail / Chatter service — post messages and notes on records.
   *
   * ```typescript
   * await client.mail.postInternalNote('crm.lead', 42, '<p>Called customer.</p>');
   * await client.mail.postOpenMessage('res.partner', 7, '<p>Order shipped.</p>');
   * ```
   */
  get mail(): MailService {
    return (this._mail ??= new MailService(this));
  }

  private _modules?: ModuleManager;

  /**
   * Module management — install, uninstall, list, and check Odoo modules.
   *
   * ```typescript
   * if (await client.modules.isModuleInstalled('sale')) { ... }
   * await client.modules.installModule('project');
   * ```
   */
  get modules(): ModuleManager {
    return (this._modules ??= new ModuleManager(this));
  }

  // ── Auth ────────────────────────────────────────────────────────────

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

  // ── Safety ──────────────────────────────────────────────────────────

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

  // ── RPC ─────────────────────────────────────────────────────────────

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

  // ── CRUD ────────────────────────────────────────────────────────────

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

  /**
   * Logout and close connection
   */
  logout(): void {
    this.transport.logout();
    this.authenticated = false;
  }
}
