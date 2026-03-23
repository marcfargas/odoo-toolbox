import { describe, it, expect } from 'vitest';
import { generatePlan } from '../../src/engine/plan';
import type { DiffResult } from '../../src/engine/diff';
import type { ResolvedResource, ResolvedState } from '../../src/engine/types';
import type { ModelPolicy } from '../../src/dsl/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResource(
  model: string,
  mode: 'create' | 'update',
  id: number | null = null,
  values: Record<string, unknown> = {}
): ResolvedResource {
  return {
    original: {
      __type: 'resource',
      model,
      values,
    },
    model,
    mode,
    resolvedId: id,
    resolvedValues: values,
  };
}

function makeDiff(resource: ResolvedResource, hasChanges = true): DiffResult {
  return {
    resource,
    mode: resource.mode,
    changes:
      hasChanges && resource.mode === 'update'
        ? [{ field: 'name', desired: 'new', actual: 'old' }]
        : [],
    hasChanges,
  };
}

function makeResolvedState(resources: ResolvedResource[]): ResolvedState {
  return { resources, policies: [] };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generatePlan', () => {
  it('places ir.module.module creates at level 0', () => {
    const modRes = makeResource('ir.module.module', 'create', null, { name: 'project' });
    const diff = makeDiff(modRes);
    const depGraph = new Map([['ir.module.module', []]]);
    const resolved = makeResolvedState([modRes]);

    const plan = generatePlan([diff], depGraph, resolved, []);

    const installOps = plan.operations.filter((op) => op.level === 0);
    expect(installOps).toHaveLength(1);
    expect(installOps[0].type).toBe('create');
    expect(installOps[0].model).toBe('ir.module.module');
  });

  it('orders records by dependency graph (parent before child)', () => {
    // project.project depends on res.users (many2one)
    // depGraph: project.project → [res.users]
    const userRes = makeResource('res.users', 'create', null, { name: 'Admin' });
    const projRes = makeResource('project.project', 'create', null, { user_id: 1 });

    const diffs = [makeDiff(projRes), makeDiff(userRes)];
    const depGraph = new Map([
      ['res.users', []],
      ['project.project', ['res.users']],
    ]);
    const resolved = makeResolvedState([userRes, projRes]);

    const plan = generatePlan(diffs, depGraph, resolved, []);

    const ops = plan.operations;
    const userIdx = ops.findIndex((op) => op.model === 'res.users');
    const projIdx = ops.findIndex((op) => op.model === 'project.project');

    expect(userIdx).toBeLessThan(projIdx);
  });

  it('places creates before updates within the same level', () => {
    const createRes = makeResource('project.task.type', 'create', null, { name: 'New Stage' });
    const updateRes = makeResource('project.task.type', 'update', 10, { name: 'Done' });

    const diffs = [makeDiff(updateRes), makeDiff(createRes)];
    const depGraph = new Map([['project.task.type', []]]);
    const resolved = makeResolvedState([createRes, updateRes]);

    const plan = generatePlan(diffs, depGraph, resolved, []);

    const ops = plan.operations;
    const createIdx = ops.findIndex((op) => op.type === 'create');
    const updateIdx = ops.findIndex((op) => op.type === 'update');

    expect(createIdx).toBeLessThan(updateIdx);
  });

  it('excludes update-mode resources with no changes from the plan', () => {
    const unchangedRes = makeResource('project.project', 'update', 5, { name: 'Project' });
    const diff: DiffResult = {
      resource: unchangedRes,
      mode: 'update',
      changes: [],
      hasChanges: false,
    };
    const depGraph = new Map([['project.project', []]]);
    const resolved = makeResolvedState([unchangedRes]);

    const plan = generatePlan([diff], depGraph, resolved, []);

    expect(plan.operations).toHaveLength(0);
    expect(plan.summary.isEmpty).toBe(true);
  });

  it('computes correct summary counts', () => {
    const modRes = makeResource('ir.module.module', 'create', null, { name: 'sale' });
    const createRes = makeResource('project.project', 'create', null, { name: 'P1' });
    const createRes2 = makeResource('project.project', 'create', null, { name: 'P2' });
    const updateRes = makeResource('project.task.type', 'update', 10, { name: 'Done' });

    const diffs = [
      makeDiff(modRes),
      makeDiff(createRes),
      makeDiff(createRes2),
      makeDiff(updateRes),
    ];
    const depGraph = new Map([
      ['ir.module.module', []],
      ['project.project', []],
      ['project.task.type', []],
    ]);
    const resolved = makeResolvedState([modRes, createRes, createRes2, updateRes]);

    const plan = generatePlan(diffs, depGraph, resolved, []);

    expect(plan.summary.installs).toBe(1);
    expect(plan.summary.creates).toBe(2);
    expect(plan.summary.updates).toBe(1);
    expect(plan.summary.unlinks).toBe(0);
    expect(plan.summary.archives).toBe(0);
    expect(plan.summary.total).toBe(4);
    expect(plan.summary.isEmpty).toBe(false);
  });

  it('returns empty plan with correct summary when no changes', () => {
    const depGraph = new Map<string, string[]>();
    const resolved = makeResolvedState([]);

    const plan = generatePlan([], depGraph, resolved, []);

    expect(plan.operations).toHaveLength(0);
    expect(plan.summary.total).toBe(0);
    expect(plan.summary.isEmpty).toBe(true);
  });

  it('generates archive operations at final level for archiveOrphans policies', () => {
    const createRes = makeResource('project.task.type', 'create', null, { name: 'Stage' });
    const diff = makeDiff(createRes);
    const depGraph = new Map([['project.task.type', []]]);
    const resolved = makeResolvedState([createRes]);

    const policies: ModelPolicy[] = [
      { __type: 'model', model: 'project.task.type', archiveOrphans: true },
    ];

    const plan = generatePlan([diff], depGraph, resolved, policies);

    const archiveOps = plan.operations.filter((op) => op.type === 'archive');
    expect(archiveOps).toHaveLength(1);
    expect(archiveOps[0].model).toBe('project.task.type');
    expect(plan.summary.archives).toBe(1);
  });

  it('generates unlink operations at final level for removeOrphans policies', () => {
    const createRes = makeResource('project.project', 'create', null, { name: 'Project' });
    const diff = makeDiff(createRes);
    const depGraph = new Map([['project.project', []]]);
    const resolved = makeResolvedState([createRes]);

    const policies: ModelPolicy[] = [
      { __type: 'model', model: 'project.project', removeOrphans: true },
    ];

    const plan = generatePlan([diff], depGraph, resolved, policies);

    const unlinkOps = plan.operations.filter((op) => op.type === 'unlink');
    expect(unlinkOps).toHaveLength(1);
    expect(unlinkOps[0].model).toBe('project.project');
    expect(plan.summary.unlinks).toBe(1);
  });

  it('includes metadata with timestamp and models', () => {
    const createRes = makeResource('project.project', 'create', null, { name: 'P' });
    const diff = makeDiff(createRes);
    const depGraph = new Map([['project.project', []]]);
    const resolved = makeResolvedState([createRes]);

    const plan = generatePlan([diff], depGraph, resolved, []);

    expect(plan.metadata.timestamp).toBeDefined();
    expect(plan.metadata.models).toContain('project.project');
  });
});
