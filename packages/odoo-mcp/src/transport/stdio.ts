import debug from 'debug';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const log = debug('odoo-mcp:transport:stdio');

export async function startStdioTransport(server: Server): Promise<StdioServerTransport> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('stdio transport connected');
  return transport;
}
