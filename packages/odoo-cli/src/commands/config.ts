/**
 * `odoo config` command group.
 *
 * Commands:
 *   config check  — verify connection and show current user
 *   config show   — show resolved config (password always redacted)
 *
 * Safety level: READ (no mutations)
 */

import { Command } from 'commander';
import debug from 'debug';
import { createAuthClient, type AuthFlags } from '../middleware/auth';
import { buildConfig } from '../middleware/auth';
import { addAuthOptions, formatOption } from '../middleware/common-params';
import { resolveFormat, renderKeyValue } from '../output/formatter';
import { handleError, printSuccess, printInfo, EXIT_CODES } from '../output/errors';
import { showHelpExtra } from '../help/extra-help';

const log = debug('odoo-cli:config');

export function buildConfigCommand(): Command {
  const config = new Command('config')
    .description('Manage Odoo connection configuration')
    .addHelpText(
      'after',
      `
Safety: READ — no confirmation required.

Examples:
  odoo config check
  odoo config show
  odoo config show --format json
`
    );

  // --help-extra
  config.option('--help-extra', 'Show extended skill documentation for config');
  config.hook('preAction', async (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.helpExtra) {
      await showHelpExtra('config');
      process.exit(0);
    }
  });

  config.addCommand(buildCheckCommand());
  config.addCommand(buildShowCommand());

  return config;
}

function buildCheckCommand(): Command {
  const check = new Command('check')
    .description('Verify connection and show current user [READ]')
    .addHelpText(
      'after',
      `
Examples:
  odoo config check
  odoo config check --url https://mycompany.odoo.com --db mycompany
`
    );

  addAuthOptions(check);

  check.action(async () => {
    const flags = check.optsWithGlobals() as AuthFlags;
    log('Running config check with flags: %O', { url: flags.url, db: flags.db, user: flags.user });

    let client;
    try {
      client = await createAuthClient(flags);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      // Get session info
      const session = client.getSession();
      if (!session) {
        process.stderr.write('✗ Error: Authentication succeeded but session is missing\n');
        process.exit(EXIT_CODES.AUTH_NETWORK_ERROR);
      }

      // Fetch user display name
      const users = await client
        .read<{ name: string; login: string }>('res.users', [session.uid], ['name', 'login'])
        .catch(() => []);
      const userName =
        users.length > 0 ? `${users[0].name} (${users[0].login})` : `uid=${session.uid}`;

      // Count installed modules
      const installedCount = await client.searchCount('ir.module.module', [
        ['state', '=', 'installed'],
      ]);

      const cfg = buildConfig(flags);

      printSuccess(`Connected to ${cfg.url} (db: ${cfg.database})`);
      printInfo(`User: ${userName} [id: ${session.uid}]`);
      printInfo(`Installed modules: ${installedCount}`);
    } catch (err) {
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return check;
}

function buildShowCommand(): Command {
  const show = new Command('show')
    .description('Show resolved configuration (password always redacted) [READ]')
    .addHelpText(
      'after',
      `
Examples:
  odoo config show
  odoo config show --format json
`
    );

  addAuthOptions(show);
  show.addOption(formatOption());

  show.action(async () => {
    const flags = show.optsWithGlobals() as AuthFlags & { format?: string };
    const format = resolveFormat(flags.format);

    // Build config WITHOUT authenticating (just resolve env + flags)
    const urlVal = flags.url || process.env['ODOO_URL'] || '(not set)';
    const dbVal = flags.db || process.env['ODOO_DB'] || process.env['ODOO_DATABASE'] || '(not set)';
    const userVal =
      flags.user || process.env['ODOO_USERNAME'] || process.env['ODOO_USER'] || '(not set)';
    const passwordSet = !!(flags.password || process.env['ODOO_PASSWORD']);

    const urlSource = flags.url ? '--url flag' : process.env['ODOO_URL'] ? 'ODOO_URL' : 'not set';
    const dbSource = flags.db
      ? '--db flag'
      : process.env['ODOO_DB']
        ? 'ODOO_DB'
        : process.env['ODOO_DATABASE']
          ? 'ODOO_DATABASE'
          : 'not set';
    const userSource = flags.user
      ? '--user flag'
      : process.env['ODOO_USERNAME']
        ? 'ODOO_USERNAME'
        : process.env['ODOO_USER']
          ? 'ODOO_USER'
          : 'not set';
    const passwordSource = flags.password
      ? '--password flag ⚠'
      : process.env['ODOO_PASSWORD']
        ? 'ODOO_PASSWORD'
        : 'not set';

    if (format === 'json' || format === 'ndjson') {
      // Clean JSON without source info
      await renderKeyValue(
        {
          url: urlVal,
          db: dbVal,
          username: userVal,
          password: passwordSet ? 'REDACTED' : '(not set)',
        },
        format
      );
    } else {
      // Table/CSV with source annotations
      const data: Record<string, string> = {
        URL: `${urlVal}  (from ${urlSource})`,
        Database: `${dbVal}  (from ${dbSource})`,
        Username: `${userVal}  (from ${userSource})`,
        Password: `${passwordSet ? '****' : '(not set)'}  (from ${passwordSource})`,
        Format: `${format}  (${process.stdout.isTTY ? 'TTY default' : 'pipe default'})`,
      };
      await renderKeyValue(data, format);
    }
  });

  return show;
}
