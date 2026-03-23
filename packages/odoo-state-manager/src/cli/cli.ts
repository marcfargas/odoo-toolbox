import { resolve as resolvePath } from 'path';
import { Command } from 'commander';
import { createClient } from '@marcfargas/odoo-client';
import { plan, apply, diff, formatPlan } from '../engine';
import { initProject } from './init';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveDir(dir: string): string {
  return resolvePath(process.cwd(), dir);
}

// ---------------------------------------------------------------------------
// CLI definition
// ---------------------------------------------------------------------------

const program = new Command();

program
  .name('odoo-state-manager')
  .description('Declarative state management for Odoo')
  .version('0.2.0');

// ---------------------------------------------------------------------------
// plan
// ---------------------------------------------------------------------------

program
  .command('plan')
  .description('Preview pending changes without applying them')
  .option('--dir <dir>', 'project directory', '.')
  .action(async (opts: { dir: string }) => {
    const dir = resolveDir(opts.dir);

    let client;
    try {
      client = await createClient();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${msg}`);
      process.exit(1);
    }

    let result;
    try {
      result = await plan({ dir, client });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${msg}`);
      process.exit(1);
    }

    console.log(formatPlan(result));

    // Exit 0 = no changes, exit 2 = changes pending
    process.exit(result.summary.isEmpty ? 0 : 2);
  });

// ---------------------------------------------------------------------------
// diff
// ---------------------------------------------------------------------------

program
  .command('diff')
  .description('Detect drift between desired state and Odoo (alias for plan)')
  .option('--dir <dir>', 'project directory', '.')
  .action(async (opts: { dir: string }) => {
    const dir = resolveDir(opts.dir);

    let client;
    try {
      client = await createClient();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${msg}`);
      process.exit(1);
    }

    let result;
    try {
      result = await diff({ dir, client });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${msg}`);
      process.exit(1);
    }

    console.log(formatPlan(result));

    // Exit 0 = clean, exit 2 = drift detected
    process.exit(result.summary.isEmpty ? 0 : 2);
  });

// ---------------------------------------------------------------------------
// apply
// ---------------------------------------------------------------------------

program
  .command('apply')
  .description('Apply pending changes to Odoo')
  .option('--dir <dir>', 'project directory', '.')
  .option('--auto-approve', 'skip confirmation prompt', false)
  .action(async (opts: { dir: string; autoApprove: boolean }) => {
    const dir = resolveDir(opts.dir);

    let client;
    try {
      client = await createClient();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${msg}`);
      process.exit(1);
    }

    // Preview first
    let executionPlan;
    try {
      executionPlan = await plan({ dir, client });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${msg}`);
      process.exit(1);
    }

    console.log(formatPlan(executionPlan));

    if (executionPlan.summary.isEmpty) {
      process.exit(0);
    }

    // Confirmation prompt (unless --auto-approve)
    if (!opts.autoApprove) {
      const { createInterface } = await import('node:readline');
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise<string>((r) =>
        rl.question('Apply these changes? [y/N] ', r)
      );
      rl.close();
      if (answer.toLowerCase() !== 'y') {
        console.log('Aborted.');
        process.exit(0);
      }
    }

    // Apply
    let result;
    try {
      result = await apply({
        dir,
        client,
        stopOnError: true,
        onProgress: (current, total, op) => {
          process.stdout.write(
            `  [${current}/${total}] ${op.type} ${op.model}${op.description ? ` "${op.description}"` : ''}\n`
          );
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${msg}`);
      process.exit(1);
    }

    if (result.failed > 0) {
      console.error(
        `\nApply completed with errors: ${result.succeeded} succeeded, ${result.failed} failed.`
      );
      for (const r of result.results) {
        if (r.status === 'error') {
          console.error(`  error: ${r.operation.type} ${r.operation.model} — ${r.error}`);
        }
      }
      process.exit(1);
    }

    console.log(`\nApply complete: ${result.succeeded} operation(s) succeeded.`);
    process.exit(0);
  });

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------

program
  .command('init [dir]')
  .description('Scaffold a new odoo-state-manager project')
  .action(async (dir: string = '.') => {
    const resolvedDir = resolveDir(dir);
    console.log(`Initializing project in ${resolvedDir}`);

    try {
      await initProject(resolvedDir);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${msg}`);
      process.exit(1);
    }

    console.log('\nDone. Set ODOO_URL, ODOO_DB, ODOO_USER, ODOO_PASSWORD then run:');
    console.log('  odoo-state-manager plan');
    process.exit(0);
  });

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

program.parse(process.argv);
