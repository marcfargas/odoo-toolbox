import { describe, it, expect, vi } from 'vitest';
import type { OdooField } from '@marcfargas/odoo-introspection';
import { exportData } from '../../src/clone/export';

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

function makeClient(data: Record<string, Record<string, unknown>[]>) {
  return {
    searchRead: vi.fn(async (model: string) => {
      return data[model] ?? [];
    }),
    read: vi.fn(async (model: string, ids: number[]) => {
      const all = data[model] ?? [];
      return all.filter((r) => ids.includes(r.id as number));
    }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('exportData()', () => {
  const partnerFields = [
    makeField({ name: 'name', ttype: 'char', model: 'res.partner' }),
    makeField({ name: 'email', ttype: 'char', model: 'res.partner' }),
    makeField({
      name: 'company_id',
      ttype: 'many2one',
      relation: 'res.company',
      model: 'res.partner',
    }),
    makeField({
      name: 'parent_id',
      ttype: 'many2one',
      relation: 'res.partner',
      model: 'res.partner',
    }),
    makeField({
      name: 'display_name',
      ttype: 'char',
      compute: '_compute_display_name',
      model: 'res.partner',
    }),
  ];

  const companyFields = [makeField({ name: 'name', ttype: 'char', model: 'res.company' })];

  it('exports root records from domain specs', async () => {
    const client = makeClient({
      'res.partner': [
        { id: 1, name: 'Alice', email: 'a@b.c', company_id: false, parent_id: false },
      ],
    });
    const introspector = makeIntrospector({ 'res.partner': partnerFields });

    const snapshot = await exportData(
      client as any,
      introspector as any,
      [{ model: 'res.partner', domain: [['active', '=', true]] }],
      { followRelations: false }
    );

    expect(snapshot.version).toBe(1);
    expect(snapshot.records['res.partner']).toHaveLength(1);
    expect(snapshot.records['res.partner'][0].id).toBe(1);
    expect(snapshot.records['res.partner'][0].values.name).toBe('Alice');
    expect(snapshot.records['res.partner'][0].values.id).toBeUndefined();
    expect(snapshot.metadata.stats['res.partner']).toBe(1);
  });

  it('normalizes many2one tuples to plain IDs', async () => {
    const client = makeClient({
      'res.partner': [
        { id: 1, name: 'Alice', email: 'a@b.c', company_id: [5, 'Acme'], parent_id: false },
      ],
    });
    const introspector = makeIntrospector({ 'res.partner': partnerFields });

    const snapshot = await exportData(
      client as any,
      introspector as any,
      [{ model: 'res.partner', domain: [] }],
      { followRelations: false }
    );

    expect(snapshot.records['res.partner'][0].values.company_id).toBe(5);
  });

  it('strips computed fields', async () => {
    const client = makeClient({
      'res.partner': [
        { id: 1, name: 'Alice', email: 'a@b.c', company_id: false, parent_id: false },
      ],
    });
    const introspector = makeIntrospector({ 'res.partner': partnerFields });

    await exportData(client as any, introspector as any, [{ model: 'res.partner', domain: [] }], {
      followRelations: false,
    });

    // display_name is computed, so it shouldn't be in the field list requested
    // (the mock returns whatever, but the searchRead call should only ask for non-computed fields)
    const requestedFields = client.searchRead.mock.calls[0][2]?.fields;
    expect(requestedFields).not.toContain('display_name');
  });

  it('follows many2one references when followRelations is true', async () => {
    const client = makeClient({
      'res.partner': [
        { id: 1, name: 'Alice', email: 'a@b.c', company_id: [5, 'Acme'], parent_id: false },
      ],
      'res.company': [{ id: 5, name: 'Acme Corp' }],
    });
    const introspector = makeIntrospector({
      'res.partner': partnerFields,
      'res.company': companyFields,
    });

    const snapshot = await exportData(
      client as any,
      introspector as any,
      [{ model: 'res.partner', domain: [] }],
      { followRelations: true }
    );

    // Should have fetched the company as a dependency
    expect(snapshot.records['res.company']).toHaveLength(1);
    expect(snapshot.records['res.company'][0].id).toBe(5);
  });

  it('deduplicates records by (model, id)', async () => {
    const client = makeClient({
      'res.partner': [
        { id: 1, name: 'Alice', email: 'a@b.c', company_id: [5, 'Acme'], parent_id: false },
        { id: 2, name: 'Bob', email: 'b@b.c', company_id: [5, 'Acme'], parent_id: false },
      ],
      'res.company': [{ id: 5, name: 'Acme Corp' }],
    });
    const introspector = makeIntrospector({
      'res.partner': partnerFields,
      'res.company': companyFields,
    });

    const snapshot = await exportData(client as any, introspector as any, [
      { model: 'res.partner', domain: [] },
    ]);

    // Company 5 is referenced by both partners, but should appear only once
    expect(snapshot.records['res.company']).toHaveLength(1);
  });

  it('skips excluded models during dependency resolution', async () => {
    const client = makeClient({
      'res.partner': [
        { id: 1, name: 'Alice', email: 'a@b.c', company_id: [5, 'Acme'], parent_id: false },
      ],
    });
    const introspector = makeIntrospector({ 'res.partner': partnerFields });

    const snapshot = await exportData(
      client as any,
      introspector as any,
      [{ model: 'res.partner', domain: [] }],
      { excludeModels: ['res.company'] }
    );

    expect(snapshot.records['res.company']).toBeUndefined();
  });

  it('respects maxDepth', async () => {
    // Chain: partner → company (depth 1), but maxDepth=0 means no resolution
    const client = makeClient({
      'res.partner': [
        { id: 1, name: 'Alice', email: 'a@b.c', company_id: [5, 'Acme'], parent_id: false },
      ],
    });
    const introspector = makeIntrospector({
      'res.partner': partnerFields,
      'res.company': companyFields,
    });

    const snapshot = await exportData(
      client as any,
      introspector as any,
      [{ model: 'res.partner', domain: [] }],
      { maxDepth: 0 }
    );

    // maxDepth=0 means the BFS loop doesn't run
    expect(snapshot.records['res.company']).toBeUndefined();
  });

  it('records metadata correctly', async () => {
    const domains = [{ model: 'res.partner', domain: [['active', '=', true]], limit: 10 }];
    const client = makeClient({
      'res.partner': [
        { id: 1, name: 'Alice', email: 'a@b.c', company_id: false, parent_id: false },
      ],
    });
    const introspector = makeIntrospector({ 'res.partner': partnerFields });

    const snapshot = await exportData(client as any, introspector as any, domains, {
      followRelations: false,
    });

    expect(snapshot.metadata.domainSpecs).toEqual(domains);
    expect(snapshot.metadata.exportedAt).toBeTruthy();
    expect(snapshot.metadata.stats['res.partner']).toBe(1);
  });
});
