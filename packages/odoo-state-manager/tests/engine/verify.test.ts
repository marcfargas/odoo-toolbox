import { describe, it, expect } from 'vitest';
import type { ApplyResult } from '../../src/engine/types';

describe('apply with verification', () => {
  it('ApplyResult can contain a drift Plan', () => {
    const result: ApplyResult = {
      results: [],
      succeeded: 1,
      failed: 0,
      drift: {
        operations: [
          {
            type: 'update',
            model: 'mail.template',
            id: 42,
            values: { body_html: '<p>sanitized</p>' },
            description: 'drift',
            level: 1,
            changes: [
              {
                field: 'body_html',
                desired: '<p style="color:red">Hi</p>',
                actual: '<p>sanitized</p>',
              },
            ],
          },
        ],
        summary: {
          installs: 0,
          creates: 0,
          updates: 1,
          unlinks: 0,
          archives: 0,
          adopts: 0,
          total: 1,
          isEmpty: false,
        },
        metadata: { timestamp: new Date().toISOString(), models: ['mail.template'] },
      },
    };

    expect(result.drift).toBeDefined();
    expect(result.drift!.summary.isEmpty).toBe(false);
    expect(result.drift!.operations).toHaveLength(1);
  });

  it('ApplyResult without drift has undefined drift field', () => {
    const result: ApplyResult = {
      results: [],
      succeeded: 1,
      failed: 0,
    };

    expect(result.drift).toBeUndefined();
  });
});
