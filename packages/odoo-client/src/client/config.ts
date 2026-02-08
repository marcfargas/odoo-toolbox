/**
 * Configuration helpers for OdooClient
 */

import { OdooError } from '../types/errors';
import type { OdooClientConfig } from './odoo-client';

/**
 * Create an OdooClientConfig from environment variables with a given prefix.
 *
 * Reads: {prefix}_URL, {prefix}_DB (or {prefix}_DATABASE),
 *        {prefix}_USER (or {prefix}_USERNAME), {prefix}_PASSWORD
 *
 * @example
 *   // Reads ODOO_PROD_URL, ODOO_PROD_DB, ODOO_PROD_USER, ODOO_PROD_PASSWORD
 *   const config = configFromEnv('ODOO_PROD');
 *   const client = new OdooClient(config);
 *
 * @example
 *   // Reads ODOO_URL, ODOO_DB, ODOO_USER, ODOO_PASSWORD
 *   const config = configFromEnv('ODOO');
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
