import { describe, it, expect, vi } from 'vitest';
import { resource } from '../../src/dsl/resource';
import { lookup } from '../../src/dsl/lookup';
import { resolveLookups, parseExternalId } from '../../src/engine/resolve';
import { generatePlan } from '../../src/engine/plan';
import { formatPlan } from '../../src/engine/format';
import { applyPlan } from '../../src/engine/apply';
import type { DiffResult } from '../../src/engine/diff';
import type { ResolvedResource, Plan } from '../../src/engine/types';

// ---------------------------------------------------------------------------
// parseExternalId
// ---------------------------------------------------------------------------

describe('parseExternalId()', () => {
  it('splits module.name', () => {
    expect(parseExternalId('bgbl.fiscal_project')).toEqual({
      module: 'bgbl',
      name: 'fiscal_project',
    });
  });

  it('handles nested names (children)', () => {
    expect(parseExternalId('bgbl.fiscal_project.nuevo')).toEqual({
      module: 'bgbl',
      name: 'fiscal_project.nuevo',
    });
  });

  it('throws for IDs without a dot', () => {
    expect(() => parseExternalId('nodot')).toThrow('must contain a dot');
  });
});

// ---------------------------------------------------------------------------
// resource() with externalId
// ---------------------------------------------------------------------------

describe('resource() with externalId', () => {
  it('creates a resource with externalId', () => {
    const res = resource('project.project', 'bgbl.fiscal', { name: 'Fiscal' });
    expect(res.externalId).toBe('bgbl.fiscal');
    expect(res.model).toBe('project.project');
    expect(res.values.name).toBe('Fiscal');
  });

  it('creates a resource without externalId (backwards compatible)', () => {
    const res = resource('project.project', { name: 'Fiscal' });
    expect(res.externalId).toBeUndefined();
    expect(res.values.name).toBe('Fiscal');
  });

  it('supports both externalId and _ref', () => {
    const res = resource('project.project', 'bgbl.fiscal', {
      _ref: lookup('project.project', { name: 'Fiscal' }),
      name: 'Fiscal',
    });
    expect(res.externalId).toBe('bgbl.fiscal');
    expect(res.ref).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// resolveLookups with external IDs
// ---------------------------------------------------------------------------

describe('resolveLookups() with external IDs', () => {
  function makeClient(
    irModelData: Array<{
      id: number;
      module: string;
      name: string;
      model: string;
      res_id: number;
    }> = [],
    recordData: Record<string, Array<{ id: number }>> = {}
  ) {
    return {
      searchRead: vi.fn(async (model: string, domain: any[]) => {
        if (model === 'ir.model.data') {
          // Filter by module and name
          const moduleFilter = domain.find((d: any) => d[0] === 'module')?.[2];
          const nameFilter = domain.find((d: any) => d[0] === 'name')?.[2];
          return irModelData.filter(
            (r) =>
              r.module === moduleFilter &&
              (Array.isArray(nameFilter) ? nameFilter.includes(r.name) : r.name === nameFilter)
          );
        }
        return recordData[model] ?? [];
      }),
    };
  }

  it('resolves resource via external ID from ir.model.data', async () => {
    const res = resource('project.project', 'bgbl.fiscal', { name: 'Fiscal' });
    const client = makeClient([
      { id: 1, module: 'bgbl', name: 'fiscal', model: 'project.project', res_id: 1004 },
    ]);

    const result = await resolveLookups([res], [], client);

    expect(result.resources[0].mode).toBe('update');
    expect(result.resources[0].resolvedId).toBe(1004);
    expect(result.resources[0].externalId).toBe('bgbl.fiscal');
    expect(result.resources[0].needsAdoption).toBeFalsy();
  });

  it('falls back to _ref when external ID not found, marks for adoption', async () => {
    const res = resource('project.project', 'bgbl.fiscal', {
      _ref: lookup('project.project', { name: 'Fiscal' }),
      name: 'Fiscal',
    });
    const client = makeClient(
      [], // no ir.model.data entries
      { 'project.project': [{ id: 1004 }] }
    );

    const result = await resolveLookups([res], [], client);

    expect(result.resources[0].mode).toBe('update');
    expect(result.resources[0].resolvedId).toBe(1004);
    expect(result.resources[0].needsAdoption).toBe(true);
  });

  it('falls through to create when neither external ID nor _ref match', async () => {
    const res = resource('project.project', 'bgbl.fiscal', {
      _ref: lookup('project.project', { name: 'Nonexistent' }),
      name: 'Fiscal',
    });
    const client = makeClient();

    const result = await resolveLookups([res], [], client);

    expect(result.resources[0].mode).toBe('create');
    expect(result.resources[0].resolvedId).toBeNull();
    expect(result.resources[0].externalId).toBe('bgbl.fiscal');
  });

  it('throws on duplicate external IDs', async () => {
    const res1 = resource('project.project', 'bgbl.fiscal', { name: 'A' });
    const res2 = resource('project.project', 'bgbl.fiscal', { name: 'B' });
    const client = makeClient();

    await expect(resolveLookups([res1, res2], [], client)).rejects.toThrow('Duplicate external ID');
  });

  it('throws when external ID model mismatches', async () => {
    const res = resource('project.project', 'bgbl.fiscal', { name: 'Fiscal' });
    const client = makeClient([
      { id: 1, module: 'bgbl', name: 'fiscal', model: 'res.partner', res_id: 42 },
    ]);

    await expect(resolveLookups([res], [], client)).rejects.toThrow('points to res.partner');
  });

  it('resources without externalId still resolve via _ref as before', async () => {
    const res = resource('project.project', {
      _ref: lookup('project.project', { name: 'Fiscal' }),
      name: 'Fiscal',
    });
    const client = makeClient([], { 'project.project': [{ id: 1004 }] });

    const result = await resolveLookups([res], [], client);

    expect(result.resources[0].mode).toBe('update');
    expect(result.resources[0].resolvedId).toBe(1004);
    expect(result.resources[0].externalId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Plan generation with adopt
// ---------------------------------------------------------------------------

describe('generatePlan() with external IDs', () => {
  function makeDiffResult(
    overrides: Partial<ResolvedResource> & { mode?: 'create' | 'update'; hasChanges?: boolean }
  ): DiffResult {
    const resource: ResolvedResource = {
      original: {
        __type: 'resource',
        model: overrides.model ?? 'project.project',
        values: {},
      },
      model: overrides.model ?? 'project.project',
      mode: overrides.mode ?? 'create',
      resolvedId: overrides.resolvedId ?? null,
      resolvedValues: overrides.resolvedValues ?? { name: 'Test' },
      externalId: overrides.externalId,
      needsAdoption: overrides.needsAdoption,
    };
    return {
      resource,
      mode: resource.mode,
      changes: [],
      hasChanges: overrides.hasChanges ?? true,
    };
  }

  it('generates adopt operation for resources needing adoption', () => {
    const diff = makeDiffResult({
      mode: 'update',
      resolvedId: 1004,
      externalId: 'bgbl.fiscal',
      needsAdoption: true,
      hasChanges: false,
    });

    const plan = generatePlan(
      [diff],
      new Map([['project.project', []]]),
      { resources: [diff.resource], policies: [] },
      []
    );

    const adoptOps = plan.operations.filter((op) => op.type === 'adopt');
    expect(adoptOps).toHaveLength(1);
    expect(adoptOps[0].externalId).toBe('bgbl.fiscal');
    expect(adoptOps[0].id).toBe(1004);
    expect(plan.summary.adopts).toBe(1);
  });

  it('includes externalId on create operations', () => {
    const diff = makeDiffResult({
      mode: 'create',
      externalId: 'bgbl.fiscal',
    });

    const plan = generatePlan(
      [diff],
      new Map([['project.project', []]]),
      { resources: [diff.resource], policies: [] },
      []
    );

    const createOps = plan.operations.filter((op) => op.type === 'create');
    expect(createOps).toHaveLength(1);
    expect(createOps[0].externalId).toBe('bgbl.fiscal');
  });

  it('does not generate update op when adopted resource has no field changes', () => {
    const diff = makeDiffResult({
      mode: 'update',
      resolvedId: 1004,
      externalId: 'bgbl.fiscal',
      needsAdoption: true,
      hasChanges: false,
    });

    const plan = generatePlan(
      [diff],
      new Map([['project.project', []]]),
      { resources: [diff.resource], policies: [] },
      []
    );

    const updateOps = plan.operations.filter((op) => op.type === 'update');
    expect(updateOps).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Format with external IDs
// ---------------------------------------------------------------------------

describe('formatPlan() with external IDs', () => {
  it('shows external ID in operation header', () => {
    const plan: Plan = {
      operations: [
        {
          type: 'create',
          model: 'project.project',
          values: { name: 'Fiscal' },
          description: 'Fiscal',
          level: 1,
          externalId: 'bgbl.fiscal',
        },
      ],
      summary: {
        installs: 0,
        creates: 1,
        updates: 0,
        unlinks: 0,
        archives: 0,
        adopts: 0,
        total: 1,
        isEmpty: false,
      },
      metadata: { timestamp: '', models: ['project.project'] },
    };

    const output = formatPlan(plan, false);
    expect(output).toContain('[bgbl.fiscal]');
  });

  it('shows adopt operation with * symbol', () => {
    const plan: Plan = {
      operations: [
        {
          type: 'adopt',
          model: 'project.project',
          id: 1004,
          description: 'Fiscal',
          level: 1,
          externalId: 'bgbl.fiscal',
        },
      ],
      summary: {
        installs: 0,
        creates: 0,
        updates: 0,
        unlinks: 0,
        archives: 0,
        adopts: 1,
        total: 1,
        isEmpty: false,
      },
      metadata: { timestamp: '', models: ['project.project'] },
    };

    const output = formatPlan(plan, false);
    expect(output).toContain('* project.project');
    expect(output).toContain('[bgbl.fiscal]');
    expect(output).toContain('Binding external ID to existing record #1004');
  });

  it('shows adopt count in summary', () => {
    const plan: Plan = {
      operations: [{ type: 'adopt', model: 'x', id: 1, level: 1, externalId: 'a.b' }],
      summary: {
        installs: 0,
        creates: 0,
        updates: 0,
        unlinks: 0,
        archives: 0,
        adopts: 1,
        total: 1,
        isEmpty: false,
      },
      metadata: { timestamp: '', models: ['x'] },
    };

    const output = formatPlan(plan, false);
    expect(output).toContain('1 to adopt');
  });
});

// ---------------------------------------------------------------------------
// Apply with external IDs
// ---------------------------------------------------------------------------

describe('applyPlan() with external IDs', () => {
  function makeClient() {
    let nextId = 100;
    return {
      create: vi.fn(async () => nextId++),
      write: vi.fn(async () => true),
      unlink: vi.fn(async () => true),
      modules: { installModule: vi.fn(async () => {}) },
    };
  }

  it('writes ir.model.data on create with externalId', async () => {
    const client = makeClient();
    const plan: Plan = {
      operations: [
        {
          type: 'create',
          model: 'project.project',
          values: { name: 'Fiscal' },
          level: 1,
          externalId: 'bgbl.fiscal',
        },
      ],
      summary: {
        installs: 0,
        creates: 1,
        updates: 0,
        unlinks: 0,
        archives: 0,
        adopts: 0,
        total: 1,
        isEmpty: false,
      },
      metadata: { timestamp: '', models: ['project.project'] },
    };

    const result = await applyPlan(plan, client);

    expect(result.succeeded).toBe(1);

    // First create: the project.project record
    const calls = client.create.mock.calls;
    expect(calls[0][0]).toBe('project.project');

    // Second create: ir.model.data entry
    expect(calls[1][0]).toBe('ir.model.data');
    expect(calls[1][1]).toEqual({
      module: 'bgbl',
      name: 'fiscal',
      model: 'project.project',
      res_id: 100, // auto-incremented ID from mock
      noupdate: true,
    });
  });

  it('writes ir.model.data on adopt', async () => {
    const client = makeClient();
    const plan: Plan = {
      operations: [
        {
          type: 'adopt',
          model: 'project.project',
          id: 1004,
          level: 1,
          externalId: 'bgbl.fiscal',
        },
      ],
      summary: {
        installs: 0,
        creates: 0,
        updates: 0,
        unlinks: 0,
        archives: 0,
        adopts: 1,
        total: 1,
        isEmpty: false,
      },
      metadata: { timestamp: '', models: ['project.project'] },
    };

    const result = await applyPlan(plan, client);

    expect(result.succeeded).toBe(1);

    // Should create ir.model.data entry with the existing record ID
    const calls = client.create.mock.calls;
    expect(calls[0][0]).toBe('ir.model.data');
    expect(calls[0][1]).toEqual({
      module: 'bgbl',
      name: 'fiscal',
      model: 'project.project',
      res_id: 1004,
      noupdate: true,
    });
  });

  it('does not write ir.model.data for create without externalId', async () => {
    const client = makeClient();
    const plan: Plan = {
      operations: [
        {
          type: 'create',
          model: 'project.project',
          values: { name: 'Fiscal' },
          level: 1,
        },
      ],
      summary: {
        installs: 0,
        creates: 1,
        updates: 0,
        unlinks: 0,
        archives: 0,
        adopts: 0,
        total: 1,
        isEmpty: false,
      },
      metadata: { timestamp: '', models: ['project.project'] },
    };

    await applyPlan(plan, client);

    // Only one create call (the record itself, no ir.model.data)
    expect(client.create.mock.calls).toHaveLength(1);
  });
});
