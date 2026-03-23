/**
 * E2E tests for `odoo cdc` commands.
 *
 * "No Odoo" tests run always — they verify argument validation and CLI structure.
 * "With Odoo" tests run only when credentials are present and use only
 * standard Odoo models (res.partner, res.currency) — no business data.
 */

import { describe, it, expect } from 'vitest';
import { runCLI, hasOdooCredentials } from './helpers';

const FAKE_ENV = {
  ODOO_URL: 'http://localhost:19999', // nothing listening
  ODOO_DB: 'fake',
  ODOO_USERNAME: 'fake',
  ODOO_PASSWORD: 'fake',
};

const skip = !hasOdooCredentials();

// ── Structural / argument validation (no Odoo needed) ─────────────────────────

describe('cdc (no Odoo)', () => {
  it('cdc --help lists the three subcommands', () => {
    const { stdout, exitCode } = runCLI(['cdc', '--help'], FAKE_ENV);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/check/);
    expect(stdout).toMatch(/history/);
    expect(stdout).toMatch(/feed/);
  });

  it('cdc check --help shows model argument', () => {
    const { stdout, exitCode } = runCLI(['cdc', 'check', '--help'], FAKE_ENV);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/<model>/);
  });

  it('cdc history --help shows model and id arguments', () => {
    const { stdout, exitCode } = runCLI(['cdc', 'history', '--help'], FAKE_ENV);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/<model>/);
    expect(stdout).toMatch(/<id>/);
  });

  it('cdc feed --help shows model argument and --since option', () => {
    const { stdout, exitCode } = runCLI(['cdc', 'feed', '--help'], FAKE_ENV);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/<model>/);
    expect(stdout).toMatch(/--since/);
  });

  it('cdc history rejects a non-numeric id', () => {
    const { exitCode, stderr } = runCLI(
      ['cdc', 'history', 'res.partner', 'not-a-number'],
      FAKE_ENV
    );
    expect(exitCode).not.toBe(0);
    expect(stderr).toMatch(/invalid id/i);
  });

  it('cdc check fails with auth error on unreachable host', () => {
    const { exitCode } = runCLI(['cdc', 'check', 'res.partner'], FAKE_ENV);
    // Should fail (auth/network error) — not exit 0
    expect(exitCode).not.toBe(0);
  });

  it('cdc history fails with auth error on unreachable host', () => {
    const { exitCode } = runCLI(['cdc', 'history', 'res.partner', '1'], FAKE_ENV);
    expect(exitCode).not.toBe(0);
  });

  it('cdc feed fails with auth error on unreachable host', () => {
    const { exitCode } = runCLI(['cdc', 'feed', 'res.partner', '--since', '2020-01-01'], FAKE_ENV);
    expect(exitCode).not.toBe(0);
  });
});

// ── Live Odoo tests (skip when no credentials) ────────────────────────────────

describe.skipIf(skip)('cdc (with Odoo)', () => {
  it('cdc check res.partner exits 0 and shows isMailThread: true', () => {
    const { stdout, exitCode } = runCLI(['cdc', 'check', 'res.partner']);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/isMailThread/);
    expect(stdout).toMatch(/true/);
  });

  it('cdc check res.currency exits 0 and shows isMailThread: false', () => {
    const { stdout, exitCode } = runCLI(['cdc', 'check', 'res.currency']);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/isMailThread/);
    expect(stdout).toMatch(/false/);
  });

  it('cdc check --format json returns a single-element JSON array', () => {
    const { stdout, exitCode } = runCLI(['cdc', 'check', 'res.partner', '--format', 'json']);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toHaveProperty('model', 'res.partner');
    expect(parsed[0]).toHaveProperty('isMailThread', true);
    expect(typeof parsed[0].trackedFieldCount).toBe('number');
    expect(typeof parsed[0].hasHistory).toBe('boolean');
  });

  it('cdc history res.partner <nonexistent id> exits 0 with empty result', () => {
    // ID 999999999 almost certainly does not exist
    const { stdout, exitCode } = runCLI([
      'cdc',
      'history',
      'res.partner',
      '999999999',
      '--format',
      'json',
    ]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed).toEqual([]);
  });

  it('cdc feed res.partner --since far-future returns empty ndjson', () => {
    const { stdout, exitCode } = runCLI([
      'cdc',
      'feed',
      'res.partner',
      '--since',
      '2099-01-01',
      '--page-size',
      '10',
    ]);
    expect(exitCode).toBe(0);
    // No output = no events
    expect(stdout.trim()).toBe('');
  });

  it('cdc feed --show-cursor writes cursor:<n> to stderr', () => {
    // Use a recent window; if empty, cursor stays at 0 which is fine
    const { stderr, exitCode } = runCLI([
      'cdc',
      'feed',
      'res.partner',
      '--since',
      '2099-01-01',
      '--show-cursor',
    ]);
    expect(exitCode).toBe(0);
    expect(stderr).toMatch(/^cursor:\d+/m);
  });

  it('cdc history exits 0 for a record that exists (content depends on Odoo state)', () => {
    // res.partner id=1 is the main company — always exists, may or may not have history
    const { exitCode } = runCLI(['cdc', 'history', 'res.partner', '1']);
    expect(exitCode).toBe(0);
  });

  it('cdc feed output lines are valid JSON objects', () => {
    const recentWindow = new Date(Date.now() - 5 * 60 * 1000)
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19);

    const { stdout, exitCode } = runCLI([
      'cdc',
      'feed',
      'res.partner',
      '--since',
      recentWindow,
      '--page-size',
      '5',
    ]);
    expect(exitCode).toBe(0);

    // Each non-empty line must be valid JSON with the expected fields
    const lines = stdout.split('\n').filter((l) => l.trim());
    for (const line of lines) {
      const obj = JSON.parse(line); // throws if invalid
      expect(typeof obj.id).toBe('number');
      expect(typeof obj.recordId).toBe('number');
      expect(obj.model).toBe('res.partner');
      expect(typeof obj.fieldName).toBe('string');
    }
  });
});
