#!/usr/bin/env node

import { startServer, getAutoAuthConfig } from '../server.js';

async function main() {
  const autoAuth = getAutoAuthConfig();

  if (autoAuth) {
    console.error(`[odoo-mcp] Found credentials for ${autoAuth.database}, will auto-authenticate`);
  }

  await startServer({ autoAuth });
}

main().catch((error) => {
  console.error('[odoo-mcp] Fatal error:', error);
  process.exit(1);
});
