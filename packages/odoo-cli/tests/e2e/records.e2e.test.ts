/**
 * E2E tests for `odoo records` commands.
 *
 * Requires a running Odoo instance.
 * Tests the full command path including exit codes and output format.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { runCLI, hasOdooCredentials } from './helpers';

const skip = !hasOdooCredentials();

describe.skipIf(skip)('records e2e', () => {
  // Track created record IDs for cleanup
  const createdIds: number[] = [];

  afterAll(() => {
    // Clean up any created test records
    for (const id of createdIds) {
      runCLI(['records', 'delete', 'res.partner', String(id), '--confirm']);
    }
  });

  // ── search ─────────────────────────────────────────────────────────

  describe('records search', () => {
    it('returns JSON array by default (piped)', () => {
      const { stdout, exitCode } = runCLI([
        'records',
        'search',
        'res.partner',
        '--format',
        'json',
        '--limit',
        '5',
      ]);
      expect(exitCode).toBe(0);
      const data = JSON.parse(stdout);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });

    it('returns objects with id field', () => {
      const { stdout } = runCLI([
        'records',
        'search',
        'res.partner',
        '--format',
        'json',
        '--limit',
        '5',
      ]);
      const data = JSON.parse(stdout);
      expect(data[0]).toHaveProperty('id');
    });

    it('respects --fields flag', () => {
      const { stdout } = runCLI([
        'records',
        'search',
        'res.partner',
        '--format',
        'json',
        '--limit',
        '3',
        '--fields',
        'id,name',
      ]);
      const data = JSON.parse(stdout);
      expect(data[0]).toHaveProperty('id');
      expect(data[0]).toHaveProperty('name');
      expect(Object.keys(data[0])).toEqual(expect.arrayContaining(['id', 'name']));
    });

    it('respects --limit flag', () => {
      const { stdout } = runCLI([
        'records',
        'search',
        'res.partner',
        '--format',
        'json',
        '--limit',
        '3',
      ]);
      const data = JSON.parse(stdout);
      expect(data.length).toBeLessThanOrEqual(3);
    });

    it('--count outputs a bare integer', () => {
      const { stdout, exitCode } = runCLI(['records', 'search', 'res.partner', '--count']);
      expect(exitCode).toBe(0);
      const count = parseInt(stdout.trim(), 10);
      expect(isNaN(count)).toBe(false);
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('--filter works for simple equality', () => {
      const { stdout, exitCode } = runCLI([
        'records',
        'search',
        'res.partner',
        '--filter',
        'active=true',
        '--format',
        'json',
        '--limit',
        '5',
      ]);
      expect(exitCode).toBe(0);
      const data = JSON.parse(stdout);
      expect(Array.isArray(data)).toBe(true);
    });

    it('exits 0 for empty results', () => {
      const { stdout, exitCode } = runCLI([
        'records',
        'search',
        'res.partner',
        '--domain',
        '[["name","=","THIS-RECORD-DEFINITELY-DOES-NOT-EXIST-XYZ123"]]',
        '--format',
        'json',
      ]);
      expect(exitCode).toBe(0);
      expect(JSON.parse(stdout)).toEqual([]);
    });
  });

  // ── get ─────────────────────────────────────────────────────────────

  describe('records get', () => {
    it('returns default fields id + display_name', () => {
      // Get any partner ID first
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
      if (partners.length === 0) return; // Skip if no partners

      const id = partners[0].id;
      const { stdout, exitCode } = runCLI([
        'records',
        'get',
        'res.partner',
        String(id),
        '--format',
        'json',
      ]);
      expect(exitCode).toBe(0);
      const rec = JSON.parse(stdout);
      expect(rec).toHaveProperty('id', id);
      expect(rec).toHaveProperty('display_name');
    });

    it('exits 3 for non-existent record', () => {
      const { exitCode } = runCLI(['records', 'get', 'res.partner', '9999999']);
      expect(exitCode).toBe(3);
    });
  });

  // ── create ──────────────────────────────────────────────────────────

  describe('records create', () => {
    it('requires --confirm', () => {
      const { exitCode, stderr } = runCLI([
        'records',
        'create',
        'res.partner',
        '--data',
        '{"name":"Test CI Partner"}',
      ]);
      expect(exitCode).toBe(1);
      expect(stderr).toMatch(/--confirm/i);
    });

    it('creates a record and returns ID with --confirm', () => {
      const { stdout, exitCode } = runCLI([
        'records',
        'create',
        'res.partner',
        '--data',
        '{"name":"odoo-cli CI Test Partner","active":true}',
        '--confirm',
        '--format',
        'json',
      ]);
      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('id');
      expect(typeof result.id).toBe('number');
      createdIds.push(result.id);
    });

    it('--dry-run does not create record', () => {
      const { exitCode } = runCLI([
        'records',
        'create',
        'res.partner',
        '--data',
        '{"name":"DRY RUN SHOULD NOT EXIST"}',
        '--confirm',
        '--dry-run',
      ]);
      expect(exitCode).toBe(0);

      // Verify record was not created
      const { stdout } = runCLI([
        'records',
        'search',
        'res.partner',
        '--domain',
        '[["name","=","DRY RUN SHOULD NOT EXIST"]]',
        '--format',
        'json',
      ]);
      expect(JSON.parse(stdout)).toEqual([]);
    });
  });

  // ── write ──────────────────────────────────────────────────────────

  describe('records write', () => {
    it('requires --confirm', () => {
      const { exitCode, stderr } = runCLI([
        'records',
        'write',
        'res.partner',
        '1',
        '--data',
        '{"name":"New Name"}',
      ]);
      expect(exitCode).toBe(1);
      expect(stderr).toMatch(/--confirm/i);
    });
  });

  // ── delete ─────────────────────────────────────────────────────────

  describe('records delete', () => {
    it('requires --confirm', () => {
      const { exitCode, stderr } = runCLI(['records', 'delete', 'res.partner', '9999999']);
      expect(exitCode).toBe(1);
      expect(stderr).toMatch(/--confirm/i);
    });
  });

  // ── count ──────────────────────────────────────────────────────────

  describe('records count', () => {
    it('outputs bare integer', () => {
      const { stdout, exitCode } = runCLI(['records', 'count', 'res.partner']);
      expect(exitCode).toBe(0);
      const n = parseInt(stdout.trim(), 10);
      expect(isNaN(n)).toBe(false);
      expect(n).toBeGreaterThan(0);
    });
  });

  // ── CRUD round trip ─────────────────────────────────────────────────

  describe('CRUD round trip', () => {
    it('create → get → write → delete', () => {
      // Create
      const { stdout: createOut } = runCLI([
        'records',
        'create',
        'res.partner',
        '--data',
        '{"name":"odoo-cli CRUD Test"}',
        '--confirm',
        '--format',
        'json',
      ]);
      const created = JSON.parse(createOut);
      const id = created.id;
      expect(typeof id).toBe('number');

      // Get
      const { stdout: getOut, exitCode: getCode } = runCLI([
        'records',
        'get',
        'res.partner',
        String(id),
        '--format',
        'json',
      ]);
      expect(getCode).toBe(0);
      const fetched = JSON.parse(getOut);
      expect(fetched.id).toBe(id);

      // Write
      const { exitCode: writeCode } = runCLI([
        'records',
        'write',
        'res.partner',
        String(id),
        '--data',
        '{"name":"odoo-cli CRUD Updated"}',
        '--confirm',
      ]);
      expect(writeCode).toBe(0);

      // Delete
      const { exitCode: deleteCode } = runCLI([
        'records',
        'delete',
        'res.partner',
        String(id),
        '--confirm',
      ]);
      expect(deleteCode).toBe(0);

      // Verify gone
      const { exitCode: gone } = runCLI(['records', 'get', 'res.partner', String(id)]);
      expect(gone).toBe(3);
    });
  });
});

// ── Tests that don't require Odoo ────────────────────────────────────

describe('records (no Odoo)', () => {
  it('returns exit 2 with missing credentials', () => {
    const { exitCode } = runCLI(['records', 'search', 'res.partner'], {
      ODOO_URL: '',
      ODOO_DB: '',
      ODOO_USERNAME: '',
      ODOO_PASSWORD: '',
    });
    expect(exitCode).toBe(2);
  });

  it('records create requires --confirm (no Odoo needed)', () => {
    const { exitCode, stderr } = runCLI(
      ['records', 'create', 'res.partner', '--data', '{"name":"Test"}'],
      { ODOO_URL: '', ODOO_DB: '', ODOO_USERNAME: '', ODOO_PASSWORD: '' }
    );
    // Exit 1 = usage error (--confirm missing), checked before auth
    expect(exitCode).toBe(1);
    expect(stderr).toMatch(/--confirm/i);
  });
});
