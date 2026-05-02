// Core client
export { OdooClient, type OdooClientConfig } from './odoo-client';
export { configFromEnv, createClient } from './config';

// Shared CRUD contract (for OdooClient + OAuthProxyClient)
export type { OdooCrudClient, SearchOptions, SearchReadOptions, CallOptions } from './types';
