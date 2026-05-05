import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createSnapshotCache } from '../../src/snapshot-cache';
import { normaliseOdooVersion } from '../../src/version';

describe('normaliseOdooVersion', () => {
  it('leaves dotted versions unchanged', () => {
    expect(normaliseOdooVersion('17.0')).toBe('17.0');
    expect(normaliseOdooVersion('18.0')).toBe('18.0');
  });

  it('appends .0 to bare major versions', () => {
    expect(normaliseOdooVersion('17')).toBe('17.0');
    expect(normaliseOdooVersion('19')).toBe('19.0');
  });

  it('defaults to 17.0', () => {
    expect(normaliseOdooVersion(undefined)).toBe('17.0');
    expect(normaliseOdooVersion('')).toBe('17.0');
  });
});

describe('createSnapshotCache', () => {
  const baseInput = {
    odooVersion: '17.0',
    postgresImage: 'postgres:15-alpine',
    modules: ['crm', 'base'],
    database: 'test_odoo',
    adminPassword: 'admin',
    env: {},
  };

  it('creates stable keys for equivalent module sets', () => {
    const a = createSnapshotCache(true, baseInput);
    const b = createSnapshotCache(true, { ...baseInput, modules: ['base', 'crm'] });

    expect(a.key).toBe(b.key);
    expect(a.fileName).toBe(`${a.key}.dump`);
  });

  it('changes keys when the caller cache key changes', () => {
    const a = createSnapshotCache({ key: 'v1' }, baseInput);
    const b = createSnapshotCache({ key: 'v2' }, baseInput);

    expect(a.key).not.toBe(b.key);
  });

  it('includes addon file contents in the key', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'odoo-snapshot-test-'));
    try {
      const addon = path.join(dir, 'addon.py');
      fs.writeFileSync(addon, 'A');
      const a = createSnapshotCache(true, { ...baseInput, addonsPath: dir });

      fs.writeFileSync(addon, 'B');
      const b = createSnapshotCache(true, { ...baseInput, addonsPath: dir });

      expect(a.key).not.toBe(b.key);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('can be disabled by option', () => {
    const cache = createSnapshotCache(false, baseInput);
    expect(cache.enabled).toBe(false);
  });
});
