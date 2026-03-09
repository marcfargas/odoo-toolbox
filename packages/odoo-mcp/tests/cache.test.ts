import { describe, expect, it } from 'vitest';
import { McpCache } from '../src/cache';

describe('McpCache', () => {
  it('caches model list with TTL and invalidates', async () => {
    let now = 1_000;
    let calls = 0;

    const introspector = {
      getModels: async () => {
        calls += 1;
        return [{ id: calls, model: 'res.partner', name: 'Partner', transient: false }];
      },
    };

    const cache = new McpCache(introspector as any, () => now);

    const first = await cache.getModels();
    const second = await cache.getModels();

    expect(first).toEqual(second);
    expect(calls).toBe(1);

    now += 5 * 60 * 1000 + 1;
    const third = await cache.getModels();
    expect(calls).toBe(2);
    expect(third[0].id).toBe(2);

    cache.invalidateAll();
    await cache.getModels();
    expect(calls).toBe(3);
  });

  it('uses schema cache entries per model', async () => {
    let calls = 0;
    const cache = new McpCache({ getModels: async () => [] } as any);

    const fetchSchema = async () => {
      calls += 1;
      return [{ name: 'name' }];
    };

    const first = await cache.getSchema('res.partner', fetchSchema);
    const second = await cache.getSchema('res.partner', fetchSchema);

    expect(first).toEqual(second);
    expect(calls).toBe(1);
  });
});
