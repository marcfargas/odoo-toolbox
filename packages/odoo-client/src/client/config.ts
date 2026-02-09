/**
 * Configuration and factory helpers for OdooClient.
 *
 * Quick start:
 *   const client = await createClient();              // reads ODOO_* env vars
 *   const client = await createClient('ODOO_PROD');   // reads ODOO_PROD_* env vars
 */

import { OdooError } from '../types/errors';
import type { OdooClientConfig } from './odoo-client';
import { OdooClient } from './odoo-client';

/**
 * Create an OdooClientConfig from environment variables.
 *
 * Reads: {prefix}_URL, {prefix}_DB (or {prefix}_DATABASE),
 *        {prefix}_USER (or {prefix}_USERNAME), {prefix}_PASSWORD
 *
 * @param prefix - Environment variable prefix (default: 'ODOO')
 *
 * @example
 *   const config = configFromEnv();          // ODOO_URL, ODOO_DB, ...
 *   const config = configFromEnv('ODOO_PROD'); // ODOO_PROD_URL, ODOO_PROD_DB, ...
 */
export function configFromEnv(prefix: string = 'ODOO'): OdooClientConfig {
  const url = process.env[`${prefix}_URL`] || '';
  const database = process.env[`${prefix}_DB`] || process.env[`${prefix}_DATABASE`] || '';
  const username = process.env[`${prefix}_USER`] || process.env[`${prefix}_USERNAME`] || '';
  const password = process.env[`${prefix}_PASSWORD`] || '';

  const missing: string[] = [];
  if (!url) missing.push(`${prefix}_URL`);
  if (!database) missing.push(`${prefix}_DB`);
  if (!username) missing.push(`${prefix}_USER`);
  if (!password) missing.push(`${prefix}_PASSWORD`);

  if (missing.length > 0) {
    throw new OdooError(`Missing environment variables: ${missing.join(', ')}`);
  }

  return { url, database, username, password };
}

/**
 * Create an authenticated OdooClient from environment variables.
 *
 * This is the recommended one-liner for scripts and agents:
 *
 * ```typescript
 * import { createClient } from '@marcfargas/odoo-client';
 *
 * const client = await createClient();
 * await client.mail.postInternalNote('crm.lead', 42, '<p>Done.</p>');
 * ```
 *
 * Reads ODOO_URL, ODOO_DB, ODOO_USER, ODOO_PASSWORD from environment.
 * Use a prefix for multi-instance setups:
 *
 * ```typescript
 * const prod = await createClient('ODOO_PROD');   // ODOO_PROD_URL, ...
 * const staging = await createClient('ODOO_STG'); // ODOO_STG_URL, ...
 * ```
 *
 * @param prefix - Environment variable prefix (default: 'ODOO')
 * @returns Authenticated OdooClient, ready to use
 * @throws OdooError if env vars are missing
 * @throws OdooAuthError if credentials are invalid
 */
export async function createClient(prefix: string = 'ODOO'): Promise<OdooClient> {
  const client = new OdooClient(configFromEnv(prefix));
  await client.authenticate();
  return client;
}
