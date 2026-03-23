/**
 * Authentication middleware for odoo-cli.
 *
 * Creates an authenticated OdooClient from environment variables,
 * optionally overriding with CLI flags (--url, --db, --user, --password).
 *
 * Priority: CLI flags > env vars
 * CLI flags should be avoided in practice (shell history exposure).
 */

import debug from 'debug';
import { OdooClient, type OdooClientConfig } from '@marcfargas/odoo-client';
import { CliAuthError } from '../output/errors';

const log = debug('odoo-cli:auth');

export interface AuthFlags {
  url?: string;
  db?: string;
  user?: string;
  password?: string;
}

/**
 * Build an OdooClientConfig from env vars + CLI flag overrides.
 * Does NOT authenticate yet.
 */
export function buildConfig(flags: AuthFlags): OdooClientConfig {
  const url = flags.url || process.env['ODOO_URL'] || '';
  const database = flags.db || process.env['ODOO_DB'] || process.env['ODOO_DATABASE'] || '';
  const username = flags.user || process.env['ODOO_USERNAME'] || process.env['ODOO_USER'] || '';
  const password = flags.password || process.env['ODOO_PASSWORD'] || '';

  const missing: string[] = [];
  if (!url) missing.push('ODOO_URL');
  if (!database) missing.push('ODOO_DB');
  if (!username) missing.push('ODOO_USERNAME');
  if (!password) missing.push('ODOO_PASSWORD');

  if (missing.length > 0) {
    throw new CliAuthError(`Missing Odoo credentials: ${missing.join(', ')}`, [
      'Set the following environment variables:',
      '  ODOO_URL=https://mycompany.odoo.com',
      '  ODOO_DB=mycompany',
      '  ODOO_USERNAME=admin@example.com',
      '  ODOO_PASSWORD=secret',
      'Or use --url, --db, --user, --password flags (avoid in CI — use env vars)',
    ]);
  }

  log('Config: url=%s db=%s user=%s', url, database, username);
  return { url, database, username, password };
}

/**
 * Create an authenticated OdooClient from env vars + CLI flag overrides.
 *
 * Throws CliAuthError if credentials are missing.
 * Throws OdooAuthError if authentication fails (propagates from client).
 */
export async function createAuthClient(flags: AuthFlags): Promise<OdooClient> {
  const config = buildConfig(flags);
  const client = new OdooClient(config);

  log('Authenticating as %s @ %s', config.username, config.url);

  // Disable client-side safety guard — we handle confirmation ourselves
  client.setSafetyContext(null);

  await client.authenticate();
  log('Authenticated successfully');

  return client;
}
