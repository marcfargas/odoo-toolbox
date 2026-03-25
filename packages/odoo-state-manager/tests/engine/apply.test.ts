import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyPlan } from '../../src/engine/apply';
import type { ApplyClient } from '../../src/engine/apply';
import type { Plan, Operation } from '../../src/engine/types';
import type { ResourceRef } from '../../src/dsl/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClient(): ApplyClient {
  return {
    create: vi.fn().mockResolvedValue(42),
    write: vi.fn().mockResolvedValue(true),
    unlink: vi.fn().mockResolvedValue(true),
    modules: {
      installModule: vi.fn().mockResolvedValue(undefined),
    },
  };
}

function makePlan(operations: Operation[]): Plan {
  return {
    operations,
    summary: {
      installs: operations.filter((o) => o.model === 'ir.module.module').length,
      creates: operations.filter((o) => o.type === 'create' && o.model !== 'ir.module.module')
        .length,
      updates: operations.filter((o) => o.type === 'update').length,
      unlinks: operations.filter((o) => o.type === 'unlink').length,
      archives: operations.filter((o) => o.type === 'archive').length,
      total: operations.length,
      isEmpty: operations.length === 0,
    },
    metadata: {
      timestamp: new Date().toISOString(),
      models: [...new Set(operations.map((o) => o.model))],
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('applyPlan', () => {
  let client: ApplyClient;

  beforeEach(() => {
    client = makeClient();
  });

  // 1. Empty plan
  it('handles empty plan — no-op, succeeded=0', async () => {
    const plan = makePlan([]);
    const result = await applyPlan(plan, client);

    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.results).toHaveLength(0);
    expect(client.create).not.toHaveBeenCalled();
    expect(client.write).not.toHaveBeenCalled();
    expect(client.unlink).not.toHaveBeenCalled();
    expect(client.modules.installModule).not.toHaveBeenCalled();
  });

  // 2. Install operation
  it('calls installModule for ir.module.module create', async () => {
    const plan = makePlan([
      {
        type: 'create',
        model: 'ir.module.module',
        values: { name: 'sale' },
        description: 'sale',
        level: 0,
      },
    ]);
    const result = await applyPlan(plan, client);

    expect(client.modules.installModule).toHaveBeenCalledOnce();
    expect(client.modules.installModule).toHaveBeenCalledWith('sale');
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
  });

  // 3. Create operation records createdId
  it('calls create and records the returned id', async () => {
    vi.mocked(client.create).mockResolvedValue(99);
    const plan = makePlan([
      { type: 'create', model: 'res.partner', values: { name: 'Acme' }, level: 1 },
    ]);
    const result = await applyPlan(plan, client);

    expect(client.create).toHaveBeenCalledOnce();
    expect(client.create).toHaveBeenCalledWith('res.partner', { name: 'Acme' });
    expect(result.succeeded).toBe(1);
    expect(result.results[0].id).toBe(99);
  });

  // 4. Update operation
  it('calls write with correct id and values for update', async () => {
    const plan = makePlan([
      { type: 'update', model: 'res.partner', id: 7, values: { name: 'Updated' }, level: 1 },
    ]);
    const result = await applyPlan(plan, client);

    expect(client.write).toHaveBeenCalledOnce();
    expect(client.write).toHaveBeenCalledWith('res.partner', [7], { name: 'Updated' });
    expect(result.succeeded).toBe(1);
  });

  // 5. Unlink operation
  it('calls unlink for delete/unlink operations', async () => {
    const plan = makePlan([{ type: 'unlink', model: 'res.partner', id: 5, level: 1 }]);
    const result = await applyPlan(plan, client);

    expect(client.unlink).toHaveBeenCalledOnce();
    expect(client.unlink).toHaveBeenCalledWith('res.partner', [5]);
    expect(result.succeeded).toBe(1);
  });

  // 6. Archive operation
  it('calls write with {active: false} for archive', async () => {
    const plan = makePlan([{ type: 'archive', model: 'res.partner', id: 3, level: 1 }]);
    const result = await applyPlan(plan, client);

    expect(client.write).toHaveBeenCalledOnce();
    expect(client.write).toHaveBeenCalledWith('res.partner', [3], { active: false });
    expect(result.succeeded).toBe(1);
  });

  // 7. Level ordering — level 0 before level 1
  it('executes operations in ascending level order', async () => {
    const callOrder: string[] = [];
    vi.mocked(client.modules.installModule).mockImplementation(async () => {
      callOrder.push('install');
    });
    vi.mocked(client.create).mockImplementation(async () => {
      callOrder.push('create');
      return 1;
    });

    const plan = makePlan([
      { type: 'create', model: 'res.partner', values: { name: 'A' }, level: 1 },
      {
        type: 'create',
        model: 'ir.module.module',
        values: { name: 'sale' },
        description: 'sale',
        level: 0,
      },
    ]);
    await applyPlan(plan, client);

    expect(callOrder).toEqual(['install', 'create']);
  });

  // 8. stopOnError=true halts on first failure
  it('halts on first failure when stopOnError=true (default)', async () => {
    vi.mocked(client.create).mockRejectedValueOnce(new Error('Odoo error'));

    const plan = makePlan([
      { type: 'create', model: 'res.partner', values: { name: 'A' }, level: 1 },
      { type: 'create', model: 'res.partner', values: { name: 'B' }, level: 1 },
    ]);
    const result = await applyPlan(plan, client, { stopOnError: true });

    expect(result.failed).toBe(1);
    // Second operation should be skipped
    expect(result.results).toHaveLength(2);
    expect(result.results[1].status).toBe('skipped');
  });

  // 9. stopOnError=false continues after failure
  it('continues after failure when stopOnError=false', async () => {
    vi.mocked(client.create)
      .mockRejectedValueOnce(new Error('Odoo error'))
      .mockResolvedValueOnce(10);

    const plan = makePlan([
      { type: 'create', model: 'res.partner', values: { name: 'A' }, level: 1 },
      { type: 'create', model: 'res.partner', values: { name: 'B' }, level: 1 },
    ]);
    const result = await applyPlan(plan, client, { stopOnError: false });

    expect(result.failed).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(result.results[0].status).toBe('error');
    expect(result.results[1].status).toBe('ok');
  });

  // 10. Progress callback
  it('calls onProgress for each operation', async () => {
    const progress: Array<{ current: number; total: number }> = [];
    const onProgress = vi.fn((current: number, total: number) => {
      progress.push({ current, total });
    });

    const plan = makePlan([
      { type: 'create', model: 'res.partner', values: { name: 'A' }, level: 1 },
      { type: 'create', model: 'res.partner', values: { name: 'B' }, level: 1 },
    ]);
    await applyPlan(plan, client, { onProgress });

    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(progress[0]).toEqual({ current: 1, total: 2 });
    expect(progress[1]).toEqual({ current: 2, total: 2 });
  });

  // 11. ApplyResult has correct counts and duration
  it('returns correct succeeded/failed counts', async () => {
    vi.mocked(client.create).mockResolvedValueOnce(1).mockRejectedValueOnce(new Error('fail'));
    vi.mocked(client.write).mockResolvedValue(true);

    const plan = makePlan([
      { type: 'create', model: 'res.partner', values: { name: 'A' }, level: 1 },
      { type: 'create', model: 'res.partner', values: { name: 'B' }, level: 1 },
      { type: 'update', model: 'res.partner', id: 5, values: { name: 'C' }, level: 1 },
    ]);
    const result = await applyPlan(plan, client, { stopOnError: false });

    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.results).toHaveLength(3);
  });

  // onOperationComplete callback
  it('calls onOperationComplete after each operation', async () => {
    const onOperationComplete = vi.fn();

    const plan = makePlan([
      { type: 'create', model: 'res.partner', values: { name: 'A' }, level: 1 },
    ]);
    await applyPlan(plan, client, { onOperationComplete });

    expect(onOperationComplete).toHaveBeenCalledOnce();
    expect(onOperationComplete.mock.calls[0][0]).toMatchObject({
      status: 'ok',
      id: 42,
    });
  });

  // Batching: unlink batches multiple IDs per model at same level
  it('batches unlink ids for same model at same level', async () => {
    const plan = makePlan([
      { type: 'unlink', model: 'res.partner', id: 1, level: 1 },
      { type: 'unlink', model: 'res.partner', id: 2, level: 1 },
      { type: 'unlink', model: 'res.partner', id: 3, level: 1 },
    ]);
    await applyPlan(plan, client);

    expect(client.unlink).toHaveBeenCalledOnce();
    expect(client.unlink).toHaveBeenCalledWith('res.partner', [1, 2, 3]);
    expect(client.write).not.toHaveBeenCalled();
  });

  // Batching: archive batches multiple IDs per model at same level
  it('batches archive ids for same model at same level', async () => {
    const plan = makePlan([
      { type: 'archive', model: 'res.partner', id: 4, level: 1 },
      { type: 'archive', model: 'res.partner', id: 5, level: 1 },
    ]);
    await applyPlan(plan, client);

    expect(client.write).toHaveBeenCalledOnce();
    expect(client.write).toHaveBeenCalledWith('res.partner', [4, 5], { active: false });
  });

  describe('ResourceRef backfill', () => {
    it('backfills ResourceRef with created ID from earlier level', async () => {
      vi.mocked(client.create)
        .mockResolvedValueOnce(77) // child create (ir.actions.server)
        .mockResolvedValueOnce(1) // ir.model.data create (writeExternalId for child)
        .mockResolvedValueOnce(88); // parent create (ir.cron)

      const ref: ResourceRef = { __type: 'resourceRef', externalId: 'bgbl.my_cron.action' };

      const plan = makePlan([
        {
          type: 'create',
          model: 'ir.actions.server',
          values: { name: 'My Action' },
          level: 1,
          externalId: 'bgbl.my_cron.action',
        },
        {
          type: 'create',
          model: 'ir.cron',
          values: { name: 'My Cron', ir_actions_server_id: ref as unknown as number },
          level: 2,
        },
      ]);
      const result = await applyPlan(plan, client);

      expect(result.succeeded).toBe(2);
      // calls[0] = ir.actions.server create, calls[1] = ir.model.data (writeExternalId), calls[2] = ir.cron create
      const parentCreateCall = vi.mocked(client.create).mock.calls[2];
      expect(parentCreateCall[1]).toEqual({ name: 'My Cron', ir_actions_server_id: 77 });
    });

    it('backfills ResourceRef in update operations', async () => {
      vi.mocked(client.create).mockResolvedValueOnce(77);

      const ref: ResourceRef = { __type: 'resourceRef', externalId: 'bgbl.my_cron.action' };

      const plan = makePlan([
        {
          type: 'create',
          model: 'ir.actions.server',
          values: { name: 'My Action' },
          level: 1,
          externalId: 'bgbl.my_cron.action',
        },
        {
          type: 'update',
          model: 'ir.cron',
          id: 99,
          values: { name: 'My Cron', ir_actions_server_id: ref as unknown as number },
          level: 2,
        },
      ]);
      const result = await applyPlan(plan, client);

      expect(result.succeeded).toBe(2);
      const parentWriteCall = vi.mocked(client.write).mock.calls[0];
      expect(parentWriteCall[2]).toEqual({ name: 'My Cron', ir_actions_server_id: 77 });
    });

    it('backfills ResourceRef from update operations (inline resource already exists)', async () => {
      // Child exists (update mode, id=50), parent is new (create mode)
      vi.mocked(client.create).mockResolvedValueOnce(88); // parent create

      const ref: ResourceRef = { __type: 'resourceRef', externalId: 'bgbl.my_cron.action' };

      const plan = makePlan([
        {
          type: 'update',
          model: 'ir.actions.server',
          id: 50,
          values: { name: 'My Action' },
          level: 1,
          externalId: 'bgbl.my_cron.action',
        },
        {
          type: 'create',
          model: 'ir.cron',
          values: { name: 'My Cron', ir_actions_server_id: ref as unknown as number },
          level: 2,
        },
      ]);
      const result = await applyPlan(plan, client);

      expect(result.succeeded).toBe(2);
      const parentCreateCall = vi.mocked(client.create).mock.calls[0];
      expect(parentCreateCall[1]).toEqual({ name: 'My Cron', ir_actions_server_id: 50 });
    });

    it('backfills ResourceRef from adopt operations', async () => {
      const ref: ResourceRef = { __type: 'resourceRef', externalId: 'bgbl.my_cron.action' };

      vi.mocked(client.create)
        .mockResolvedValueOnce(1) // ir.model.data write for adopt
        .mockResolvedValueOnce(88); // parent create

      const plan = makePlan([
        {
          type: 'adopt',
          model: 'ir.actions.server',
          id: 50,
          level: 1,
          externalId: 'bgbl.my_cron.action',
        },
        {
          type: 'create',
          model: 'ir.cron',
          values: { name: 'My Cron', ir_actions_server_id: ref as unknown as number },
          level: 2,
          externalId: 'bgbl.my_cron',
        },
      ]);
      const result = await applyPlan(plan, client);

      expect(result.succeeded).toBe(2);
      const parentCreateCall = vi.mocked(client.create).mock.calls[1];
      expect(parentCreateCall[1]).toEqual({ name: 'My Cron', ir_actions_server_id: 50 });
    });
  });
});
