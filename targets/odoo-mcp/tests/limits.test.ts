import { describe, expect, it } from 'vitest';
import {
  buildPagination,
  enforceLimit,
  enforceOffset,
  isPayloadOversize,
  MAX_RESPONSE_BYTES,
} from '../src/limits';

describe('limits', () => {
  it('clamps search limit to [1, 500] with default 100', () => {
    expect(enforceLimit(undefined)).toBe(100);
    expect(enforceLimit(0)).toBe(1);
    expect(enforceLimit(501)).toBe(500);
    expect(enforceLimit(25)).toBe(25);
  });

  it('supports custom default and max limits', () => {
    expect(enforceLimit(undefined, 50, 100)).toBe(50);
    expect(enforceLimit(150, 50, 100)).toBe(100);
    expect(enforceLimit(0, 50, 100)).toBe(1);
  });

  it('normalizes offsets to non-negative integers', () => {
    expect(enforceOffset(undefined)).toBe(0);
    expect(enforceOffset(-10)).toBe(0);
    expect(enforceOffset(9.7)).toBe(9);
  });

  it('computes pagination with hasMore', () => {
    expect(buildPagination(120, 0, 100, 100)).toEqual({
      total: 120,
      offset: 0,
      limit: 100,
      hasMore: true,
    });

    expect(buildPagination(120, 100, 100, 20)).toEqual({
      total: 120,
      offset: 100,
      limit: 100,
      hasMore: false,
    });
  });

  it('detects oversize payloads', () => {
    const big = { text: 'x'.repeat(MAX_RESPONSE_BYTES + 1024) };
    const small = { text: 'ok' };

    expect(isPayloadOversize(big).oversize).toBe(true);
    expect(isPayloadOversize(small).oversize).toBe(false);
  });
});
