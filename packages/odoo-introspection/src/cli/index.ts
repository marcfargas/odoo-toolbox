/**
 * CLI for odoo-introspection code generation.
 * 
 * Usage:
 *   odoo-introspect generate [options]
 * 
 * Options:
 *   --url <url>              Odoo instance URL (env: ODOO_URL)
 *   --db <database>          Database name (env: ODOO_DB)
 *   --user <login>           User login (env: ODOO_USER, default: admin)
 *   --password <password>    Password (env: ODOO_PASSWORD)
 *   --output <dir>           Output directory (default: ./src/models)
 *   --include-transient      Include transient/wizard models
 *   --modules <list>         Filter by modules (comma-separated)
 *   --bypass-cache           Force fresh introspection query
 *   --help                   Show this help message
 * 
 * Example:
 *   odoo-introspect generate \\
 *     --url http://localhost:8069 \\
 *     --db odoo_dev \\
 *     --password secret \\
 *     --output src/models \\
 *     --modules sale,project
 */

import * as path from 'path';
import { pathToFileURL } from 'url';
import { OdooClient } from '@odoo-toolbox/client';
import { CodeGenerator } from '../codegen/generator.js';

/**
 * Parsed command line arguments.
 */
interface CliArgs {
  url: string;
  db: string;
  user: string;
  password: string;
  output?: string;
  includeTransient?: boolean;
  modules?: string[];
  bypassCache?: boolean;
  help?: boolean;
}

/**
 * Parse command line arguments.
 * 
 * @param args - Process argv slice (usually process.argv.slice(2))
 * @returns Parsed arguments
 */
function parseArgs(args: string[]): CliArgs {
  const result: Partial<CliArgs> = {
    user: 'admin',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = args[i + 1];

    switch (arg) {
      case '--url':
        result.url = value;
        i++;
        break;
      case '--db':
        result.db = value;
        i++;
        break;
      case '--user':
        result.user = value;
        i++;
        break;
      case '--password':
        result.password = value;
        i++;
        break;
      case '--output':
        result.output = value;
        i++;
        break;
      case '--include-transient':
        result.includeTransient = true;
        break;
      case '--modules':
        result.modules = value.split(',').map(m => m.trim());
        i++;
        break;
      case '--bypass-cache':
        result.bypassCache = true;
        break;
      case '--help':
        result.help = true;
        break;
    }
  }

  // Load from environment if not provided
  if (!result.url) result.url = process.env.ODOO_URL;
  if (!result.db) result.db = process.env.ODOO_DB;
  if (!result.password) result.password = process.env.ODOO_PASSWORD;

  return result as CliArgs;
}

/**
 * Show CLI help message.
 */
function showHelp(): void {
  console.log(`
odoo-introspect generate - Generate TypeScript interfaces from Odoo models

Usage:
  odoo-introspect generate [options]

Options:
  --url <url>              Odoo instance URL (env: ODOO_URL)
  --db <database>          Database name (env: ODOO_DB)
  --user <login>           User login (env: ODOO_USER, default: admin)
  --password <password>    Password (env: ODOO_PASSWORD)
  --output <dir>           Output directory (default: ./src/models)
  --include-transient      Include transient/wizard models
  --modules <list>         Filter by modules (comma-separated)
  --bypass-cache           Force fresh introspection query
  --help                   Show this help message

Example:
  odoo-introspect generate \\
    --url http://localhost:8069 \\
    --db odoo_dev \\
    --password secret \\
    --output src/models \\
    --modules sale,project

Environment Variables:
  ODOO_URL       Odoo instance URL
  ODOO_DB        Database name
  ODOO_USER      User login (default: admin)
  ODOO_PASSWORD  User password
`);
}

/**
 * Validate required arguments.
 * 
 * @param args - Parsed arguments
 * @throws Error if required arguments are missing
 */
function validateArgs(args: CliArgs): void {
  const missing: string[] = [];

  if (!args.url) missing.push('--url or ODOO_URL');
  if (!args.db) missing.push('--db or ODOO_DB');
  if (!args.password) missing.push('--password or ODOO_PASSWORD');

  if (missing.length > 0) {
    console.error(`❌ Missing required arguments: ${missing.join(', ')}`);
    showHelp();
    process.exit(1);
  }
}

/**
 * Run the CLI command.
 * 
 * @param args - Process argv slice
 */
export async function runCli(args: string[]): Promise<void> {
  const parsed = parseArgs(args);

  if (parsed.help) {
    showHelp();
    return;
  }

  validateArgs(parsed);

  try {
    console.log('🔌 Connecting to Odoo...');
    const client = new OdooClient({
      url: parsed.url!,
      database: parsed.db!,
      username: parsed.user,
      password: parsed.password!,
    });

    await client.authenticate();
    console.log('✅ Connected to Odoo');

    const generator = new CodeGenerator(client);

    console.log('📝 Generating TypeScript interfaces...');
    
    // Import Node.js file system adapter
    const { createNodeFsAdapter } = await import('../codegen/fs-adapters.js');
    const fs = await createNodeFsAdapter();
    
    // Create console logger
    const logger = { log: (msg: string) => console.log(msg) };
    
    const outputPath = parsed.output || path.join(process.cwd(), 'src', 'models', 'generated.ts');
    
    const code = await generator.generate({
      outputPath,
      fs,
      logger,
      includeTransient: parsed.includeTransient,
      modules: parsed.modules,
      bypassCache: parsed.bypassCache,
    });

    console.log(`✅ Generated ${code.split('\n').length} lines of TypeScript code`);
    console.log(`📦 Output: ${outputPath}`);

  } catch (error) {
    console.error('❌ Generation failed:', error);
    process.exit(1);
  }
}

// Run immediately if this is the main entry point
// ESM pattern: check if this module is the entry point
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli(process.argv.slice(2));
}
