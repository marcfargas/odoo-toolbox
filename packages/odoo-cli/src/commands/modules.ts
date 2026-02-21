/**
 * `odoo modules` command group.
 *
 * Commands:
 *   modules list               List modules [READ]
 *   modules install <name>     Install a module [WRITE]
 *   modules uninstall <name>   Uninstall a module [DESTRUCTIVE]
 *   modules upgrade <name>     Upgrade a module [WRITE]
 *   modules info <name>        Show module metadata [READ]
 *   modules status <name>      Print single-word state [READ]
 */

import { Command } from 'commander';
import debug from 'debug';
import { createAuthClient, type AuthFlags } from '../middleware/auth';
import { requireConfirm, printDryRun } from '../middleware/safety';
import {
  addAuthOptions,
  addOutputOptions,
  confirmOption,
  dryRunOption,
} from '../middleware/common-params';
import { resolveFormat, render, renderKeyValue } from '../output/formatter';
import { handleError, printSuccess, EXIT_CODES } from '../output/errors';
import { writeStdout } from '../output/stream-writer';
import { showHelpExtra } from '../help/extra-help';
import type { ModuleInfo } from '@marcfargas/odoo-client';

const log = debug('odoo-cli:modules');

export function buildModulesCommand(): Command {
  const modules = new Command('modules')
    .description('Manage Odoo modules — install, upgrade, and list')
    .addHelpText(
      'after',
      `
Safety:
  READ        list, info, status  — no confirmation required
  WRITE       install, upgrade    — requires --confirm
  DESTRUCTIVE uninstall           — requires --confirm ⚠

Examples:
  odoo modules list --filter installed
  odoo modules install hr_timesheet --confirm
  odoo modules upgrade sale_management --confirm
  odoo modules status sale_management
  odoo modules info sale_management
`
    );

  // --help-extra
  modules.option('--help-extra', 'Show extended skill documentation for modules');
  modules.hook('preAction', async (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.helpExtra) {
      await showHelpExtra('modules');
      process.exit(0);
    }
  });

  modules.addCommand(buildListCommand());
  modules.addCommand(buildInstallCommand());
  modules.addCommand(buildUninstallCommand());
  modules.addCommand(buildUpgradeCommand());
  modules.addCommand(buildInfoCommand());
  modules.addCommand(buildStatusCommand());

  return modules;
}

function buildListCommand(): Command {
  const list = new Command('list')
    .description('List modules with optional state filter [READ]')
    .addHelpText(
      'after',
      `
Examples:
  odoo modules list --filter installed
  odoo modules list --filter upgradeable --format json | jq '.[].name'
  odoo modules list --search sale --format table
`
    );

  addAuthOptions(list);
  addOutputOptions(list);
  list.option(
    '--filter <state>',
    'Filter by state: installed | uninstalled | upgradeable | all',
    'all'
  );
  list.option('--search <text>', 'Substring filter on name/technical name');

  list.action(async () => {
    const opts = list.optsWithGlobals() as AuthFlags & {
      filter?: string;
      search?: string;
      format?: string;
      fields?: string;
    };

    log('modules list filter=%s search=%s', opts.filter, opts.search);

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      const stateFilter =
        opts.filter === 'all' || !opts.filter ? undefined : (opts.filter as ModuleInfo['state']);
      const modules = await client.modules.listModules({ state: stateFilter });

      let filtered = modules;
      if (opts.search) {
        const q = opts.search.toLowerCase();
        filtered = modules.filter(
          (m) => m.name.toLowerCase().includes(q) || (m.shortdesc ?? '').toLowerCase().includes(q)
        );
      }

      const records = filtered.map((m) => ({
        name: m.shortdesc ?? m.name,
        technical_name: m.name,
        version: m.installed_version ?? m.latest_version ?? '',
        state: m.state,
      }));

      const format = resolveFormat(opts.format);
      await render(records, format);
    } catch (err) {
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return list;
}

function buildInstallCommand(): Command {
  const install = new Command('install')
    .description('Install a module [WRITE — requires --confirm]')
    .argument('<name>', 'Technical module name (e.g., hr_timesheet)')
    .addHelpText(
      'after',
      `
One module per invocation. Odoo resolves dependencies automatically.

Examples:
  odoo modules install hr_timesheet --confirm
`
    );

  addAuthOptions(install);
  install.addOption(confirmOption());
  install.addOption(dryRunOption());
  install.option('--no-deps', 'Skip dependency resolution (⚠ rarely what you want)');

  install.action(async (name: string) => {
    const opts = install.optsWithGlobals() as AuthFlags & {
      confirm?: boolean;
      dryRun?: boolean;
    };

    log('modules install %s', name);

    try {
      requireConfirm('WRITE', opts, `modules install ${name}`);
    } catch (err) {
      process.exit(handleError(err));
    }

    if (opts.dryRun) {
      printDryRun('ir.module.module', 'button_immediate_install', [[`<id of ${name}>`]]);
      return;
    }

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      process.stderr.write(`Installing ${name}...\n`);
      const start = Date.now();
      const info = await client.modules.installModule(name);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      printSuccess(`${name} installed (state: ${info.state}, ${elapsed}s)`);
    } catch (err) {
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return install;
}

function buildUninstallCommand(): Command {
  const uninstall = new Command('uninstall')
    .description('Uninstall a module — MAY REMOVE DATA [DESTRUCTIVE — requires --confirm]')
    .argument('<name>', 'Technical module name')
    .addHelpText(
      'after',
      `
⚠ Uninstalling a module may remove associated data from the database.

Examples:
  odoo modules uninstall hr_timesheet --confirm
`
    );

  addAuthOptions(uninstall);
  uninstall.addOption(confirmOption());
  uninstall.addOption(dryRunOption());

  uninstall.action(async (name: string) => {
    const opts = uninstall.optsWithGlobals() as AuthFlags & {
      confirm?: boolean;
      dryRun?: boolean;
    };

    log('modules uninstall %s', name);

    try {
      requireConfirm('DESTRUCTIVE', opts, `modules uninstall ${name}`);
    } catch (err) {
      process.exit(handleError(err));
    }

    if (opts.dryRun) {
      printDryRun('ir.module.module', 'button_immediate_uninstall', [[`<id of ${name}>`]]);
      return;
    }

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      process.stderr.write(`Uninstalling ${name}...\n`);
      const start = Date.now();
      const info = await client.modules.uninstallModule(name);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      printSuccess(`${name} uninstalled (state: ${info.state}, ${elapsed}s)`);
    } catch (err) {
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return uninstall;
}

function buildUpgradeCommand(): Command {
  const upgrade = new Command('upgrade')
    .description('Upgrade a module to its latest version [WRITE — requires --confirm]')
    .argument('<name>', 'Technical module name')
    .addHelpText(
      'after',
      `
Examples:
  odoo modules upgrade sale_management --confirm
`
    );

  addAuthOptions(upgrade);
  upgrade.addOption(confirmOption());
  upgrade.addOption(dryRunOption());

  upgrade.action(async (name: string) => {
    const opts = upgrade.optsWithGlobals() as AuthFlags & {
      confirm?: boolean;
      dryRun?: boolean;
    };

    log('modules upgrade %s', name);

    try {
      requireConfirm('WRITE', opts, `modules upgrade ${name}`);
    } catch (err) {
      process.exit(handleError(err));
    }

    if (opts.dryRun) {
      printDryRun('ir.module.module', 'button_immediate_upgrade', [[`<id of ${name}>`]]);
      return;
    }

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      process.stderr.write(`Upgrading ${name}...\n`);
      const start = Date.now();
      const info = await client.modules.upgradeModule(name);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      printSuccess(`${name} upgraded (state: ${info.state}, ${elapsed}s)`);
    } catch (err) {
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return upgrade;
}

function buildInfoCommand(): Command {
  const info = new Command('info')
    .description('Show module metadata [READ]')
    .argument('<name>', 'Technical module name')
    .addHelpText(
      'after',
      `
Examples:
  odoo modules info sale_management
  odoo modules info sale_management --format json
`
    );

  addAuthOptions(info);
  addOutputOptions(info);

  info.action(async (name: string) => {
    const opts = info.optsWithGlobals() as AuthFlags & { format?: string };

    log('modules info %s', name);

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      const m = await client.modules.getModuleInfo(name);
      const format = resolveFormat(opts.format);

      const data: Record<string, string> = {
        Name: m.shortdesc ?? m.name,
        'Technical name': m.name,
        Version: m.installed_version ?? m.latest_version ?? '',
        State: m.state,
        Summary: m.summary ?? '',
        Author: m.author ?? '',
        License: m.license ?? '',
        Website: m.website ?? '',
      };

      if (format === 'json' || format === 'ndjson') {
        await writeStdout(JSON.stringify(m, null, format === 'json' ? 2 : 0) + '\n');
      } else {
        await renderKeyValue(data, format);
      }
    } catch (err) {
      // Module not found → exit 3
      if (err instanceof Error && err.message.includes('not found')) {
        process.stderr.write(`✗ Error: Module '${name}' not found\n`);
        process.exit(EXIT_CODES.NOT_FOUND);
      }
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return info;
}

function buildStatusCommand(): Command {
  const status = new Command('status')
    .description('Print single-word module state (for scripting) [READ]')
    .argument('<name>', 'Technical module name')
    .addHelpText(
      'after',
      `
Outputs one word: installed | uninstalled | upgradeable | to_install | etc.
Exit code 3 if module not found.

Examples:
  odoo modules status sale_management
  if [ "$(odoo modules status my_addon)" = "installed" ]; then echo ready; fi
`
    );

  addAuthOptions(status);

  status.action(async (name: string) => {
    const opts = status.optsWithGlobals() as AuthFlags;

    log('modules status %s', name);

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      const m = await client.modules.getModuleInfo(name);
      await writeStdout(m.state + '\n');
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) {
        process.stderr.write(`Module '${name}' not found\n`);
        process.exit(EXIT_CODES.NOT_FOUND);
      }
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return status;
}
