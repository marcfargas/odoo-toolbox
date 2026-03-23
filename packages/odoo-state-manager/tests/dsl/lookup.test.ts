import { describe, it, expect } from 'vitest';
import { lookup, isLookupRef } from '../../src/dsl';

describe('lookup()', () => {
  it('creates a LookupRef with object shorthand domain', () => {
    const ref = lookup('res.partner', { name: 'ACME' });
    expect(ref.__type).toBe('lookup');
    expect(ref.model).toBe('res.partner');
    expect(ref.domain).toEqual({ name: 'ACME' });
  });

  it('creates a LookupRef with raw domain tuples', () => {
    const ref = lookup('res.partner', [['name', '=', 'ACME']]);
    expect(ref.__type).toBe('lookup');
    expect(ref.model).toBe('res.partner');
    expect(ref.domain).toEqual([['name', '=', 'ACME']]);
  });

  it('passes isLookupRef type guard (positive)', () => {
    const ref = lookup('res.partner', { name: 'ACME' });
    expect(isLookupRef(ref)).toBe(true);
  });

  it('passes isLookupRef type guard (negative)', () => {
    expect(isLookupRef(null)).toBe(false);
    expect(isLookupRef(undefined)).toBe(false);
    expect(isLookupRef({ __type: 'resource' })).toBe(false);
    expect(isLookupRef('string')).toBe(false);
    expect(isLookupRef(42)).toBe(false);
  });

  it('result is frozen (immutable)', () => {
    const ref = lookup('res.partner', { name: 'ACME' });
    expect(Object.isFrozen(ref)).toBe(true);
  });
});
