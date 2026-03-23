import { describe, it, expect } from 'vitest';
import { formatPlan } from '../../src/engine/format';
import type { Plan, Operation } from '../../src/engine/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlan(operations: Operation[]): Plan {
  const installs = operations.filter(
    (op) => op.type === 'create' && op.model === 'ir.module.module'
  ).length;
  const creates = operations.filter(
    (op) => op.type === 'create' && op.model !== 'ir.module.module'
  ).length;
  const updates = operations.filter((op) => op.type === 'update').length;
  const unlinks = operations.filter((op) => op.type === 'unlink').length;
  const archives = operations.filter((op) => op.type === 'archive').length;
  const total = operations.length;

  return {
    operations,
    summary: {
      installs,
      creates,
      updates,
      unlinks,
      archives,
      total,
      isEmpty: total === 0,
    },
    metadata: {
      timestamp: new Date().toISOString(),
      models: [...new Set(operations.map((op) => op.model))],
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('formatPlan', () => {
  it('formats create operation with + symbol', () => {
    const plan = makePlan([
      {
        type: 'create',
        model: 'project.project',
        values: { name: 'Censos', user_id: 42 },
        description: 'Censos',
        level: 1,
      },
    ]);

    const output = formatPlan(plan, false);

    expect(output).toContain('+ project.project');
    expect(output).toContain('"Censos"');
    expect(output).toContain('name: "Censos"');
    expect(output).toContain('user_id: 42');
  });

  it('formats update operation with ~ and field changes', () => {
    const plan = makePlan([
      {
        type: 'update',
        model: 'project.task.type',
        id: 10,
        description: 'Done',
        level: 1,
        changes: [{ field: 'fold', desired: true, actual: false }],
      },
    ]);

    const output = formatPlan(plan, false);

    expect(output).toContain('~ project.task.type');
    expect(output).toContain('"Done"');
    expect(output).toContain('~ fold:');
    expect(output).toContain('false');
    expect(output).toContain('true');
  });

  it('formats unlink operation with - symbol', () => {
    const plan = makePlan([
      {
        type: 'unlink',
        model: 'project.task.type',
        id: 5,
        description: 'Obsolete Stage',
        level: 2,
      },
    ]);

    const output = formatPlan(plan, false);

    expect(output).toContain('- project.task.type');
    expect(output).toContain('"Obsolete Stage"');
  });

  it('formats archive operation with ! symbol', () => {
    const plan = makePlan([
      {
        type: 'archive',
        model: 'project.task.type',
        id: 5,
        description: 'Old Stage',
        level: 2,
      },
    ]);

    const output = formatPlan(plan, false);

    expect(output).toContain('! project.task.type');
    expect(output).toContain('"Old Stage"');
  });

  it('shows summary line with correct counts', () => {
    const plan = makePlan([
      {
        type: 'create',
        model: 'ir.module.module',
        values: { name: 'project' },
        description: 'project',
        level: 0,
      },
      {
        type: 'create',
        model: 'project.project',
        values: { name: 'P1' },
        description: 'P1',
        level: 1,
      },
      {
        type: 'create',
        model: 'project.project',
        values: { name: 'P2' },
        description: 'P2',
        level: 1,
      },
      {
        type: 'update',
        model: 'project.task.type',
        id: 10,
        description: 'Done',
        level: 1,
        changes: [{ field: 'fold', desired: true, actual: false }],
      },
      {
        type: 'unlink',
        model: 'project.task.type',
        id: 99,
        description: 'Old',
        level: 2,
      },
    ]);

    const output = formatPlan(plan, false);

    expect(output).toContain('Plan:');
    expect(output).toContain('1 to install');
    expect(output).toContain('2 to create');
    expect(output).toContain('1 to update');
    expect(output).toContain('1 to remove');
  });

  it('shows "No changes" for empty plan', () => {
    const plan = makePlan([]);

    const output = formatPlan(plan, false);

    expect(output).toContain('No changes');
  });

  it('produces no ANSI codes when colorize=false', () => {
    const plan = makePlan([
      {
        type: 'create',
        model: 'project.project',
        values: { name: 'P' },
        description: 'P',
        level: 1,
      },
      {
        type: 'update',
        model: 'project.task.type',
        id: 1,
        description: 'T',
        level: 1,
        changes: [{ field: 'fold', desired: true, actual: false }],
      },
      {
        type: 'unlink',
        model: 'project.task.type',
        id: 2,
        description: 'Del',
        level: 2,
      },
    ]);

    const output = formatPlan(plan, false);

    // ANSI escape codes start with ESC[
    // eslint-disable-next-line no-control-regex
    expect(output).not.toMatch(/\x1b\[/);
  });

  it('uses ANSI codes when colorize=true', () => {
    const plan = makePlan([
      {
        type: 'create',
        model: 'project.project',
        values: { name: 'P' },
        description: 'P',
        level: 1,
      },
    ]);

    const output = formatPlan(plan, true);

    // eslint-disable-next-line no-control-regex
    expect(output).toMatch(/\x1b\[/);
  });

  it('formats install operation with + symbol at level 0', () => {
    const plan = makePlan([
      {
        type: 'create',
        model: 'ir.module.module',
        values: { name: 'project' },
        description: 'project',
        level: 0,
      },
    ]);

    const output = formatPlan(plan, false);

    expect(output).toContain('+ ir.module.module');
    expect(output).toContain('"project"');
    expect(output).toContain('1 to install');
  });
});
