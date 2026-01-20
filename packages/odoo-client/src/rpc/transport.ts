/**
 * JSON-RPC transport for Odoo
 * 
 * Implements the JSON-RPC 2.0 protocol over HTTP for Odoo RPC calls
 * Handles authentication, request/response formatting, and error parsing
 */

import { OdooRpcError, OdooNetworkError, OdooAuthError } from '../types/errors';

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params: Record<string, any>;
  id: number | string;
}

export interface JsonRpcResponse<T = any> {
  jsonrpc: '2.0';
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: number | string;
}

export interface OdooSessionInfo {
  uid: number;
  session_id: string;
  db: string;
}

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
    try {
      const uid = await this.callRpc<number>('call', {
        service: 'common',
        method: 'login',
        args: [this.db, username, password],
      });

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

      return this.sessionInfo;
    } catch (error) {
      if (error instanceof OdooAuthError) {
        throw error;
      }
      throw new OdooAuthError(`Failed to authenticate: ${error instanceof Error ? error.message : String(error)}`);
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

      const data: JsonRpcResponse<T> = await response.json() as JsonRpcResponse<T>;

      // Handle JSON-RPC error response
      if (data.error) {
        const errorMessage = data.error.data?.message || data.error.message;
        throw new OdooRpcError(errorMessage, {
          code: String(data.error.code),
          data: data.error.data,
        });
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
   * Call an Odoo model method via JSON-RPC
   * 
   * Uses the object.execute RPC method to call model methods
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
    return this.callRpc<T>('call', {
      service: 'object',
      method: 'execute',
      args: [this.db, this.sessionInfo?.uid || 0, this.password, model, method, ...args],
      kwargs,
    });
  }

  /**
   * Logout and clear session
   */
  logout(): void {
    this.sessionInfo = null;
    this.password = '';
  }
}
