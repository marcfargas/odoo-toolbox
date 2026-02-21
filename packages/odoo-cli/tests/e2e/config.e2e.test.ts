/**
 * E2E tests for `odoo config` commands.
 *
 * Requires a running Odoo instance (ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD).
 * Skips gracefully when credentials are not available.
 */

import { describe, it, expect } from 'vitest';
import { runCLI, hasOdooCredentials } from './helpers';

const skip = !hasOdooCredentials();

describe.skipIf(skip)('config e2e', () => {
  it('config check exits 0 with valid credentials', () => {
    const { exitCode, stderr } = runCLI(['config', 'check']);
    expect(exitCode).toBe(0);
    expect(stderr).toMatch(/Connected to/i);
  });

  it('config check shows user info', () => {
    const { stderr } = runCLI(['config', 'check']);
    expect(stderr).toMatch(/User:/i);
  });

  it('config check exits 2 with invalid credentials', () => {
    const { exitCode, stderr } = runCLI(['config', 'check'], {
      ODOO_URL: process.env['ODOO_URL'] ?? '',
      ODOO_DB: process.env['ODOO_DB'] ?? '',
      ODOO_USERNAME: 'invalid-user@nonexistent.com',
      ODOO_PASSWORD: 'wrong-password',
    });
    expect(exitCode).toBe(2);
    expect(stderr).toMatch(/error/i);
  });

  it('config check exits 2 with missing credentials', () => {
    const { exitCode, stderr } = runCLI(['config', 'check'], {
      ODOO_URL: '',
      ODOO_DB: '',
      ODOO_USERNAME: '',
      ODOO_PASSWORD: '',
    });
    expect(exitCode).toBe(2);
    expect(stderr).toMatch(/missing/i);
  });

  it('config show outputs URL and DB', () => {
    const { exitCode, stdout } = runCLI(['config', 'show', '--format', 'json']);
    expect(exitCode).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.url).toBeTruthy();
    expect(data.db).toBeTruthy();
  });

  it('config show redacts password in JSON', () => {
    const { stdout } = runCLI(['config', 'show', '--format', 'json']);
    const data = JSON.parse(stdout);
    expect(data.password).toBe('REDACTED');
    // Should not contain the actual password
    expect(stdout).not.toContain(process.env['ODOO_PASSWORD'] ?? 'XXXNOMATCH');
  });
});

describe('config e2e (no credentials)', () => {
  it('config check exits 2 when no env vars set', () => {
    const { exitCode } = runCLI(['config', 'check'], {
      ODOO_URL: '',
      ODOO_DB: '',
      ODOO_USERNAME: '',
      ODOO_PASSWORD: '',
    });
    expect(exitCode).toBe(2);
  });
});
