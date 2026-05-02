// RPC transport layer
export {
  JsonRpcTransport,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type OdooSessionInfo,
} from './transport';

// Bearer-token transport for the OAuth-fronted proxy.
export { BearerJsonRpcTransport, type BearerJsonRpcTransportConfig } from './bearer-transport';
