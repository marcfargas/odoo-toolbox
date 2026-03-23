/**
 * `odoo url` command group — generate record URLs.
 *
 * Commands:
 *   url record <model> <id>   Generate backend URL [READ]
 *   url portal <model> <id>   Generate portal URL [READ]
 *
 * Both commands are READ — no mutations, no --confirm required.
 */

import { Command } from 'commander';
import debug from 'debug';
import { createAuthClient, type AuthFlags } from '../middleware/auth';
import { addAuthOptions, formatOption } from '../middleware/common-params';
import { resolveFormat } from '../output/formatter';
import { handleError, EXIT_CODES } from '../output/errors';
import { writeStdout } from '../output/stream-writer';
import { showHelpExtra } from '../help/extra-help';

const log = debug('odoo-cli:url');

export function buildUrlCommand(): Command {
  const url = new Command('url')
    .description('Generate Odoo record URLs for backend and portal')
    .addHelpText(
      'after',
      `
Safety: READ — no confirmation required.

Examples:
  odoo url record crm.lead 42
  odoo url portal sale.order 88

Compose with mail:
  URL=$(odoo url record project.task 17)
  odoo mail note project.task 17 "Deployed: $URL" --confirm
`
    );

  // --help-extra
  url.option('--help-extra', 'Show extended skill documentation for url');
  url.hook('preAction', async (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.helpExtra) {
      await showHelpExtra('url');
      process.exit(0);
    }
  });

  url.addCommand(buildRecordUrlCommand());
  url.addCommand(buildPortalUrlCommand());

  return url;
}

function buildRecordUrlCommand(): Command {
  const cmd = new Command('record')
    .description('Generate backend URL for a record [READ]')
    .argument('<model>', 'Odoo model name (e.g., crm.lead, sale.order)')
    .argument('<id>', 'Record ID')
    .addHelpText(
      'after',
      `
Uses /mail/view redirect — works across all Odoo versions.

Examples:
  odoo url record crm.lead 42
  odoo url record res.partner 7 --format json
`
    );

  addAuthOptions(cmd);
  cmd.addOption(formatOption());

  cmd.action(async (model: string, idStr: string) => {
    const opts = cmd.optsWithGlobals() as AuthFlags & { format?: string };
    const id = parseInt(idStr, 10);

    if (isNaN(id)) {
      process.stderr.write(`✗ Error: Invalid ID '${idStr}'\n`);
      process.exit(EXIT_CODES.USAGE_ERROR);
    }

    log('url record %s %d', model, id);

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      const url = await client.urls.getRecordUrl(model, id);
      const format = resolveFormat(opts.format);

      if (format === 'json' || format === 'ndjson') {
        await writeStdout(JSON.stringify({ url, model, id }) + '\n');
      } else {
        await writeStdout(url + '\n');
      }
    } catch (err) {
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return cmd;
}

function buildPortalUrlCommand(): Command {
  const cmd = new Command('portal')
    .description('Generate portal URL for a record [READ]')
    .argument('<model>', 'Odoo model with portal.mixin (e.g., sale.order)')
    .argument('<id>', 'Record ID')
    .addHelpText(
      'after',
      `
Generates customer-facing portal link with access token.
Common portal models: sale.order, account.move, project.task, purchase.order

Examples:
  odoo url portal sale.order 88
  odoo url portal account.move 42 --format json
`
    );

  addAuthOptions(cmd);
  cmd.addOption(formatOption());

  cmd.action(async (model: string, idStr: string) => {
    const opts = cmd.optsWithGlobals() as AuthFlags & { format?: string };
    const id = parseInt(idStr, 10);

    if (isNaN(id)) {
      process.stderr.write(`✗ Error: Invalid ID '${idStr}'\n`);
      process.exit(EXIT_CODES.USAGE_ERROR);
    }

    log('url portal %s %d', model, id);

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      const result = await client.urls.getPortalUrl(model, id);
      const format = resolveFormat(opts.format);

      if (format === 'json' || format === 'ndjson') {
        await writeStdout(JSON.stringify(result, null, format === 'json' ? 2 : 0) + '\n');
      } else {
        await writeStdout(result.url + '\n');
      }
    } catch (err) {
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return cmd;
}
