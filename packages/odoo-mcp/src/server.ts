import type { OdooClient } from '@marcfargas/odoo-client';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AuditWriter } from './audit';
import { McpCache } from './cache';
import { type PolicyRule } from './policy';
import { registerResources } from './resources';
import { registerTools } from './tools';

export interface McpOdooServerOptions {
  version: string;
  client: OdooClient;
  getPolicy: () => PolicyRule[];
  cache: McpCache;
  audit: AuditWriter;
  /** Odoo login from X-Odoo-User header; used in audit entries. */
  userLogin: string;
}

export class McpOdooServer {
  readonly server: Server;
  private readonly mcpServer: McpServer;

  constructor(private readonly options: McpOdooServerOptions) {
    this.mcpServer = new McpServer({
      name: 'odoo-mcp-server',
      version: options.version,
    });

    this.server = this.mcpServer.server;

    const toolCtx = {
      client: this.options.client,
      getPolicy: this.options.getPolicy,
      cache: this.options.cache,
      audit: this.options.audit,
      userLogin: this.options.userLogin,
    };

    registerTools(this.mcpServer, toolCtx);

    registerResources(this.mcpServer, {
      client: this.options.client,
      cache: this.options.cache,
      getPolicy: this.options.getPolicy,
    });
  }

  async close(): Promise<void> {
    await this.mcpServer.close();
  }
}
