import { describe, it, expect, vi } from 'vitest';
import {
  classifyRelationalField,
  buildDependencyGraph,
  topologicalSort,
  getModelModuleMap,
  validateModuleDependencies,
  validateArchiveOrphans,
} from '../../src/engine/introspect';
import type { OdooField, OdooModel } from '@marcfargas/odoo-introspection';
import type { ResolvedState } from '../../src/engine/types';
import type { ModelPolicy } from '../../src/dsl/types';

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

function makeModel(overrides: Partial<OdooModel>): OdooModel {
  return {
    id: 1,
    model: 'res.partner',
    name: 'Contact',
    transient: false,
    modules: 'base',
    ...overrides,
  };
}

function makeIntrospector(fields: Record<string, OdooField[]>, models: OdooModel[] = []) {
  return {
    getFields: vi.fn(async (modelName: string) => fields[modelName] ?? []),
    getModels: vi.fn(async () => models),
  };
}

// ---------------------------------------------------------------------------
// classifyRelationalField
// ---------------------------------------------------------------------------

describe('classifyRelationalField()', () => {
  it('returns many2one for many2one field', () => {
    const field = makeField({ ttype: 'many2one' });
    expect(classifyRelationalField(field)).toBe('many2one');
  });

  it('returns one2many for one2many field', () => {
    const field = makeField({ ttype: 'one2many' });
    expect(classifyRelationalField(field)).toBe('one2many');
  });

  it('returns many2many for many2many field', () => {
    const field = makeField({ ttype: 'many2many' });
    expect(classifyRelationalField(field)).toBe('many2many');
  });

  it('returns null for char field', () => {
    const field = makeField({ ttype: 'char' });
    expect(classifyRelationalField(field)).toBeNull();
  });

  it('returns null for integer field', () => {
    const field = makeField({ ttype: 'integer' });
    expect(classifyRelationalField(field)).toBeNull();
  });

  it('returns null for boolean field', () => {
    const field = makeField({ ttype: 'boolean' });
    expect(classifyRelationalField(field)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildDependencyGraph
// ---------------------------------------------------------------------------

describe('buildDependencyGraph()', () => {
  it('builds adjacency list from many2one fields', async () => {
    const introspector = makeIntrospector({
      'sale.order': [
        makeField({
          name: 'partner_id',
          ttype: 'many2one',
          relation: 'res.partner',
          model: 'sale.order',
        }),
        makeField({ name: 'name', ttype: 'char', model: 'sale.order' }),
      ],
      'res.partner': [makeField({ name: 'name', ttype: 'char', model: 'res.partner' })],
    });

    const graph = await buildDependencyGraph(['sale.order', 'res.partner'], introspector as any);

    expect(graph.get('sale.order')).toContain('res.partner');
    expect(graph.get('sale.order')).toHaveLength(1);
    expect(graph.get('res.partner')).toHaveLength(0);
  });

  it('ignores many2one dependencies on models not in input list', async () => {
    const introspector = makeIntrospector({
      'sale.order': [
        makeField({
          name: 'partner_id',
          ttype: 'many2one',
          relation: 'res.partner',
          model: 'sale.order',
        }),
        makeField({
          name: 'company_id',
          ttype: 'many2one',
          relation: 'res.company',
          model: 'sale.order',
        }),
      ],
    });

    // res.company is NOT in the input list
    const graph = await buildDependencyGraph(['sale.order', 'res.partner'], introspector as any);

    expect(graph.get('sale.order')).not.toContain('res.company');
  });

  it('does not include one2many or many2many as dependencies', async () => {
    const introspector = makeIntrospector({
      'res.partner': [
        makeField({
          name: 'child_ids',
          ttype: 'one2many',
          relation: 'res.partner',
          model: 'res.partner',
        }),
        makeField({
          name: 'category_id',
          ttype: 'many2many',
          relation: 'res.partner.category',
          model: 'res.partner',
        }),
      ],
    });

    const graph = await buildDependencyGraph(['res.partner'], introspector as any);

    expect(graph.get('res.partner')).toHaveLength(0);
  });

  it('all input models appear as keys in graph', async () => {
    const introspector = makeIntrospector({
      'res.partner': [],
      'res.company': [],
    });

    const graph = await buildDependencyGraph(['res.partner', 'res.company'], introspector as any);

    expect(graph.has('res.partner')).toBe(true);
    expect(graph.has('res.company')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// topologicalSort
// ---------------------------------------------------------------------------

describe('topologicalSort()', () => {
  it('returns dependency before dependent', () => {
    // sale.order depends on res.partner → res.partner must come first
    const graph = new Map([
      ['sale.order', ['res.partner']],
      ['res.partner', []],
    ]);

    const sorted = topologicalSort(graph);
    const partnerIdx = sorted.indexOf('res.partner');
    const orderIdx = sorted.indexOf('sale.order');

    expect(partnerIdx).toBeLessThan(orderIdx);
  });

  it('handles chain of dependencies', () => {
    // c depends on b, b depends on a → order: a, b, c
    const graph = new Map([
      ['c', ['b']],
      ['b', ['a']],
      ['a', []],
    ]);

    const sorted = topologicalSort(graph);
    expect(sorted.indexOf('a')).toBeLessThan(sorted.indexOf('b'));
    expect(sorted.indexOf('b')).toBeLessThan(sorted.indexOf('c'));
  });

  it('returns all nodes', () => {
    const graph = new Map([
      ['a', ['b']],
      ['b', ['c']],
      ['c', []],
    ]);

    const sorted = topologicalSort(graph);
    expect(sorted).toHaveLength(3);
    expect(sorted).toContain('a');
    expect(sorted).toContain('b');
    expect(sorted).toContain('c');
  });

  it('handles graph with no dependencies', () => {
    const graph = new Map([
      ['a', []],
      ['b', []],
      ['c', []],
    ]);

    const sorted = topologicalSort(graph);
    expect(sorted).toHaveLength(3);
  });

  it('handles cycles gracefully without throwing', () => {
    // a → b → a (cycle)
    const graph = new Map([
      ['a', ['b']],
      ['b', ['a']],
    ]);

    expect(() => topologicalSort(graph)).not.toThrow();
    const sorted = topologicalSort(graph);
    expect(sorted).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// getModelModuleMap
// ---------------------------------------------------------------------------

describe('getModelModuleMap()', () => {
  it('maps each model to its first module', async () => {
    const models = [
      makeModel({ model: 'res.partner', modules: 'base' }),
      makeModel({ model: 'sale.order', modules: 'sale,sale_management' }),
    ];
    const introspector = makeIntrospector({}, models);

    const map = await getModelModuleMap(['res.partner', 'sale.order'], introspector as any);

    expect(map.get('res.partner')).toBe('base');
    expect(map.get('sale.order')).toBe('sale');
  });

  it('uses empty string when modules field is undefined', async () => {
    const models = [makeModel({ model: 'res.partner', modules: undefined })];
    const introspector = makeIntrospector({}, models);

    const map = await getModelModuleMap(['res.partner'], introspector as any);

    expect(map.get('res.partner')).toBe('');
  });

  it('returns empty map when no models provided', async () => {
    const introspector = makeIntrospector({}, []);
    const map = await getModelModuleMap([], introspector as any);
    expect(map.size).toBe(0);
  });

  it('only includes models in the input list', async () => {
    const models = [
      makeModel({ model: 'res.partner', modules: 'base' }),
      makeModel({ model: 'res.company', modules: 'base' }),
    ];
    const introspector = makeIntrospector({}, models);

    const map = await getModelModuleMap(['res.partner'], introspector as any);

    expect(map.has('res.partner')).toBe(true);
    expect(map.has('res.company')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateModuleDependencies
// ---------------------------------------------------------------------------

describe('validateModuleDependencies()', () => {
  function makeResolvedState(models: string[]): ResolvedState {
    return {
      resources: models.map((model) => ({
        original: { __type: 'resource', model, values: {} },
        model,
        mode: 'create',
        resolvedId: null,
        resolvedValues: {},
      })),
      policies: [],
    };
  }

  function makeClient(installedModules: string[]) {
    return {
      searchRead: vi.fn(async (_model: string, _domain: any[]) => {
        return installedModules.map((name, i) => ({ id: i + 1, name }));
      }),
    };
  }

  it('returns no errors when all modules are installed', async () => {
    const odooModels = [
      makeModel({ model: 'res.partner', modules: 'base' }),
      makeModel({ model: 'sale.order', modules: 'sale' }),
    ];
    const introspector = makeIntrospector({}, odooModels);
    const resolved = makeResolvedState(['res.partner', 'sale.order']);
    const client = makeClient(['base', 'sale']);

    const errors = await validateModuleDependencies(resolved, client, introspector as any);
    expect(errors).toHaveLength(0);
  });

  it('returns error when required module is not installed and not in plan', async () => {
    const odooModels = [makeModel({ model: 'sale.order', modules: 'sale' })];
    const introspector = makeIntrospector({}, odooModels);
    const resolved = makeResolvedState(['sale.order']);
    const client = makeClient([]); // no modules installed

    const errors = await validateModuleDependencies(resolved, client, introspector as any);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/sale/);
  });

  it('passes when required module is in the plan (ir.module.module resource)', async () => {
    const odooModels = [makeModel({ model: 'sale.order', modules: 'sale' })];
    const introspector = makeIntrospector({}, odooModels);

    // The resolved state has both sale.order and an ir.module.module resource
    const resolved: ResolvedState = {
      resources: [
        {
          original: { __type: 'resource', model: 'sale.order', values: {} },
          model: 'sale.order',
          mode: 'create',
          resolvedId: null,
          resolvedValues: {},
        },
        {
          original: { __type: 'resource', model: 'ir.module.module', values: { name: 'sale' } },
          model: 'ir.module.module',
          mode: 'update',
          resolvedId: 10,
          resolvedValues: { name: 'sale' },
        },
      ],
      policies: [],
    };
    const client = makeClient([]); // no modules installed

    const errors = await validateModuleDependencies(resolved, client, introspector as any);
    expect(errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// validateArchiveOrphans
// ---------------------------------------------------------------------------

describe('validateArchiveOrphans()', () => {
  it('passes when model has an active field', async () => {
    const introspector = makeIntrospector({
      'res.partner': [
        makeField({ name: 'active', ttype: 'boolean', model: 'res.partner' }),
        makeField({ name: 'name', ttype: 'char', model: 'res.partner' }),
      ],
    });

    const policies: ModelPolicy[] = [
      { __type: 'model', model: 'res.partner', archiveOrphans: true },
    ];

    const errors = await validateArchiveOrphans(policies, introspector as any);
    expect(errors).toHaveLength(0);
  });

  it('returns error when model does not have an active field', async () => {
    const introspector = makeIntrospector({
      'res.partner': [makeField({ name: 'name', ttype: 'char', model: 'res.partner' })],
    });

    const policies: ModelPolicy[] = [
      { __type: 'model', model: 'res.partner', archiveOrphans: true },
    ];

    const errors = await validateArchiveOrphans(policies, introspector as any);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/res\.partner/);
    expect(errors[0]).toMatch(/active/);
    expect(errors[0]).toMatch(/archiveOrphans/);
  });

  it('ignores policies without archiveOrphans=true', async () => {
    const introspector = makeIntrospector({
      'res.partner': [makeField({ name: 'name', ttype: 'char', model: 'res.partner' })],
    });

    const policies: ModelPolicy[] = [
      { __type: 'model', model: 'res.partner', removeOrphans: true },
    ];

    const errors = await validateArchiveOrphans(policies, introspector as any);
    expect(errors).toHaveLength(0);
  });

  it('handles multiple policies with mix of valid and invalid', async () => {
    const introspector = makeIntrospector({
      'res.partner': [makeField({ name: 'active', ttype: 'boolean', model: 'res.partner' })],
      'sale.order': [makeField({ name: 'name', ttype: 'char', model: 'sale.order' })],
    });

    const policies: ModelPolicy[] = [
      { __type: 'model', model: 'res.partner', archiveOrphans: true },
      { __type: 'model', model: 'sale.order', archiveOrphans: true },
    ];

    const errors = await validateArchiveOrphans(policies, introspector as any);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/sale\.order/);
  });
});
