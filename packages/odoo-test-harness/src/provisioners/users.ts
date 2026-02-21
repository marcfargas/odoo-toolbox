/**
 * Provisioner: Test users.
 *
 * Creates res.users records and assigns groups by XML ID.
 * Groups are resolved via ir.model.data using searchRead().
 *
 * Users are created with a standard test password — never use
 * test users from this harness in production environments.
 *
 * @see https://github.com/odoo/odoo/blob/17.0/odoo/addons/base/models/res_users.py
 */

import debug from 'debug';
import type { UserConfig, ProvisionerClient } from '../types';

const log = debug('odoo-test-harness:users');

/** Default password for all test users created by the harness. */
const TEST_USER_PASSWORD = 'test_password_harness';

/**
 * Resolve an XML ID (e.g. 'project.group_project_manager') to a res.groups ID.
 *
 * @throws Error if the XML ID is not found in the database.
 */
async function resolveGroupId(client: ProvisionerClient, xmlId: string): Promise<number> {
  const [module, name] = xmlId.split('.');
  if (!module || !name) {
    throw new Error(`Invalid group XML ID: "${xmlId}". Expected format: "module.xml_id"`);
  }

  const results = await client.searchRead<{ res_id: number }>(
    'ir.model.data',
    [
      ['module', '=', module],
      ['name', '=', name],
      ['model', '=', 'res.groups'],
    ],
    { fields: ['res_id'], limit: 1 }
  );

  if (results.length === 0) {
    throw new Error(`Group XML ID not found: "${xmlId}"`);
  }

  return results[0].res_id;
}

/**
 * Create test users and assign group memberships.
 *
 * @param client - Authenticated client (ProvisionerClient-compatible)
 * @param users - User configurations
 * @returns Map of user name → res.users ID
 */
export async function provisionUsers(
  client: ProvisionerClient,
  users: UserConfig[]
): Promise<Record<string, number>> {
  const refs: Record<string, number> = {};

  if (users.length === 0) {
    log('No users requested — skipping');
    return refs;
  }

  log('Provisioning %d user(s)', users.length);

  for (const config of users) {
    const values: Record<string, any> = {
      name: config.name,
      login: config.login,
      password: TEST_USER_PASSWORD,
    };

    // Resolve group XML IDs to IDs and link them
    if (config.groups && config.groups.length > 0) {
      const groupIds: number[] = [];
      for (const xmlId of config.groups) {
        const groupId = await resolveGroupId(client, xmlId);
        log('  Resolved group %s → id=%d', xmlId, groupId);
        groupIds.push(groupId);
      }
      // Many2many: [[4, id], ...] links without replacing defaults
      values.groups_id = groupIds.map((id) => [4, id]);
    }

    const id = await client.create('res.users', values);
    log('Created user "%s" (login=%s) → id=%d', config.name, config.login, id);
    refs[config.name] = id;
  }

  return refs;
}
