import { describe, it, expect } from 'vitest';
import { resolve } from 'path';
import { evaluate } from '../../src/engine';

const fixturesDir = resolve(__dirname, 'fixtures');

describe('evaluate()', () => {
  it('collects ResourceDefinitions from .ts files', async () => {
    const result = await evaluate(fixturesDir);
    expect(result.resources.length).toBeGreaterThanOrEqual(3); // 2 from modules, 1 from project
    const models = result.resources.map((r) => r.model);
    expect(models).toContain('ir.module.module');
    expect(models).toContain('project.project');
  });

  it('collects ModelPolicies from .ts files', async () => {
    const result = await evaluate(fixturesDir);
    expect(result.policies.length).toBe(1);
    expect(result.policies[0].model).toBe('project.task.type');
    expect(result.policies[0].removeOrphans).toBe(true);
  });

  it('handles default exports that are arrays (from .map() patterns)', async () => {
    const result = await evaluate(fixturesDir);
    const moduleResources = result.resources.filter((r) => r.model === 'ir.module.module');
    expect(moduleResources).toHaveLength(2);
    const names = moduleResources.map((r) => r.values['name']);
    expect(names).toContain('project');
    expect(names).toContain('sale');
  });

  it('records which files were evaluated', async () => {
    const result = await evaluate(fixturesDir);
    expect(result.files.length).toBe(3);
    const basenames = result.files.map((f) => f.replace(/\\/g, '/').split('/').pop());
    expect(basenames).toContain('cleanup.ts');
    expect(basenames).toContain('modules.ts');
    expect(basenames).toContain('project.ts');
  });

  it('returns files sorted', async () => {
    const result = await evaluate(fixturesDir);
    const sorted = [...result.files].sort();
    expect(result.files).toEqual(sorted);
  });
});
