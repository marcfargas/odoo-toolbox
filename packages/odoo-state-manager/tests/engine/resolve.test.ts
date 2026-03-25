import { describe, it, expect, vi } from 'vitest';
import { domainToTuples, resolveLookups } from '../../src/engine/resolve';
import { resource, lookup } from '../../src/dsl';
import type { ModelPolicy } from '../../src/dsl/types';
import type { ResolveClient } from '../../src/engine/resolve';

// ---------------------------------------------------------------------------
// domainToTuples
// ---------------------------------------------------------------------------

describe('domainToTuples()', () => {
  it('passes raw tuple arrays through unchanged', () => {
    const raw = [['name', '=', 'foo']] as [string, string, unknown][];
    expect(domainToTuples(raw)).toStrictEqual(raw);
  });

  it('converts object shorthand to tuples', () => {
    expect(domainToTuples({ name: 'foo', active: true })).toStrictEqual([
      ['name', '=', 'foo'],
      ['active', '=', true],
    ]);
  });

  it('converts empty object to empty array', () => {
    expect(domainToTuples({})).toStrictEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClient(responses: Map<string, any[]>): ResolveClient {
  return {
    searchRead: vi.fn(async (model: string, domain: any[]) => {
      const key = JSON.stringify({ model, domain });
      return responses.get(key) ?? [];
    }),
  };
}

const noPolicies: ModelPolicy[] = [];

// ---------------------------------------------------------------------------
// resolveLookups
// ---------------------------------------------------------------------------

describe('resolveLookups()', () => {
  it('_ref found → update mode with resolvedId', async () => {
    // resource('res.partner', { _ref: lookup(...), name: 'ACME' })
    // values will contain just { name: 'ACME' }; ref is the _ref lookup
    const r = resource('res.partner', {
      _ref: lookup('res.partner', { name: 'ACME' }),
      name: 'ACME',
    });

    const domain = [['name', '=', 'ACME']];
    const responses = new Map([
      [JSON.stringify({ model: 'res.partner', domain }), [{ id: 42, name: 'ACME' }]],
    ]);
    const client = makeClient(responses);

    const state = await resolveLookups([r], noPolicies, client);

    expect(state.resources).toHaveLength(1);
    const resolved = state.resources[0];
    expect(resolved.mode).toBe('update');
    expect(resolved.resolvedId).toBe(42);
    expect(resolved.model).toBe('res.partner');
  });

  it('_ref not found → create mode', async () => {
    const r = resource('res.partner', {
      _ref: lookup('res.partner', { name: 'NewCo' }),
      name: 'NewCo',
    });

    const client = makeClient(new Map()); // returns [] for everything

    const state = await resolveLookups([r], noPolicies, client);

    expect(state.resources[0].mode).toBe('create');
    expect(state.resources[0].resolvedId).toBeNull();
  });

  it('resource without _ref → always create mode', async () => {
    const r = resource('res.partner', { name: 'NoRef' });

    const client = makeClient(new Map());

    const state = await resolveLookups([r], noPolicies, client);

    expect(state.resources[0].mode).toBe('create');
    expect(state.resources[0].resolvedId).toBeNull();
    // searchRead should NOT have been called (no lookups at all)
    expect((client.searchRead as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it('field-level lookup resolved → ID placed in resolvedValues', async () => {
    // resource('sale.order', { partner_id: lookup('res.partner', {...}), note: 'hi' })
    const r = resource('sale.order', {
      partner_id: lookup('res.partner', { name: 'ACME' }),
      note: 'hi',
    });

    const domain = [['name', '=', 'ACME']];
    const responses = new Map([
      [JSON.stringify({ model: 'res.partner', domain }), [{ id: 7, name: 'ACME' }]],
    ]);
    const client = makeClient(responses);

    const state = await resolveLookups([r], noPolicies, client);

    expect(state.resources[0].resolvedValues['partner_id']).toBe(7);
    expect(state.resources[0].resolvedValues['note']).toBe('hi');
  });

  it('field-level lookup not found → throws error', async () => {
    const r = resource('sale.order', {
      partner_id: lookup('res.partner', { name: 'Ghost' }),
    });

    const client = makeClient(new Map()); // returns [] for everything

    await expect(resolveLookups([r], noPolicies, client)).rejects.toThrow(
      /lookup\(.*res\.partner.*\) found nothing/
    );
  });

  it('field-level lookup multi-match → throws error', async () => {
    const r = resource('sale.order', {
      partner_id: lookup('res.partner', { name: 'Dup' }),
    });

    const domain = [['name', '=', 'Dup']];
    const responses = new Map([
      [
        JSON.stringify({ model: 'res.partner', domain }),
        [
          { id: 1, name: 'Dup' },
          { id: 2, name: 'Dup' },
        ],
      ],
    ]);
    const client = makeClient(responses);

    await expect(resolveLookups([r], noPolicies, client)).rejects.toThrow(
      /lookup\(.*res\.partner.*\) matched 2 records, expected exactly 1/
    );
  });

  it('batches identical (model, domain) pairs into exactly one searchRead call', async () => {
    // Two resources that both use the SAME lookup (same model + same domain)
    const sharedLookup = lookup('res.lang', { active: true });
    const r1 = resource('res.partner', { lang_id: sharedLookup });
    const r2 = resource('res.company', { lang_id: sharedLookup });

    const searchRead = vi.fn(async (_model: string, _domain: any[]) => {
      return [{ id: 5 }];
    });
    const client: ResolveClient = { searchRead };

    await resolveLookups([r1, r2], noPolicies, client);

    // Same (model='res.lang', domain=[['active','=',true]]) — only 1 call
    expect(searchRead.mock.calls.length).toBe(1);
  });

  it('two _ref lookups on same model with different domains → 2 searchRead calls', async () => {
    const r1 = resource('res.partner', {
      _ref: lookup('res.partner', { name: 'Alpha' }),
      name: 'Alpha',
    });
    const r2 = resource('res.partner', {
      _ref: lookup('res.partner', { name: 'Beta' }),
      name: 'Beta',
    });

    const searchRead = vi.fn(async (model: string, domain: any[]) => {
      if (model === 'res.partner') {
        const nameFilter = domain.find((t: any) => t[0] === 'name');
        if (nameFilter?.[2] === 'Alpha') return [{ id: 10, name: 'Alpha' }];
        if (nameFilter?.[2] === 'Beta') return [{ id: 20, name: 'Beta' }];
      }
      return [];
    });
    const client: ResolveClient = { searchRead };

    const state = await resolveLookups([r1, r2], noPolicies, client);

    // Two distinct (model, domain) pairs → exactly 2 calls
    expect(searchRead.mock.calls.length).toBe(2);
    expect(state.resources[0].resolvedId).toBe(10);
    expect(state.resources[1].resolvedId).toBe(20);
  });

  it('preserves policies on the returned ResolvedState', async () => {
    const policy: ModelPolicy = { __type: 'model', model: 'project.task', removeOrphans: true };
    const client = makeClient(new Map());
    const state = await resolveLookups([], [policy], client);
    expect(state.policies).toStrictEqual([policy]);
  });

  it('scopes child _ref to parent when parentScope is set', async () => {
    // Simulate a flattened parent + child with parentScope
    const parent = resource('project.project', 'bgbl.fiscal', { name: 'Fiscal' });
    const child: import('../../src/dsl/types').ResourceDefinition = Object.freeze({
      __type: 'resource' as const,
      model: 'project.task.type',
      externalId: 'bgbl.fiscal.nuevo',
      ref: { __type: 'lookup' as const, model: 'project.task.type', domain: { name: 'Nuevo' } },
      values: Object.freeze({ name: 'Nuevo' }),
      parentScope: {
        inverseField: 'project_id',
        parentExternalId: 'bgbl.fiscal',
      },
    });

    const searchRead = vi.fn(async (model: string, domain: any[]) => {
      // ir.model.data: parent exists with res_id=100
      if (model === 'ir.model.data') {
        return [{ id: 1, module: 'bgbl', name: 'fiscal', model: 'project.project', res_id: 100 }];
      }
      // Scoped child _ref: should include project_id=100
      if (model === 'project.task.type') {
        const hasScope = domain.some((t: any) => t[0] === 'project_id' && t[2] === 100);
        if (hasScope) return [{ id: 200 }];
        return []; // unscoped would return nothing
      }
      return [];
    });
    const client: ResolveClient = { searchRead };

    const state = await resolveLookups([parent, child], noPolicies, client);

    // Parent resolved via external ID
    expect(state.resources[0].mode).toBe('update');
    expect(state.resources[0].resolvedId).toBe(100);

    // Child resolved via scoped _ref (adopted)
    expect(state.resources[1].mode).toBe('update');
    expect(state.resources[1].resolvedId).toBe(200);
    expect(state.resources[1].needsAdoption).toBe(true);
  });

  it('child _ref falls through to create when parent is not found', async () => {
    const parent = resource('project.project', 'bgbl.fiscal', { name: 'Fiscal' });
    const child: import('../../src/dsl/types').ResourceDefinition = Object.freeze({
      __type: 'resource' as const,
      model: 'project.task.type',
      externalId: 'bgbl.fiscal.nuevo',
      ref: { __type: 'lookup' as const, model: 'project.task.type', domain: { name: 'Nuevo' } },
      values: Object.freeze({ name: 'Nuevo' }),
      parentScope: {
        inverseField: 'project_id',
        parentExternalId: 'bgbl.fiscal',
      },
    });

    const searchRead = vi.fn(async () => []);
    const client: ResolveClient = { searchRead };

    const state = await resolveLookups([parent, child], noPolicies, client);

    // Both parent and child are new
    expect(state.resources[0].mode).toBe('create');
    expect(state.resources[1].mode).toBe('create');
    expect(state.resources[1].resolvedId).toBeNull();
  });
});
