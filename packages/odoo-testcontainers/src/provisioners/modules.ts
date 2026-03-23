/**
 * Provisioner: Odoo module installation.
 *
 * Delegates to ModuleManager (odoo-client service) with idempotent
 * search-before-install semantics.
 */

import debug from 'debug';
import type { ProvisionerClient } from './types';

const log = debug('odoo-test-harness:modules');

/**
 * Install a list of Odoo modules.
 *
 * Skips modules that are already installed (idempotent).
 *
 * @param client - Authenticated client (ProvisionerClient-compatible)
 * @param modules - Module technical names to install
 */
export async function provisionModules(
  client: ProvisionerClient,
  modules: string[]
): Promise<void> {
  if (modules.length === 0) {
    log('No modules requested — skipping');
    return;
  }

  log('Installing modules: %o', modules);

  for (const module of modules) {
    const already = await client.modules.isModuleInstalled(module);
    if (already) {
      log('%s already installed — skip', module);
    } else {
      log('Installing %s…', module);
      await client.modules.installModule(module);
      log('%s installed', module);
    }
  }
}
