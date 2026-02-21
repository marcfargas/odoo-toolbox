/**
 * Unit tests for output/formatter.ts
 *
 * Tests: many2one flattening, column detection, CSV escaping,
 * format auto-detection, cell formatting.
 */

import { describe, it, expect } from 'vitest';
import { flattenRecord, getColumns, resolveFormat } from '../../src/output/formatter';
import { toCsvCell, toCsvRow } from '../../src/output/stream-writer';

// ── flattenRecord ─────────────────────────────────────────────────────

describe('flattenRecord', () => {
  it('leaves non-many2one fields unchanged', () => {
    const rec = { id: 1, name: 'Acme', active: true };
    expect(flattenRecord(rec)).toEqual({ id: 1, name: 'Acme', active: true });
  });

  it('expands many2one tuple to id + name columns', () => {
    const rec = { id: 1, partner_id: [7, 'Marc Fargas'] };
    const flat = flattenRecord(rec);
    expect(flat.partner_id).toBe(7);
    expect(flat.partner_id_name).toBe('Marc Fargas');
  });

  it('expands many2one false to null + empty string', () => {
    const rec = { id: 1, partner_id: false };
    const flat = flattenRecord(rec);
    expect(flat.partner_id).toBeNull();
    expect(flat.partner_id_name).toBe('');
  });

  it('handles multiple many2one fields', () => {
    const rec = { id: 1, partner_id: [7, 'Marc'], stage_id: [3, 'Won'] };
    const flat = flattenRecord(rec);
    expect(flat.partner_id).toBe(7);
    expect(flat.partner_id_name).toBe('Marc');
    expect(flat.stage_id).toBe(3);
    expect(flat.stage_id_name).toBe('Won');
  });

  it('handles null and undefined values', () => {
    const rec = { id: 1, name: null, note: undefined };
    const flat = flattenRecord(rec);
    expect(flat.id).toBe(1);
    expect(flat.name).toBeNull();
  });

  it('handles nested arrays (not many2one)', () => {
    const rec = { id: 1, tag_ids: [1, 2, 3] };
    const flat = flattenRecord(rec);
    // tag_ids is an array of ints, not a many2one tuple
    expect(flat.tag_ids).toEqual([1, 2, 3]);
  });

  it('does not expand array where first element is not a number', () => {
    const rec = { id: 1, selection: ['draft', 'Draft'] };
    const flat = flattenRecord(rec);
    expect(flat.selection).toEqual(['draft', 'Draft']);
  });
});

// ── getColumns ────────────────────────────────────────────────────────

describe('getColumns', () => {
  it('returns empty array for empty records', () => {
    expect(getColumns([])).toEqual([]);
  });

  it('returns simple field names', () => {
    const records = [{ id: 1, name: 'Acme', active: true }];
    expect(getColumns(records)).toEqual(['id', 'name', 'active']);
  });

  it('expands many2one to two columns', () => {
    const records = [{ id: 1, partner_id: [7, 'Marc'] }];
    expect(getColumns(records)).toEqual(['id', 'partner_id', 'partner_id_name']);
  });

  it('expands many2one false to two columns', () => {
    const records = [{ id: 1, partner_id: false }];
    expect(getColumns(records)).toEqual(['id', 'partner_id', 'partner_id_name']);
  });

  it('preserves column order from first record', () => {
    const records = [{ z: 1, a: 2, m: 3 }];
    expect(getColumns(records)).toEqual(['z', 'a', 'm']);
  });
});

// ── CSV escaping ──────────────────────────────────────────────────────

describe('toCsvCell', () => {
  it('returns plain string as-is', () => {
    expect(toCsvCell('hello')).toBe('hello');
  });

  it('wraps string with comma in quotes', () => {
    expect(toCsvCell('hello, world')).toBe('"hello, world"');
  });

  it('wraps string with double-quote and escapes it', () => {
    expect(toCsvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it('wraps string with newline in quotes', () => {
    expect(toCsvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('converts null to empty string', () => {
    expect(toCsvCell(null)).toBe('');
  });

  it('converts undefined to empty string', () => {
    expect(toCsvCell(undefined)).toBe('');
  });

  it('converts numbers', () => {
    expect(toCsvCell(42)).toBe('42');
    expect(toCsvCell(3.14)).toBe('3.14');
  });

  it('converts boolean', () => {
    expect(toCsvCell(true)).toBe('true');
    expect(toCsvCell(false)).toBe('false');
  });
});

describe('toCsvRow', () => {
  it('joins cells with comma', () => {
    expect(toCsvRow(['a', 'b', 'c'])).toBe('a,b,c');
  });

  it('escapes cells with commas', () => {
    expect(toCsvRow(['hello, world', 'plain'])).toBe('"hello, world",plain');
  });

  it('handles empty row', () => {
    expect(toCsvRow([])).toBe('');
  });
});

// ── detectFormat / resolveFormat ─────────────────────────────────────

describe('resolveFormat', () => {
  it('returns json for explicit json', () => {
    expect(resolveFormat('json')).toBe('json');
  });

  it('returns table for explicit table', () => {
    expect(resolveFormat('table')).toBe('table');
  });

  it('returns csv for explicit csv', () => {
    expect(resolveFormat('csv')).toBe('csv');
  });

  it('returns ndjson for explicit ndjson', () => {
    expect(resolveFormat('ndjson')).toBe('ndjson');
  });

  it('falls back to auto-detect for undefined', () => {
    // Result depends on TTY state — just check it returns a valid format
    const fmt = resolveFormat(undefined);
    expect(['json', 'table', 'csv', 'ndjson']).toContain(fmt);
  });

  it('falls back to auto-detect for invalid format', () => {
    const fmt = resolveFormat('invalid-format');
    expect(['json', 'table', 'csv', 'ndjson']).toContain(fmt);
  });
});
