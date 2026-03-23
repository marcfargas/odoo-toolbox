import { describe, it, expect, vi } from 'vitest';
import { normalizeFieldValue, diffRecord, diffResources } from '../../src/engine/diff';
import type { OdooField } from '@marcfargas/odoo-introspection';
import type { ResolvedState } from '../../src/engine/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeField(overrides: Partial<OdooField>): OdooField {
  return {
    id: 1,
    name: 'test_field',
    field_description: 'Test Field',
    ttype: 'char',
    required: false,
    readonly: false,
    model: 'res.partner',
    ...overrides,
  };
}

function makeFieldMap(fields: Partial<OdooField>[]): Map<string, OdooField> {
  const map = new Map<string, OdooField>();
  for (const f of fields) {
    const field = makeField(f);
    map.set(field.name, field);
  }
  return map;
}

function makeClient(records: Record<number, Record<string, unknown>>) {
  return {
    read: vi.fn(async (_model: string, ids: number[], _fields?: string[]) => {
      return ids.map((id) => ({ id, ...(records[id] ?? {}) }));
    }),
  };
}

// ---------------------------------------------------------------------------
// normalizeFieldValue()
// ---------------------------------------------------------------------------

describe('normalizeFieldValue()', () => {
  it('many2one: extracts id from tuple [id, name]', () => {
    expect(normalizeFieldValue([42, 'Display Name'], 'many2one')).toBe(42);
  });

  it('many2one: false → null', () => {
    expect(normalizeFieldValue(false, 'many2one')).toBeNull();
  });

  it('many2one: numeric id passes through', () => {
    expect(normalizeFieldValue(42, 'many2one')).toBe(42);
  });

  it('many2one: null passes through', () => {
    expect(normalizeFieldValue(null, 'many2one')).toBeNull();
  });

  it('many2many: sorts array for consistent comparison', () => {
    expect(normalizeFieldValue([3, 1, 2], 'many2many')).toStrictEqual([1, 2, 3]);
  });

  it('one2many: sorts array for consistent comparison', () => {
    expect(normalizeFieldValue([10, 5, 8], 'one2many')).toStrictEqual([5, 8, 10]);
  });

  it('many2many: empty array returns empty array', () => {
    expect(normalizeFieldValue([], 'many2many')).toStrictEqual([]);
  });

  it('char: string passes through unchanged', () => {
    expect(normalizeFieldValue('hello', 'char')).toBe('hello');
  });

  it('integer: number passes through unchanged', () => {
    expect(normalizeFieldValue(42, 'integer')).toBe(42);
  });

  it('boolean: true passes through unchanged', () => {
    expect(normalizeFieldValue(true, 'boolean')).toBe(true);
  });

  it('boolean: false passes through unchanged (not many2one context)', () => {
    expect(normalizeFieldValue(false, 'boolean')).toBe(false);
  });

  it('unknown type: passes through unchanged', () => {
    const obj = { foo: 'bar' };
    expect(normalizeFieldValue(obj, 'selection')).toBe(obj);
  });
});

// ---------------------------------------------------------------------------
// diffRecord()
// ---------------------------------------------------------------------------

describe('diffRecord()', () => {
  it('detects changed field', () => {
    const desired = { name: 'New Name' };
    const actual = { name: 'Old Name' };
    const diffs = diffRecord(desired, actual);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toMatchObject({
      field: 'name',
      desired: 'New Name',
      actual: 'Old Name',
    });
  });

  it('returns no diffs when values match', () => {
    const desired = { name: 'Same Name', active: true };
    const actual = { name: 'Same Name', active: true };
    const diffs = diffRecord(desired, actual);
    expect(diffs).toHaveLength(0);
  });

  it('detects multiple changed fields', () => {
    const desired = { name: 'New', email: 'new@example.com' };
    const actual = { name: 'Old', email: 'old@example.com' };
    const diffs = diffRecord(desired, actual);
    expect(diffs).toHaveLength(2);
  });

  it('skips system fields: id', () => {
    const desired = { id: 99, name: 'Same' };
    const actual = { id: 1, name: 'Same' };
    const diffs = diffRecord(desired, actual);
    expect(diffs).toHaveLength(0);
  });

  it('skips system fields: write_date, create_date, write_uid, create_uid, __last_update', () => {
    const desired = {
      write_date: '2024-01-01',
      create_date: '2023-01-01',
      write_uid: [1, 'Admin'],
      create_uid: [1, 'Admin'],
      __last_update: '2024-01-01',
      name: 'Same',
    };
    const actual = {
      write_date: '2024-12-31',
      create_date: '2020-01-01',
      write_uid: [2, 'Other'],
      create_uid: [2, 'Other'],
      __last_update: '2024-12-31',
      name: 'Same',
    };
    const diffs = diffRecord(desired, actual);
    expect(diffs).toHaveLength(0);
  });

  it('skips readonly fields when field metadata provided', () => {
    const desired = { name: 'New', computed_field: 'X' };
    const actual = { name: 'New', computed_field: 'Y' };
    const fields = makeFieldMap([
      { name: 'name', ttype: 'char' },
      { name: 'computed_field', ttype: 'char', readonly: true },
    ]);
    const diffs = diffRecord(desired, actual, fields);
    expect(diffs).toHaveLength(0);
  });

  it('skips computed fields when field metadata provided', () => {
    const desired = { name: 'Same', display_name: 'Old Display' };
    const actual = { name: 'Same', display_name: 'New Display' };
    const fields = makeFieldMap([
      { name: 'name', ttype: 'char' },
      { name: 'display_name', ttype: 'char', compute: 'compute_display_name' },
    ]);
    const diffs = diffRecord(desired, actual, fields);
    expect(diffs).toHaveLength(0);
  });

  it('does not skip readonly fields when no metadata provided', () => {
    const desired = { name: 'New' };
    const actual = { name: 'Old' };
    const diffs = diffRecord(desired, actual);
    expect(diffs).toHaveLength(1);
  });

  it('normalizes many2one values before comparing', () => {
    const desired = { partner_id: 42 };
    const actual = { partner_id: [42, 'ACME'] };
    const fields = makeFieldMap([{ name: 'partner_id', ttype: 'many2one' }]);
    const diffs = diffRecord(desired, actual, fields);
    expect(diffs).toHaveLength(0);
  });

  it('normalizes many2many arrays (order-insensitive)', () => {
    const desired = { tag_ids: [1, 2, 3] };
    const actual = { tag_ids: [3, 1, 2] };
    const fields = makeFieldMap([{ name: 'tag_ids', ttype: 'many2many' }]);
    const diffs = diffRecord(desired, actual, fields);
    expect(diffs).toHaveLength(0);
  });

  it('detects many2many change after normalization', () => {
    const desired = { tag_ids: [1, 2] };
    const actual = { tag_ids: [1, 3] };
    const fields = makeFieldMap([{ name: 'tag_ids', ttype: 'many2many' }]);
    const diffs = diffRecord(desired, actual, fields);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].field).toBe('tag_ids');
  });
});

// ---------------------------------------------------------------------------
// diffResources()
// ---------------------------------------------------------------------------

describe('diffResources()', () => {
  it('update mode: fetches actual record and diffs', async () => {
    const resolved: ResolvedState = {
      resources: [
        {
          original: {} as any,
          model: 'res.partner',
          mode: 'update',
          resolvedId: 42,
          resolvedValues: { name: 'New Name' },
        },
      ],
      policies: [],
    };

    const client = makeClient({ 42: { name: 'Old Name' } });
    const introspector = { getFields: vi.fn(async () => []) };

    const results = await diffResources(resolved, client, introspector);

    expect(results).toHaveLength(1);
    expect(results[0].mode).toBe('update');
    expect(results[0].hasChanges).toBe(true);
    expect(results[0].changes).toHaveLength(1);
    expect(results[0].changes[0]).toMatchObject({
      field: 'name',
      desired: 'New Name',
      actual: 'Old Name',
    });
    expect(client.read).toHaveBeenCalledWith('res.partner', [42], ['name']);
  });

  it('update mode: returns hasChanges=false when no diffs', async () => {
    const resolved: ResolvedState = {
      resources: [
        {
          original: {} as any,
          model: 'res.partner',
          mode: 'update',
          resolvedId: 42,
          resolvedValues: { name: 'Same Name' },
        },
      ],
      policies: [],
    };

    const client = makeClient({ 42: { name: 'Same Name' } });
    const introspector = { getFields: vi.fn(async () => []) };

    const results = await diffResources(resolved, client, introspector);

    expect(results[0].hasChanges).toBe(false);
    expect(results[0].changes).toHaveLength(0);
  });

  it('create mode: hasChanges=true with empty changes array', async () => {
    const resolved: ResolvedState = {
      resources: [
        {
          original: {} as any,
          model: 'res.partner',
          mode: 'create',
          resolvedId: null,
          resolvedValues: { name: 'New Partner', email: 'new@example.com' },
        },
      ],
      policies: [],
    };

    const client = makeClient({});
    const introspector = { getFields: vi.fn(async () => []) };

    const results = await diffResources(resolved, client, introspector);

    expect(results).toHaveLength(1);
    expect(results[0].mode).toBe('create');
    expect(results[0].hasChanges).toBe(true);
    expect(results[0].changes).toHaveLength(0);
    expect(client.read).not.toHaveBeenCalled();
  });

  it('update mode: uses field metadata for readonly field skipping', async () => {
    const resolved: ResolvedState = {
      resources: [
        {
          original: {} as any,
          model: 'res.partner',
          mode: 'update',
          resolvedId: 10,
          resolvedValues: { name: 'Same', computed_field: 'X' },
        },
      ],
      policies: [],
    };

    const fields: OdooField[] = [
      makeField({ name: 'name', ttype: 'char' }),
      makeField({ name: 'computed_field', ttype: 'char', readonly: true }),
    ];

    const client = makeClient({ 10: { name: 'Same', computed_field: 'Y' } });
    const introspector = { getFields: vi.fn(async () => fields) };

    const results = await diffResources(resolved, client, introspector);

    expect(results[0].hasChanges).toBe(false);
    expect(results[0].changes).toHaveLength(0);
  });
});
