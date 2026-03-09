import { describe, expect, it } from 'vitest';
import { allows, DEFAULT_POLICY, normalizePolicy } from '../src/policy';

describe('policy', () => {
  it('uses read-only default policy', () => {
    expect(allows(DEFAULT_POLICY, 'res.partner', 'read')).toBe(true);
    expect(allows(DEFAULT_POLICY, 'res.partner', 'write')).toBe(false);
  });

  it('applies first-match-wins rule order', () => {
    const policy = normalizePolicy([
      { model: 'sale.order', ops: ['read'] },
      { model: 'sale.*', ops: ['read', 'write'] },
      { model: '*', ops: ['read'] },
    ]);

    expect(allows(policy, 'sale.order', 'write')).toBe(false);
    expect(allows(policy, 'sale.order.line', 'write')).toBe(true);
  });

  it('supports exact and prefix wildcard matches', () => {
    const policy = normalizePolicy([
      { model: 'crm.lead', ops: ['read', 'write'] },
      { model: 'sale.*', ops: ['read'] },
      { model: '*', ops: ['read'] },
    ]);

    expect(allows(policy, 'crm.lead', 'write')).toBe(true);
    expect(allows(policy, 'sale.order', 'write')).toBe(false);
    expect(allows(policy, 'stock.picking', 'read')).toBe(true);
  });
});
