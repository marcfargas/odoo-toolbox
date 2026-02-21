/**
 * E2E tests for `odoo mail` commands.
 */

import { describe, it, expect } from 'vitest';
import { runCLI, hasOdooCredentials } from './helpers';

const skip = !hasOdooCredentials();

describe('mail (no Odoo)', () => {
  it('mail note requires --confirm', () => {
    const { exitCode, stderr } = runCLI(['mail', 'note', 'res.partner', '1', 'Test message'], {
      ODOO_URL: 'http://fake',
      ODOO_DB: 'fake',
      ODOO_USERNAME: 'fake',
      ODOO_PASSWORD: 'fake',
    });
    expect(exitCode).toBe(1);
    expect(stderr).toMatch(/--confirm/i);
  });

  it('mail post requires --confirm', () => {
    const { exitCode, stderr } = runCLI(['mail', 'post', 'res.partner', '1', 'Test message'], {
      ODOO_URL: 'http://fake',
      ODOO_DB: 'fake',
      ODOO_USERNAME: 'fake',
      ODOO_PASSWORD: 'fake',
    });
    expect(exitCode).toBe(1);
    expect(stderr).toMatch(/--confirm/i);
  });

  it('mail note --dry-run does not require auth', () => {
    const { exitCode } = runCLI(
      ['mail', 'note', 'res.partner', '1', 'Test', '--confirm', '--dry-run'],
      { ODOO_URL: 'http://fake', ODOO_DB: 'fake', ODOO_USERNAME: 'fake', ODOO_PASSWORD: 'fake' }
    );
    // dry-run exits 0 without making network calls (no auth needed)
    expect(exitCode).toBe(0);
  });
});

describe.skipIf(skip)('mail e2e', () => {
  // Need a record to post on — use res.users (id=2 is usually admin portal)
  // We use res.partner (1 = OdooBot or company) which always exists

  it('mail note posts successfully to an existing record', () => {
    // Find a partner to post on
    const { stdout: listOut } = runCLI([
      'records',
      'search',
      'res.partner',
      '--format',
      'json',
      '--limit',
      '1',
      '--fields',
      'id',
    ]);
    const partners = JSON.parse(listOut);
    if (partners.length === 0) return;
    const id = partners[0].id;

    const { exitCode, stderr } = runCLI([
      'mail',
      'note',
      'res.partner',
      String(id),
      'CI test note from odoo-cli',
      '--confirm',
    ]);
    expect(exitCode).toBe(0);
    expect(stderr).toMatch(/posted/i);
  });
});
