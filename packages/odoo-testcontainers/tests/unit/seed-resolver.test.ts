/**
 * Unit tests for seed-resolver.ts
 *
 * Tests the seed image resolution logic without starting any containers.
 * These run in the standard unit test suite (no Docker required).
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { readSeedConfig, resolveSeedInfo, normaliseOdooVersion } from '../../src/seed-resolver';

// The monorepo root has docker/seed-config.json — use it as a real fixture.
const MONOREPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

// ── normaliseOdooVersion ────────────────────────────────────────────

describe('normaliseOdooVersion', () => {
  it('leaves a dotted version unchanged', () => {
    expect(normaliseOdooVersion('17.0')).toBe('17.0');
    expect(normaliseOdooVersion('18.0')).toBe('18.0');
  });

  it('appends .0 to a bare major version', () => {
    expect(normaliseOdooVersion('17')).toBe('17.0');
    expect(normaliseOdooVersion('18')).toBe('18.0');
    expect(normaliseOdooVersion('19')).toBe('19.0');
  });

  it('returns 17.0 for undefined', () => {
    expect(normaliseOdooVersion(undefined)).toBe('17.0');
    expect(normaliseOdooVersion('')).toBe('17.0');
  });
});

// ── readSeedConfig ──────────────────────────────────────────────────

describe('readSeedConfig', () => {
  it('reads seed-config.json from monorepo root', () => {
    const config = readSeedConfig(MONOREPO_ROOT);
    expect(config).not.toBeNull();
    expect(config!.postgresImage).toMatch(/postgres/);
    expect(config!.versions).toBeDefined();
  });

  it('has a v17.0 entry with modules', () => {
    const config = readSeedConfig(MONOREPO_ROOT)!;
    expect(config.versions['17.0']).toBeDefined();
    expect(config.versions['17.0'].modules).toContain('base');
    expect(config.versions['17.0'].modules).toContain('mail');
    expect(config.versions['17.0'].modules).toContain('crm');
  });

  it('has v18.0 and v19.0 entries (Phase 3)', () => {
    const config = readSeedConfig(MONOREPO_ROOT)!;
    expect(config.versions['18.0']).toBeDefined();
    expect(config.versions['18.0'].modules).toContain('base');
    expect(config.versions['19.0']).toBeDefined();
    expect(config.versions['19.0'].modules).toContain('base');
  });

  it('returns null when the config is not found', () => {
    const result = readSeedConfig('/nonexistent/path/that/does/not/exist');
    expect(result).toBeNull();
  });
});

// ── resolveSeedInfo ─────────────────────────────────────────────────

describe('resolveSeedInfo', () => {
  const FAKE_IMAGE = 'ghcr.io/marcfargas/odoo-test-db:17.0-abc123456789';

  it('returns null when ODOO_SEED_IMAGE is not set', () => {
    const result = resolveSeedInfo(['base', 'mail'], '17.0', undefined, MONOREPO_ROOT);
    expect(result).toBeNull();
  });

  it('returns seed info when all requested modules are in the seed', () => {
    const result = resolveSeedInfo(['base'], '17.0', FAKE_IMAGE, MONOREPO_ROOT);
    expect(result).not.toBeNull();
    expect(result!.seedImage).toBe(FAKE_IMAGE);
    expect(result!.seedModules).toContain('base');
  });

  it('returns seed info when requesting base + mail (covered by base/mail/crm seed)', () => {
    const result = resolveSeedInfo(['base', 'mail'], '17.0', FAKE_IMAGE, MONOREPO_ROOT);
    expect(result).not.toBeNull();
  });

  it('returns seed info when requesting all seeded modules exactly', () => {
    const result = resolveSeedInfo(['base', 'mail', 'crm'], '17.0', FAKE_IMAGE, MONOREPO_ROOT);
    expect(result).not.toBeNull();
  });

  it('returns null when a module is not in the seed (miss)', () => {
    // hr_attendance is not seeded
    const result = resolveSeedInfo(
      ['base', 'mail', 'hr_attendance'],
      '17.0',
      FAKE_IMAGE,
      MONOREPO_ROOT
    );
    expect(result).toBeNull();
  });

  it('returns null when requesting only unseen modules', () => {
    const result = resolveSeedInfo(['hr_attendance', 'project'], '17.0', FAKE_IMAGE, MONOREPO_ROOT);
    expect(result).toBeNull();
  });

  it('returns null when seed-config.json is not found', () => {
    const result = resolveSeedInfo(['base'], '17.0', FAKE_IMAGE, '/nonexistent/path');
    expect(result).toBeNull();
  });

  it('returns seed info for v18.0 and v19.0 (Phase 3)', () => {
    expect(resolveSeedInfo(['base', 'mail'], '18.0', FAKE_IMAGE, MONOREPO_ROOT)).not.toBeNull();
    expect(resolveSeedInfo(['base', 'crm'], '19.0', FAKE_IMAGE, MONOREPO_ROOT)).not.toBeNull();
  });

  it('returns null for an unknown Odoo version', () => {
    // v99.0 is not in seed-config.json
    const result = resolveSeedInfo(['base'], '99.0', FAKE_IMAGE, MONOREPO_ROOT);
    expect(result).toBeNull();
  });

  it('handles empty modules list (vacuously true — seed covers everything)', () => {
    // Requesting [] modules is always covered (no modules to check)
    const result = resolveSeedInfo([], '17.0', FAKE_IMAGE, MONOREPO_ROOT);
    expect(result).not.toBeNull();
  });
});
