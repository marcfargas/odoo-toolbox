import { describe, it, expect, vi } from 'vitest';
import { resource } from '../../src/dsl/resource';
import { lookup } from '../../src/dsl/lookup';
import { flattenChildren } from '../../src/engine/flatten';
import { resolveLookups } from '../../src/engine/resolve';
import type { ResolveClient } from '../../src/engine/resolve';
import type { ModelPolicy } from '../../src/dsl/types';
import { isResourceRef } from '../../src/dsl/types';

const noPolicies: ModelPolicy[] = [];

describe('inline many2one: full pipeline', () => {
  it('cron + server action — first deployment (create mode)', async () => {
    const cron = resource('ir.cron', 'bgbl.my_cron', {
      name: 'My Cron',
      ir_actions_server_id: resource('ir.actions.server', 'action', {
        name: 'My Action',
        state: 'code',
      }),
    });

    const flat = flattenChildren([cron]);
    expect(flat).toHaveLength(2);
    expect(flat[0].model).toBe('ir.actions.server');
    expect(flat[0].externalId).toBe('bgbl.my_cron.action');
    expect(flat[1].model).toBe('ir.cron');
    expect(isResourceRef(flat[1].values.ir_actions_server_id)).toBe(true);

    const searchRead = vi.fn(async () => []);
    const client: ResolveClient = { searchRead };
    const state = await resolveLookups(flat, noPolicies, client);

    expect(state.resources[0].mode).toBe('create');
    expect(state.resources[1].mode).toBe('create');

    const parentField = state.resources[1].resolvedValues.ir_actions_server_id;
    expect(isResourceRef(parentField)).toBe(true);
  });

  it('cron + server action — subsequent run (update mode)', async () => {
    const cron = resource('ir.cron', 'bgbl.my_cron', {
      name: 'My Cron',
      ir_actions_server_id: resource('ir.actions.server', 'action', {
        name: 'My Action',
        state: 'code',
      }),
    });

    const flat = flattenChildren([cron]);

    const searchRead = vi.fn(async (model: string, domain: any[]) => {
      if (model === 'ir.model.data') {
        const names = domain.find((t: any) => t[0] === 'name')?.[2] ?? [];
        const results: any[] = [];
        if (names.includes('my_cron.action')) {
          results.push({
            id: 1,
            module: 'bgbl',
            name: 'my_cron.action',
            model: 'ir.actions.server',
            res_id: 77,
          });
        }
        if (names.includes('my_cron')) {
          results.push({ id: 2, module: 'bgbl', name: 'my_cron', model: 'ir.cron', res_id: 88 });
        }
        return results;
      }
      return [];
    });
    const client: ResolveClient = { searchRead };
    const state = await resolveLookups(flat, noPolicies, client);

    expect(state.resources[0].mode).toBe('update');
    expect(state.resources[0].resolvedId).toBe(77);
    expect(state.resources[1].mode).toBe('update');
    expect(state.resources[1].resolvedId).toBe(88);

    expect(state.resources[1].resolvedValues.ir_actions_server_id).toBe(77);
  });

  it('inline resource coexists with lookup() on other fields', async () => {
    const cron = resource('ir.cron', 'bgbl.my_cron', {
      name: 'My Cron',
      ir_actions_server_id: resource('ir.actions.server', 'action', {
        name: 'My Action',
      }),
      user_id: lookup('res.users', { login: 'admin' }),
    });

    const flat = flattenChildren([cron]);
    expect(flat).toHaveLength(2);

    const searchRead = vi.fn(async (model: string, _domain: any[]) => {
      if (model === 'ir.model.data') return [];
      if (model === 'res.users') return [{ id: 2 }];
      return [];
    });
    const client: ResolveClient = { searchRead };
    const state = await resolveLookups(flat, noPolicies, client);

    expect(state.resources[1].resolvedValues.user_id).toBe(2);
    expect(isResourceRef(state.resources[1].resolvedValues.ir_actions_server_id)).toBe(true);
  });
});
