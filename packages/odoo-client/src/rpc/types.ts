/**
 * Type definitions for JSON-RPC protocol
 */

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
