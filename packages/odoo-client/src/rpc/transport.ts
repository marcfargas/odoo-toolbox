/**
 * JSON-RPC transport for Odoo
 *
 * Implements the JSON-RPC 2.0 protocol over HTTP for Odoo RPC calls
 * Handles authentication, request/response formatting, and error parsing
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
import { JsonRpcRequest, JsonRpcResponse, OdooSessionInfo } from './types';

// Re-export types for convenience
export { JsonRpcRequest, JsonRpcResponse, OdooSessionInfo };

const log = debug('odoo-client:rpc');

/**
 * JSON-RPC transport client for Odoo
 *
 * Manages HTTP communication with Odoo using JSON-RPC protocol
 */
export class JsonRpcTransport {
  private baseUrl: string;
  private db: string;
  private requestId = 0;
  private sessionInfo: OdooSessionInfo | null = null;
  private password: string = '';

  constructor(baseUrl: string, db: string) {
    // Normalize base URL - remove trailing slash
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.db = db;
  }

  /**
   * Get the RPC endpoint URL
   */
  private getRpcUrl(): string {
    return `${this.baseUrl}/jsonrpc`;
  }

  /**
   * Generate a unique request ID
   */
  private nextRequestId(): number {
    return ++this.requestId;
  }

  /**
   * Get current session info
   */
  getSession(): OdooSessionInfo | null {
    return this.sessionInfo;
  }

  /**
   * Authenticate with Odoo using JSON-RPC
   *
   * Calls the common.login RPC method via /jsonrpc endpoint
   * Stores session info (uid, db) for future requests
   *
   * @see https://www.odoo.com/documentation/17.0/developer/howtos/web_services.html#json-rpc-library
   */
  async authenticate(username: string, password: string): Promise<OdooSessionInfo> {
    log(`authenticate ${username}@${this.db}`);

    try {
      const startTime = Date.now();
      const uid = await this.callRpc<number>('call', {
        service: 'common',
        method: 'login',
        args: [this.db, username, password],
      });
      const duration = Date.now() - startTime;

      if (!uid || typeof uid !== 'number' || uid === 0) {
        throw new OdooAuthError('Authentication failed - invalid credentials');
      }

      // Store password for subsequent RPC calls
      this.password = password;

      this.sessionInfo = {
        uid,
        session_id: '',
        db: this.db,
      };

      log(`authenticated ${username}@${this.db} uid=${uid} (${duration}ms)`);
      return this.sessionInfo;
    } catch (error) {
      log(
        `auth failed ${username}@${this.db}: ${error instanceof Error ? error.message : String(error)}`
      );

      if (error instanceof OdooAuthError) {
        throw error;
      }
      throw new OdooAuthError(
        `Failed to authenticate: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Make an RPC call to Odoo
   *
   * Low-level method that sends JSON-RPC requests and parses responses
   */
  async callRpc<T = any>(method: string, params: Record<string, any>): Promise<T> {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id: this.nextRequestId(),
    };

    try {
      const response = await fetch(this.getRpcUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new OdooNetworkError(
          `HTTP ${response.status}: ${response.statusText}`,
          new Error(`HTTP Error ${response.status}`)
        );
      }

      const data: JsonRpcResponse<T> = (await response.json()) as JsonRpcResponse<T>;

      // Handle JSON-RPC error response
      if (data.error) {
        throw this.categorizeError(data.error);
      }

      if (data.result === undefined) {
        throw new OdooRpcError('Invalid RPC response: missing result field');
      }

      return data.result;
    } catch (error) {
      if (error instanceof OdooRpcError || error instanceof OdooNetworkError) {
        throw error;
      }
      throw new OdooNetworkError(
        `RPC call failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Categorize an Odoo RPC error into a specific error type.
   *
   * Checks exception_type first (more structured, Odoo 17+),
   * then falls back to data.name (Python exception class name).
   *
   * @see https://github.com/odoo/odoo/blob/17.0/odoo/exceptions.py
   */
  private categorizeError(error: {
    code?: number;
    message?: string;
    data?: Record<string, any>;
  }): OdooRpcError {
    const errorData = error.data;
    const exceptionType = errorData?.exception_type || '';
    const exceptionName = errorData?.name || '';
    const errorMessage = errorData?.message || error.message || 'Unknown RPC error';
    const opts = { code: String(error.code), data: errorData };

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

  /**
   * Call an Odoo model method via JSON-RPC
   *
   * Uses the object.execute_kw RPC method to call model methods with
   * both positional arguments and keyword arguments (kwargs).
   *
   * @param model - Model name (e.g., 'res.partner')
   * @param method - Method name (e.g., 'search', 'read', 'create')
   * @param args - Positional arguments
   * @param kwargs - Keyword arguments (includes context)
   * @returns Method result
   *
   * @see https://www.odoo.com/documentation/17.0/developer/reference/external_api.html#calling-methods
   */
  async call<T = any>(
    model: string,
    method: string,
    args: any[] = [],
    kwargs: Record<string, any> = {}
  ): Promise<T> {
    log(`→ ${model}.${method}()`);

    const startTime = Date.now();
    try {
      const result = await this.callRpc<T>('call', {
        service: 'object',
        method: 'execute_kw',
        args: [this.db, this.sessionInfo?.uid || 0, this.password, model, method, args, kwargs],
      });

      const duration = Date.now() - startTime;
      log(`← ${model}.${method}() [${duration}ms]`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      log(
        `✗ ${model}.${method}() [${duration}ms]: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Logout and clear session
   */
  logout(): void {
    this.sessionInfo = null;
    this.password = '';
  }
}
