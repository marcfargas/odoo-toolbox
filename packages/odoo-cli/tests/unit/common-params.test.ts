/**
 * Unit tests for middleware/common-params.ts
 *
 * Tests: parseFields, resolveLimit, option factory shapes.
 */

import { describe, it, expect } from 'vitest';
import { parseFields, resolveLimit } from '../../src/middleware/common-params';

describe('parseFields', () => {
  it('returns empty array for undefined', () => {
    expect(parseFields(undefined)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseFields('')).toEqual([]);
  });

  it('splits on comma', () => {
    expect(parseFields('id,name,email')).toEqual(['id', 'name', 'email']);
  });

  it('trims whitespace from each field', () => {
    expect(parseFields(' id , name , email ')).toEqual(['id', 'name', 'email']);
  });

  it('filters out empty entries', () => {
    expect(parseFields('id,,name')).toEqual(['id', 'name']);
  });

  it('handles single field', () => {
    expect(parseFields('id')).toEqual(['id']);
  });

  it('handles dotted field names', () => {
    expect(parseFields('partner_id.name,stage_id.id')).toEqual(['partner_id.name', 'stage_id.id']);
  });
});

describe('resolveLimit', () => {
  it('returns 80 by default', () => {
    expect(resolveLimit({})).toBe(80);
  });

  it('returns provided limit', () => {
    expect(resolveLimit({ limit: 20 })).toBe(20);
  });

  it('returns 0 for --all flag', () => {
    expect(resolveLimit({ all: true })).toBe(0);
  });

  it('--all overrides --limit', () => {
    expect(resolveLimit({ limit: 20, all: true })).toBe(0);
  });

  it('returns 0 for explicit --limit 0', () => {
    expect(resolveLimit({ limit: 0 })).toBe(0);
  });
});
