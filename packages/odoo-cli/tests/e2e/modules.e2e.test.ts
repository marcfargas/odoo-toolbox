/**
 * E2E tests for `odoo modules` commands.
 */

import { describe, it, expect } from 'vitest';
import { runCLI, hasOdooCredentials } from './helpers';

const skip = !hasOdooCredentials();

describe.skipIf(skip)('modules e2e', () => {
  it('modules list returns an array', () => {
    const { stdout, exitCode } = runCLI(['modules', 'list', '--format', 'json']);
    expect(exitCode).toBe(0);
    const data = JSON.parse(stdout);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('modules list --filter installed returns only installed', () => {
    const { stdout } = runCLI(['modules', 'list', '--filter', 'installed', '--format', 'json']);
    const data = JSON.parse(stdout);
    // All should have state=installed
    for (const m of data) {
      expect(m.state).toBe('installed');
    }
  });

  it('modules status for an installed module', () => {
    // base is always installed
    const { stdout, exitCode } = runCLI(['modules', 'status', 'base']);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe('installed');
  });

  it('modules status exits 3 for non-existent module', () => {
    const { exitCode } = runCLI([
      'modules',
      'status',
      'this-module-absolutely-does-not-exist-xyz123',
    ]);
    expect(exitCode).toBe(3);
  });

  it('modules info shows module details', () => {
    const { stdout, exitCode } = runCLI(['modules', 'info', 'base', '--format', 'json']);
    expect(exitCode).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.name).toBe('base');
    expect(data.state).toBe('installed');
  });

  it('modules install requires --confirm', () => {
    const { exitCode, stderr } = runCLI(['modules', 'install', 'some_module']);
    expect(exitCode).toBe(1);
    expect(stderr).toMatch(/--confirm/i);
  });

  it('modules uninstall requires --confirm', () => {
    const { exitCode, stderr } = runCLI(['modules', 'uninstall', 'some_module']);
    expect(exitCode).toBe(1);
    expect(stderr).toMatch(/--confirm/i);
  });

  it('modules upgrade requires --confirm', () => {
    const { exitCode, stderr } = runCLI(['modules', 'upgrade', 'base']);
    expect(exitCode).toBe(1);
    expect(stderr).toMatch(/--confirm/i);
  });

  it('modules list --search filters by name', () => {
    const { stdout, exitCode } = runCLI([
      'modules',
      'list',
      '--search',
      'base',
      '--format',
      'json',
    ]);
    expect(exitCode).toBe(0);
    const data = JSON.parse(stdout);
    // Should include 'base' module
    const names = data.map((m: any) => m.technical_name);
    expect(names).toContain('base');
  });
});

describe('modules (no Odoo)', () => {
  it('modules install requires --confirm before auth', () => {
    const { exitCode, stderr } = runCLI(['modules', 'install', 'hr_timesheet'], {
      ODOO_URL: 'http://fake',
      ODOO_DB: 'fake',
      ODOO_USERNAME: 'fake',
      ODOO_PASSWORD: 'fake',
    });
    expect(exitCode).toBe(1);
    expect(stderr).toMatch(/--confirm/i);
  });
});
