import { describe, it, expect, vi } from 'vitest';
import type { OdooField } from '@marcfargas/odoo-introspection';
import { importData } from '../../src/clone/import';
import type { Snapshot } from '../../src/clone/types';

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

function makeIntrospector(fields: Record<string, OdooField[]>) {
  return {
    getFields: vi.fn(async (model: string) => fields[model] ?? []),
  };
}

/** Client mock that auto-increments IDs per model */
function makeClient() {
  const counters: Record<string, number> = {};
  const writeLog: Array<{
    model: string;
    ids: number | number[];
    values: Record<string, unknown>;
  }> = [];

  return {
    create: vi.fn(async (model: string, _values: Record<string, unknown>) => {
      counters[model] = (counters[model] ?? 0) + 1;
      return counters[model];
    }),
    write: vi.fn(async (model: string, ids: number | number[], values: Record<string, unknown>) => {
      writeLog.push({ model, ids, values });
      return true;
    }),
    _writeLog: writeLog,
  };
}

function makeSnapshot(
  records: Record<string, Array<{ id: number; values: Record<string, unknown> }>>
): Snapshot {
  const stats: Record<string, number> = {};
  for (const [model, recs] of Object.entries(records)) {
    stats[model] = recs.length;
  }
  return {
    version: 1,
    records,
    metadata: {
      exportedAt: new Date().toISOString(),
      domainSpecs: [],
      stats,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('importData()', () => {
  const partnerFields = [
    makeField({ name: 'name', ttype: 'char', model: 'res.partner' }),
    makeField({ name: 'email', ttype: 'char', model: 'res.partner' }),
    makeField({
      name: 'company_id',
      ttype: 'many2one',
      relation: 'res.company',
      model: 'res.partner',
    }),
  ];

  const companyFields = [makeField({ name: 'name', ttype: 'char', model: 'res.company' })];

  it('creates records and returns id mapping', async () => {
    const client = makeClient();
    const introspector = makeIntrospector({
      'res.partner': partnerFields,
      'res.company': companyFields,
    });

    const snapshot = makeSnapshot({
      'res.company': [{ id: 5, values: { name: 'Acme' } }],
      'res.partner': [{ id: 42, values: { name: 'Alice', email: 'a@b.c', company_id: 5 } }],
    });

    const result = await importData(client as any, introspector as any, snapshot);

    expect(result.idMap['res.company'][5]).toBeDefined();
    expect(result.idMap['res.partner'][42]).toBeDefined();
    expect(result.created['res.company']).toBe(1);
    expect(result.created['res.partner']).toBe(1);
  });

  it('creates dependencies before dependents (topo order)', async () => {
    const client = makeClient();
    const introspector = makeIntrospector({
      'res.partner': partnerFields,
      'res.company': companyFields,
    });

    const snapshot = makeSnapshot({
      'res.partner': [{ id: 42, values: { name: 'Alice', company_id: 5 } }],
      'res.company': [{ id: 5, values: { name: 'Acme' } }],
    });

    await importData(client as any, introspector as any, snapshot);

    // Company should be created before partner
    const calls = client.create.mock.calls;
    const companyCallIndex = calls.findIndex((c: any) => c[0] === 'res.company');
    const partnerCallIndex = calls.findIndex((c: any) => c[0] === 'res.partner');
    expect(companyCallIndex).toBeLessThan(partnerCallIndex);
  });

  it('remaps many2one IDs to target IDs', async () => {
    const client = makeClient();
    const introspector = makeIntrospector({
      'res.partner': partnerFields,
      'res.company': companyFields,
    });

    const snapshot = makeSnapshot({
      'res.company': [{ id: 5, values: { name: 'Acme' } }],
      'res.partner': [{ id: 42, values: { name: 'Alice', company_id: 5 } }],
    });

    await importData(client as any, introspector as any, snapshot);

    // The partner create call should use the remapped company ID (1, not 5)
    const partnerCall = client.create.mock.calls.find((c: any) => c[0] === 'res.partner');
    expect(partnerCall[1].company_id).toBe(1); // company was created as ID 1
  });

  it('nulls out unresolvable many2one references', async () => {
    const client = makeClient();
    const introspector = makeIntrospector({
      'res.partner': partnerFields,
    });

    // company_id=99 but res.company is not in the snapshot
    const snapshot = makeSnapshot({
      'res.partner': [{ id: 42, values: { name: 'Alice', company_id: 99 } }],
    });

    await importData(client as any, introspector as any, snapshot);

    const partnerCall = client.create.mock.calls.find((c: any) => c[0] === 'res.partner');
    expect(partnerCall[1].company_id).toBe(false);
  });

  it('handles self-referential fields with two-pass approach', async () => {
    const selfRefFields = [
      makeField({ name: 'name', ttype: 'char', model: 'res.partner' }),
      makeField({
        name: 'parent_id',
        ttype: 'many2one',
        relation: 'res.partner',
        model: 'res.partner',
      }),
    ];

    const client = makeClient();
    const introspector = makeIntrospector({ 'res.partner': selfRefFields });

    const snapshot = makeSnapshot({
      'res.partner': [
        { id: 10, values: { name: 'Parent', parent_id: false } },
        { id: 11, values: { name: 'Child', parent_id: 10 } },
      ],
    });

    const result = await importData(client as any, introspector as any, snapshot);

    // Phase 1: parent_id should be nulled during create
    const childCreate = client.create.mock.calls.find((c: any) => c[1].name === 'Child');
    expect(childCreate[1].parent_id).toBe(false);

    // Phase 2: parent_id should be patched with remapped ID
    expect(client.write).toHaveBeenCalled();
    const writeCall = client._writeLog.find(
      (w) => w.model === 'res.partner' && w.ids === result.idMap['res.partner'][11]
    );
    expect(writeCall).toBeDefined();
    expect(writeCall!.values.parent_id).toBe(result.idMap['res.partner'][10]);
  });

  it('returns empty result for empty snapshot', async () => {
    const client = makeClient();
    const introspector = makeIntrospector({});

    const snapshot = makeSnapshot({});
    const result = await importData(client as any, introspector as any, snapshot);

    expect(result.idMap).toEqual({});
    expect(result.created).toEqual({});
    expect(result.errors).toEqual([]);
  });

  it('records errors and continues when onConflict is skip', async () => {
    const client = makeClient();
    // Make create fail for one record
    let callCount = 0;
    client.create = vi.fn(async (_model: string) => {
      callCount++;
      if (callCount === 1) throw new Error('duplicate key');
      return callCount;
    });

    const introspector = makeIntrospector({
      'res.partner': [makeField({ name: 'name', ttype: 'char', model: 'res.partner' })],
    });

    const snapshot = makeSnapshot({
      'res.partner': [
        { id: 1, values: { name: 'Alice' } },
        { id: 2, values: { name: 'Bob' } },
      ],
    });

    const result = await importData(client as any, introspector as any, snapshot, {
      onConflict: 'skip',
    });

    expect(result.errors).toHaveLength(1);
    expect(result.skipped['res.partner']).toBe(1);
    expect(result.created['res.partner']).toBe(1);
  });

  it('throws on first error when onConflict is error', async () => {
    const client = makeClient();
    client.create = vi.fn(async () => {
      throw new Error('duplicate key');
    });

    const introspector = makeIntrospector({
      'res.partner': [makeField({ name: 'name', ttype: 'char', model: 'res.partner' })],
    });

    const snapshot = makeSnapshot({
      'res.partner': [{ id: 1, values: { name: 'Alice' } }],
    });

    await expect(
      importData(client as any, introspector as any, snapshot, { onConflict: 'error' })
    ).rejects.toThrow('duplicate key');
  });
});
