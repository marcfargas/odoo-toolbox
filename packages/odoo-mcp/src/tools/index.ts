import type { OdooClient } from '@marcfargas/odoo-client';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AuditWriter } from '../audit';
import type { McpCache } from '../cache';
import { type PolicyRule } from '../policy';
import { registerCrudTools } from './crud';
import { registerDiscoveryTools } from './discovery';
import { registerNavigationTools } from './navigation';

export interface McpToolContext {
  client: OdooClient;
  getPolicy: () => PolicyRule[];
  cache: McpCache;
  audit: AuditWriter;
  userLogin: string;
}

export function registerTools(server: McpServer, context: McpToolContext): void {
  registerCrudTools(server, context);
  registerDiscoveryTools(server, context);
  registerNavigationTools(server, context);
}
