import { describe, it, expect, vi } from 'vitest';
import { applyPlan } from '../../src/engine/apply';
import type { ApplyClient } from '../../src/engine/apply';
import type { Plan, Operation } from '../../src/engine/types';

function makeClient(): ApplyClient {
  return {
    create: vi.fn().mockResolvedValue(42),
    write: vi.fn().mockResolvedValue(true),
    unlink: vi.fn().mockResolvedValue(true),
    modules: { installModule: vi.fn().mockResolvedValue(undefined) },
  };
}

function makePlan(operations: Operation[]): Plan {
  return {
    operations,
    summary: {
      installs: 0,
      creates: 0,
      updates: 0,
      unlinks: 0,
      archives: 0,
      adopts: 0,
      total: operations.length,
      isEmpty: false,
    },
    metadata: { timestamp: new Date().toISOString(), models: ['mail.template'] },
  };
}

describe('applyPlan with translations', () => {
  it('writes translations after create using context: { lang }', async () => {
    const client = makeClient();
    const op: Operation = {
      type: 'create',
      model: 'mail.template',
      values: { subject: 'Hola' },
      level: 1,
      externalId: 'mymod.welcome',
      translations: [
        { field: 'subject', lang: 'en_UK', value: 'Hello' },
        { field: 'subject', lang: 'ca_CA', value: 'Hola (cat)' },
      ],
    };

    const plan = makePlan([op]);
    await applyPlan(plan, client);

    // Primary create call
    expect(client.create).toHaveBeenCalledWith('mail.template', { subject: 'Hola' });

    // Translation writes with context
    expect(client.write).toHaveBeenCalledWith(
      'mail.template',
      [42],
      { subject: 'Hello' },
      { lang: 'en_UK' }
    );
    expect(client.write).toHaveBeenCalledWith(
      'mail.template',
      [42],
      { subject: 'Hola (cat)' },
      { lang: 'ca_CA' }
    );
  });

  it('writes translations after update using context: { lang }', async () => {
    const client = makeClient();
    const op: Operation = {
      type: 'update',
      model: 'mail.template',
      id: 10,
      values: { subject: 'Hola actualizado' },
      level: 1,
      translations: [{ field: 'subject', lang: 'en_UK', value: 'Updated Hello' }],
    };

    const plan = makePlan([op]);
    await applyPlan(plan, client);

    // Primary update
    expect(client.write).toHaveBeenCalledWith('mail.template', [10], {
      subject: 'Hola actualizado',
    });

    // Translation write
    expect(client.write).toHaveBeenCalledWith(
      'mail.template',
      [10],
      { subject: 'Updated Hello' },
      { lang: 'en_UK' }
    );
  });

  it('skips translation writes when no translations on operation', async () => {
    const client = makeClient();
    const op: Operation = {
      type: 'create',
      model: 'mail.template',
      values: { subject: 'Hola' },
      level: 1,
      externalId: 'mymod.t1',
    };

    const plan = makePlan([op]);
    await applyPlan(plan, client);

    // Only the external ID write call, no translation writes with lang context
    const writeCalls = (client.write as any).mock.calls;
    const contextCalls = writeCalls.filter((c: any[]) => c[3] && c[3].lang);
    expect(contextCalls).toHaveLength(0);
  });
});
