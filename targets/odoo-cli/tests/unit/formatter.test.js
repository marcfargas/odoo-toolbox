"use strict";
/**
 * Unit tests for output/formatter.ts
 *
 * Tests: many2one flattening, column detection, CSV escaping,
 * format auto-detection, cell formatting.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const formatter_1 = require("../../src/output/formatter");
const stream_writer_1 = require("../../src/output/stream-writer");
// ── flattenRecord ─────────────────────────────────────────────────────
(0, vitest_1.describe)('flattenRecord', () => {
    (0, vitest_1.it)('leaves non-many2one fields unchanged', () => {
        const rec = { id: 1, name: 'Acme', active: true };
        (0, vitest_1.expect)((0, formatter_1.flattenRecord)(rec)).toEqual({ id: 1, name: 'Acme', active: true });
    });
    (0, vitest_1.it)('expands many2one tuple to id + name columns', () => {
        const rec = { id: 1, partner_id: [7, 'Marc Fargas'] };
        const flat = (0, formatter_1.flattenRecord)(rec);
        (0, vitest_1.expect)(flat.partner_id).toBe(7);
        (0, vitest_1.expect)(flat.partner_id_name).toBe('Marc Fargas');
    });
    (0, vitest_1.it)('expands many2one false to null + empty string', () => {
        const rec = { id: 1, partner_id: false };
        const flat = (0, formatter_1.flattenRecord)(rec);
        (0, vitest_1.expect)(flat.partner_id).toBeNull();
        (0, vitest_1.expect)(flat.partner_id_name).toBe('');
    });
    (0, vitest_1.it)('handles multiple many2one fields', () => {
        const rec = { id: 1, partner_id: [7, 'Marc'], stage_id: [3, 'Won'] };
        const flat = (0, formatter_1.flattenRecord)(rec);
        (0, vitest_1.expect)(flat.partner_id).toBe(7);
        (0, vitest_1.expect)(flat.partner_id_name).toBe('Marc');
        (0, vitest_1.expect)(flat.stage_id).toBe(3);
        (0, vitest_1.expect)(flat.stage_id_name).toBe('Won');
    });
    (0, vitest_1.it)('handles null and undefined values', () => {
        const rec = { id: 1, name: null, note: undefined };
        const flat = (0, formatter_1.flattenRecord)(rec);
        (0, vitest_1.expect)(flat.id).toBe(1);
        (0, vitest_1.expect)(flat.name).toBeNull();
    });
    (0, vitest_1.it)('handles nested arrays (not many2one)', () => {
        const rec = { id: 1, tag_ids: [1, 2, 3] };
        const flat = (0, formatter_1.flattenRecord)(rec);
        // tag_ids is an array of ints, not a many2one tuple
        (0, vitest_1.expect)(flat.tag_ids).toEqual([1, 2, 3]);
    });
    (0, vitest_1.it)('does not expand array where first element is not a number', () => {
        const rec = { id: 1, selection: ['draft', 'Draft'] };
        const flat = (0, formatter_1.flattenRecord)(rec);
        (0, vitest_1.expect)(flat.selection).toEqual(['draft', 'Draft']);
    });
});
// ── getColumns ────────────────────────────────────────────────────────
(0, vitest_1.describe)('getColumns', () => {
    (0, vitest_1.it)('returns empty array for empty records', () => {
        (0, vitest_1.expect)((0, formatter_1.getColumns)([])).toEqual([]);
    });
    (0, vitest_1.it)('returns simple field names', () => {
        const records = [{ id: 1, name: 'Acme', active: true }];
        (0, vitest_1.expect)((0, formatter_1.getColumns)(records)).toEqual(['id', 'name', 'active']);
    });
    (0, vitest_1.it)('expands many2one to two columns', () => {
        const records = [{ id: 1, partner_id: [7, 'Marc'] }];
        (0, vitest_1.expect)((0, formatter_1.getColumns)(records)).toEqual(['id', 'partner_id', 'partner_id_name']);
    });
    (0, vitest_1.it)('expands many2one false to two columns', () => {
        const records = [{ id: 1, partner_id: false }];
        (0, vitest_1.expect)((0, formatter_1.getColumns)(records)).toEqual(['id', 'partner_id', 'partner_id_name']);
    });
    (0, vitest_1.it)('preserves column order from first record', () => {
        const records = [{ z: 1, a: 2, m: 3 }];
        (0, vitest_1.expect)((0, formatter_1.getColumns)(records)).toEqual(['z', 'a', 'm']);
    });
});
// ── CSV escaping ──────────────────────────────────────────────────────
(0, vitest_1.describe)('toCsvCell', () => {
    (0, vitest_1.it)('returns plain string as-is', () => {
        (0, vitest_1.expect)((0, stream_writer_1.toCsvCell)('hello')).toBe('hello');
    });
    (0, vitest_1.it)('wraps string with comma in quotes', () => {
        (0, vitest_1.expect)((0, stream_writer_1.toCsvCell)('hello, world')).toBe('"hello, world"');
    });
    (0, vitest_1.it)('wraps string with double-quote and escapes it', () => {
        (0, vitest_1.expect)((0, stream_writer_1.toCsvCell)('say "hi"')).toBe('"say ""hi"""');
    });
    (0, vitest_1.it)('wraps string with newline in quotes', () => {
        (0, vitest_1.expect)((0, stream_writer_1.toCsvCell)('line1\nline2')).toBe('"line1\nline2"');
    });
    (0, vitest_1.it)('converts null to empty string', () => {
        (0, vitest_1.expect)((0, stream_writer_1.toCsvCell)(null)).toBe('');
    });
    (0, vitest_1.it)('converts undefined to empty string', () => {
        (0, vitest_1.expect)((0, stream_writer_1.toCsvCell)(undefined)).toBe('');
    });
    (0, vitest_1.it)('converts numbers', () => {
        (0, vitest_1.expect)((0, stream_writer_1.toCsvCell)(42)).toBe('42');
        (0, vitest_1.expect)((0, stream_writer_1.toCsvCell)(3.14)).toBe('3.14');
    });
    (0, vitest_1.it)('converts boolean', () => {
        (0, vitest_1.expect)((0, stream_writer_1.toCsvCell)(true)).toBe('true');
        (0, vitest_1.expect)((0, stream_writer_1.toCsvCell)(false)).toBe('false');
    });
});
(0, vitest_1.describe)('toCsvRow', () => {
    (0, vitest_1.it)('joins cells with comma', () => {
        (0, vitest_1.expect)((0, stream_writer_1.toCsvRow)(['a', 'b', 'c'])).toBe('a,b,c');
    });
    (0, vitest_1.it)('escapes cells with commas', () => {
        (0, vitest_1.expect)((0, stream_writer_1.toCsvRow)(['hello, world', 'plain'])).toBe('"hello, world",plain');
    });
    (0, vitest_1.it)('handles empty row', () => {
        (0, vitest_1.expect)((0, stream_writer_1.toCsvRow)([])).toBe('');
    });
});
// ── detectFormat / resolveFormat ─────────────────────────────────────
(0, vitest_1.describe)('resolveFormat', () => {
    (0, vitest_1.it)('returns json for explicit json', () => {
        (0, vitest_1.expect)((0, formatter_1.resolveFormat)('json')).toBe('json');
    });
    (0, vitest_1.it)('returns table for explicit table', () => {
        (0, vitest_1.expect)((0, formatter_1.resolveFormat)('table')).toBe('table');
    });
    (0, vitest_1.it)('returns csv for explicit csv', () => {
        (0, vitest_1.expect)((0, formatter_1.resolveFormat)('csv')).toBe('csv');
    });
    (0, vitest_1.it)('returns ndjson for explicit ndjson', () => {
        (0, vitest_1.expect)((0, formatter_1.resolveFormat)('ndjson')).toBe('ndjson');
    });
    (0, vitest_1.it)('falls back to auto-detect for undefined', () => {
        // Result depends on TTY state — just check it returns a valid format
        const fmt = (0, formatter_1.resolveFormat)(undefined);
        (0, vitest_1.expect)(['json', 'table', 'csv', 'ndjson']).toContain(fmt);
    });
    (0, vitest_1.it)('falls back to auto-detect for invalid format', () => {
        const fmt = (0, formatter_1.resolveFormat)('invalid-format');
        (0, vitest_1.expect)(['json', 'table', 'csv', 'ndjson']).toContain(fmt);
    });
});
//# sourceMappingURL=formatter.test.js.map