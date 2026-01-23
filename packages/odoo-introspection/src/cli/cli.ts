/**
 * Introspection and code generation CLI entrypoint.
 * 
 * This file is used as the bin entry for the odoo-introspect command.
 */

import { runCli } from './index';

runCli(process.argv.slice(2)).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
