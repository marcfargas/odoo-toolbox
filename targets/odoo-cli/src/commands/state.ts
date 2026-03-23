/**
 * `odoo state` command group — experimental state management.
 *
 * ALL state commands require --experimental flag (like `kubectl alpha`).
 * This prevents accidental use in production scripts.
 *
 * Commands:
 *   state plan <file>     Show drift between desired and current [READ]
 *   state apply <file>    Apply desired state to Odoo [WRITE]
 *   state diff <model>    Show current state of a model's records [READ]
 */

import { Command } from 'commander';
import debug from 'debug';
import { createAuthClient, type AuthFlags } from '../middleware/auth';
import { requireConfirm } from '../middleware/safety';
import {
  addAuthOptions,
  addOutputOptions,
  confirmOption,
  dryRunOption,
  experimentalOption,
} from '../middleware/common-params';
import { resolveFormat, render } from '../output/formatter';
import { handleError, printSuccess, EXIT_CODES, CliUsageError } from '../output/errors';
import { writeStdout } from '../output/stream-writer';
import { readFileSync } from 'fs';

const log = debug('odoo-cli:state');

/**
 * Enforce that --experimental is present.
 * All state commands are gated behind this flag.
 */
function requireExperimental(opts: { experimental?: boolean }): void {
  if (!opts.experimental) {
    throw new CliUsageError('state commands are experimental and require --experimental', [
      'Add --experimental to proceed',
      'Example: odoo state plan ./config.json --experimental',
      '⚠ Experimental commands may change behavior in future releases',
    ]);
  }
}

export function buildStateCommand(): Command {
  const state = new Command('state')
    .description(
      '⚠ EXPERIMENTAL — State management for Odoo configuration (requires --experimental)'
    )
    .addHelpText(
      'after',
      `
⚠ EXPERIMENTAL: All state commands require --experimental flag.

Similar to Terraform: declare desired state, plan changes, apply.

Safety:
  READ   plan, diff  — no mutations (but requires --experimental)
  WRITE  apply       — requires --confirm AND --experimental

Examples:
  odoo state plan ./crm-stages.json --experimental
  odoo state apply ./crm-stages.json --experimental --confirm
  odoo state diff crm.stage --experimental
`
    );

  // --experimental required on all state commands
  state.addOption(experimentalOption());

  state.hook('preAction', async (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.experimental === false || opts.experimental === undefined) {
      // Allow --help without --experimental
    }
  });

  state.addCommand(buildPlanCommand());
  state.addCommand(buildApplyCommand());
  state.addCommand(buildDiffCommand());

  return state;
}

function buildPlanCommand(): Command {
  const cmd = new Command('plan')
    .description(
      'Show drift between desired state (file) and current Odoo state [READ + --experimental]'
    )
    .argument('<file>', 'State file (JSON)')
    .addHelpText(
      'after',
      `
Example state file (crm-stages.json):
{
  "model": "crm.stage",
  "match_field": "name",
  "records": [
    { "name": "New", "sequence": 1 },
    { "name": "Qualified", "sequence": 20 }
  ]
}

Examples:
  odoo state plan ./crm-stages.json --experimental
`
    );

  addAuthOptions(cmd);
  addOutputOptions(cmd);
  cmd.addOption(experimentalOption());

  cmd.action(async (file: string) => {
    const opts = cmd.optsWithGlobals() as AuthFlags & {
      experimental?: boolean;
      format?: string;
    };

    try {
      requireExperimental(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    log('state plan %s', file);

    let stateSpec: any;
    try {
      const content = readFileSync(file, 'utf8');
      stateSpec = JSON.parse(content);
    } catch (err) {
      process.stderr.write(
        `✗ Error: Cannot read state file '${file}': ${err instanceof Error ? err.message : String(err)}\n`
      );
      process.exit(EXIT_CODES.USAGE_ERROR);
      return;
    }

    if (!stateSpec.model || !stateSpec.records) {
      process.stderr.write('✗ Error: State file must have "model" and "records" fields\n');
      process.exit(EXIT_CODES.USAGE_ERROR);
      return;
    }

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      const { model, match_field = 'name', records: desired } = stateSpec;
      const format = resolveFormat(opts.format);

      // Fetch current state
      const fields = [...new Set(['id', match_field, ...Object.keys(desired[0] ?? {})])];
      const current = await client.searchRead(model, [], { fields });

      const currentByKey = new Map<string, any>();
      for (const rec of current) {
        currentByKey.set(String(rec[match_field]), rec);
      }

      const desiredKeys = new Set<string>();
      const plan: Array<{ action: string; key: string; changes: Record<string, any> }> = [];

      for (const desiredRec of desired) {
        const key = String(desiredRec[match_field]);
        desiredKeys.add(key);
        const existing = currentByKey.get(key);

        if (!existing) {
          plan.push({ action: 'create', key, changes: desiredRec });
        } else {
          const diff: Record<string, any> = {};
          for (const [k, v] of Object.entries(desiredRec)) {
            if (k === match_field) continue;
            if (JSON.stringify(existing[k]) !== JSON.stringify(v)) {
              diff[k] = { from: existing[k], to: v };
            }
          }
          if (Object.keys(diff).length > 0) {
            plan.push({ action: 'change', key, changes: diff });
          }
        }
      }

      // Deletions (present in Odoo but not in desired state)
      // Only if stateSpec.prune = true
      if (stateSpec.prune) {
        for (const rec of current) {
          const key = String(rec[match_field]);
          if (!desiredKeys.has(key)) {
            plan.push({ action: 'destroy', key, changes: { id: rec.id } });
          }
        }
      }

      if (format === 'json' || format === 'ndjson') {
        await writeStdout(JSON.stringify(plan, null, format === 'json' ? 2 : 0) + '\n');
      } else {
        if (plan.length === 0) {
          process.stdout.write('No changes. State is up-to-date.\n');
        } else {
          for (const entry of plan) {
            const symbol = entry.action === 'create' ? '+' : entry.action === 'destroy' ? '-' : '~';
            process.stdout.write(`  ${symbol} ${model} "${entry.key}"\n`);
            for (const [k, v] of Object.entries(entry.changes)) {
              if (entry.action === 'change' && typeof v === 'object' && v !== null && 'from' in v) {
                process.stdout.write(
                  `      ${k}: ${JSON.stringify(v.from)} → ${JSON.stringify(v.to)}\n`
                );
              } else {
                process.stdout.write(`      ${k}: ${JSON.stringify(v)}\n`);
              }
            }
          }

          const creates = plan.filter((p) => p.action === 'create').length;
          const changes = plan.filter((p) => p.action === 'change').length;
          const destroys = plan.filter((p) => p.action === 'destroy').length;
          process.stdout.write(
            `\nPlan: ${creates} to add, ${changes} to change, ${destroys} to destroy.\n`
          );
          process.stdout.write(
            `Run 'odoo state apply ${file} --experimental --confirm' to execute.\n`
          );
        }
      }
    } catch (err) {
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return cmd;
}

function buildApplyCommand(): Command {
  const cmd = new Command('apply')
    .description('Apply desired state to Odoo [WRITE + --experimental + --confirm]')
    .argument('<file>', 'State file (JSON)')
    .addHelpText(
      'after',
      `
Applies changes shown by 'odoo state plan'. Use --dry-run to preview.

Examples:
  odoo state apply ./crm-stages.json --experimental --confirm
  odoo state apply ./crm-stages.json --experimental --confirm --auto-approve
`
    );

  addAuthOptions(cmd);
  cmd.addOption(confirmOption());
  cmd.addOption(dryRunOption());
  cmd.addOption(experimentalOption());
  cmd.option('--auto-approve', 'Skip confirmation prompt — treat as --confirm (CI-safe)');

  cmd.action(async (file: string) => {
    const opts = cmd.optsWithGlobals() as AuthFlags & {
      confirm?: boolean;
      dryRun?: boolean;
      experimental?: boolean;
      autoApprove?: boolean;
    };

    // --auto-approve is an alias for --confirm (for scripting/CI use)
    if (opts.autoApprove) {
      opts.confirm = true;
    }

    try {
      requireExperimental(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      requireConfirm('WRITE', opts, 'state apply');
    } catch (err) {
      process.exit(handleError(err));
    }

    log('state apply %s dryRun=%s', file, opts.dryRun);

    let stateSpec: any;
    try {
      const content = readFileSync(file, 'utf8');
      stateSpec = JSON.parse(content);
    } catch (err) {
      process.stderr.write(
        `✗ Error: Cannot read state file '${file}': ${err instanceof Error ? err.message : String(err)}\n`
      );
      process.exit(EXIT_CODES.USAGE_ERROR);
      return;
    }

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      const { model, match_field = 'name', records: desired, prune = false } = stateSpec;
      const fields = [...new Set(['id', match_field, ...Object.keys(desired[0] ?? {})])];
      const current = await client.searchRead(model, [], { fields });

      const currentByKey = new Map<string, any>();
      for (const rec of current) {
        currentByKey.set(String(rec[match_field]), rec);
      }

      const desiredKeys = new Set<string>();
      let created = 0;
      let updated = 0;

      for (const desiredRec of desired) {
        const key = String(desiredRec[match_field]);
        desiredKeys.add(key);
        const existing = currentByKey.get(key);

        if (!existing) {
          if (opts.dryRun) {
            process.stderr.write(`  + [DRY RUN] Would create ${model} "${key}"\n`);
          } else {
            await client.create(model, desiredRec);
            process.stderr.write(`  + Created ${model} "${key}"\n`);
          }
          created++;
        } else {
          // Compute diff
          const diff: Record<string, any> = {};
          for (const [k, v] of Object.entries(desiredRec)) {
            if (k === match_field) continue;
            if (JSON.stringify(existing[k]) !== JSON.stringify(v)) {
              diff[k] = v;
            }
          }
          if (Object.keys(diff).length > 0) {
            if (opts.dryRun) {
              process.stderr.write(`  ~ [DRY RUN] Would update ${model} "${key}"\n`);
            } else {
              await client.write(model, [existing.id], diff);
              process.stderr.write(`  ~ Updated ${model} "${key}"\n`);
            }
            updated++;
          }
        }
      }

      // TODO: prune=true destroys records not in spec — requires --confirm
      let destroyed = 0;
      if (prune) {
        for (const rec of current) {
          const key = String(rec[match_field]);
          if (!desiredKeys.has(key)) {
            if (opts.dryRun) {
              process.stderr.write(
                `  - [DRY RUN] Would destroy ${model} "${key}" (id=${rec.id})\n`
              );
            } else {
              await client.unlink(model, [rec.id]);
              process.stderr.write(`  - Destroyed ${model} "${key}" (id=${rec.id})\n`);
            }
            destroyed++;
          }
        }
      }

      const dryLabel = opts.dryRun ? ' (dry run)' : '';
      printSuccess(
        `Applied${dryLabel}: ${created} created, ${updated} updated, ${destroyed} destroyed`
      );
    } catch (err) {
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return cmd;
}

function buildDiffCommand(): Command {
  const cmd = new Command('diff')
    .description("Show current state of a model's records [READ + --experimental]")
    .argument('<model>', 'Odoo model name')
    .addHelpText(
      'after',
      `
Examples:
  odoo state diff crm.stage --experimental
  odoo state diff crm.stage --experimental --format json > current-stages.json
`
    );

  addAuthOptions(cmd);
  addOutputOptions(cmd);
  cmd.addOption(experimentalOption());

  cmd.action(async (model: string) => {
    const opts = cmd.optsWithGlobals() as AuthFlags & {
      experimental?: boolean;
      format?: string;
    };

    try {
      requireExperimental(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    log('state diff %s', model);

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      const records = await client.searchRead(model, []);
      const format = resolveFormat(opts.format);
      await render(records, format);
    } catch (err) {
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return cmd;
}
