import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provisionProjects } from '../../src/provisioners/projects';
import type { ProvisionerClient } from '../../src/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal ProvisionerClient mock with a sequential ID counter. */
function makeMockClient(): ProvisionerClient {
  let nextId = 1;
  return {
    create: vi.fn(async (_model: string, _values: Record<string, any>) => nextId++),
    search: vi.fn(async () => [] as number[]),
    searchRead: vi.fn(async () => [] as any[]),
    write: vi.fn(async () => true),
    modules: {
      isModuleInstalled: vi.fn(async () => false),
      installModule: vi.fn(async () => {}),
    },
  } as ProvisionerClient;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('provisionProjects', () => {
  let client: ProvisionerClient;

  beforeEach(() => {
    client = makeMockClient();
  });

  it('returns empty refs when no projects are configured', async () => {
    const result = await provisionProjects(client, []);
    expect(result.projects).toEqual({});
    expect(result.tasks).toEqual({});
    expect(client.create).not.toHaveBeenCalled();
  });

  it('creates a project record and maps name → id', async () => {
    const result = await provisionProjects(client, [{ name: 'Alpha' }]);
    expect(result.projects['Alpha']).toBe(1);
    expect(client.create).toHaveBeenCalledWith('project.project', { name: 'Alpha' });
  });

  it('creates stages in order with correct sequence', async () => {
    await provisionProjects(client, [{ name: 'Beta', stages: ['Backlog', 'In Progress', 'Done'] }]);

    const stageCalls = (client.create as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([model]: [string]) => model === 'project.task.type'
    );

    expect(stageCalls).toHaveLength(3);
    expect(stageCalls[0][1]).toMatchObject({ name: 'Backlog', sequence: 10 });
    expect(stageCalls[1][1]).toMatchObject({ name: 'In Progress', sequence: 20 });
    expect(stageCalls[2][1]).toMatchObject({ name: 'Done', sequence: 30 });
  });

  it('links stages to the correct project via many2many command', async () => {
    // project gets id=1, first stage gets id=2
    await provisionProjects(client, [{ name: 'Gamma', stages: ['Todo'] }]);

    const stageCall = (client.create as ReturnType<typeof vi.fn>).mock.calls.find(
      ([model]: [string]) => model === 'project.task.type'
    );

    expect(stageCall).toBeDefined();
    // project_ids should use many2many (4, projectId) to link
    expect(stageCall![1].project_ids).toEqual([[4, 1]]);
  });

  it('creates tasks inside the project with the correct project_id', async () => {
    await provisionProjects(client, [
      { name: 'Delta', stages: ['Todo'], tasks: [{ name: 'Task A', stage: 'Todo' }] },
    ]);

    const taskCall = (client.create as ReturnType<typeof vi.fn>).mock.calls.find(
      ([model]: [string]) => model === 'project.task'
    );

    expect(taskCall).toBeDefined();
    expect(taskCall![1].name).toBe('Task A');
    expect(taskCall![1].project_id).toBe(1); // first create → id 1
  });

  it('resolves task stage_id to the stage created for this project', async () => {
    // ids: project=1, stage=2, task=3
    await provisionProjects(client, [
      { name: 'Epsilon', stages: ['Done'], tasks: [{ name: 'T1', stage: 'Done' }] },
    ]);

    const taskCall = (client.create as ReturnType<typeof vi.fn>).mock.calls.find(
      ([model]: [string]) => model === 'project.task'
    );

    expect(taskCall![1].stage_id).toBe(2); // second create call
  });

  it('throws when a task references a stage not defined in the project', async () => {
    await expect(
      provisionProjects(client, [
        { name: 'Zeta', stages: ['Open'], tasks: [{ name: 'T', stage: 'Missing' }] },
      ])
    ).rejects.toThrow(/stage "Missing"/i);
  });

  it('creates tasks without stage_id when no stage is specified', async () => {
    await provisionProjects(client, [{ name: 'Eta', tasks: [{ name: 'Stageless Task' }] }]);

    const taskCall = (client.create as ReturnType<typeof vi.fn>).mock.calls.find(
      ([model]: [string]) => model === 'project.task'
    );

    expect(taskCall![1].stage_id).toBeUndefined();
  });

  it('populates tasks refs keyed by task name', async () => {
    const result = await provisionProjects(client, [
      { name: 'Theta', stages: ['Open'], tasks: [{ name: 'My Task', stage: 'Open' }] },
    ]);

    expect(Object.keys(result.tasks)).toContain('My Task');
    expect(typeof result.tasks['My Task']).toBe('number');
  });

  it('provisions multiple projects independently', async () => {
    const result = await provisionProjects(client, [
      { name: 'P1', stages: ['Todo'] },
      { name: 'P2', stages: ['Open', 'Closed'] },
    ]);

    expect(Object.keys(result.projects)).toEqual(['P1', 'P2']);
    // P1 project + 1 stage + P2 project + 2 stages = 5 creates
    expect(client.create).toHaveBeenCalledTimes(5);
  });
});
