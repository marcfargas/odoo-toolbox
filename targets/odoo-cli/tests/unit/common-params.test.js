"use strict";
/**
 * Unit tests for middleware/common-params.ts
 *
 * Tests: parseFields, resolveLimit, option factory shapes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const common_params_1 = require("../../src/middleware/common-params");
(0, vitest_1.describe)('parseFields', () => {
    (0, vitest_1.it)('returns empty array for undefined', () => {
        (0, vitest_1.expect)((0, common_params_1.parseFields)(undefined)).toEqual([]);
    });
    (0, vitest_1.it)('returns empty array for empty string', () => {
        (0, vitest_1.expect)((0, common_params_1.parseFields)('')).toEqual([]);
    });
    (0, vitest_1.it)('splits on comma', () => {
        (0, vitest_1.expect)((0, common_params_1.parseFields)('id,name,email')).toEqual(['id', 'name', 'email']);
    });
    (0, vitest_1.it)('trims whitespace from each field', () => {
        (0, vitest_1.expect)((0, common_params_1.parseFields)(' id , name , email ')).toEqual(['id', 'name', 'email']);
    });
    (0, vitest_1.it)('filters out empty entries', () => {
        (0, vitest_1.expect)((0, common_params_1.parseFields)('id,,name')).toEqual(['id', 'name']);
    });
    (0, vitest_1.it)('handles single field', () => {
        (0, vitest_1.expect)((0, common_params_1.parseFields)('id')).toEqual(['id']);
    });
    (0, vitest_1.it)('handles dotted field names', () => {
        (0, vitest_1.expect)((0, common_params_1.parseFields)('partner_id.name,stage_id.id')).toEqual(['partner_id.name', 'stage_id.id']);
    });
});
(0, vitest_1.describe)('resolveLimit', () => {
    (0, vitest_1.it)('returns 80 by default', () => {
        (0, vitest_1.expect)((0, common_params_1.resolveLimit)({})).toBe(80);
    });
    (0, vitest_1.it)('returns provided limit', () => {
        (0, vitest_1.expect)((0, common_params_1.resolveLimit)({ limit: 20 })).toBe(20);
    });
    (0, vitest_1.it)('returns 0 for --all flag', () => {
        (0, vitest_1.expect)((0, common_params_1.resolveLimit)({ all: true })).toBe(0);
    });
    (0, vitest_1.it)('--all overrides --limit', () => {
        (0, vitest_1.expect)((0, common_params_1.resolveLimit)({ limit: 20, all: true })).toBe(0);
    });
    (0, vitest_1.it)('returns 0 for explicit --limit 0', () => {
        (0, vitest_1.expect)((0, common_params_1.resolveLimit)({ limit: 0 })).toBe(0);
    });
});
//# sourceMappingURL=common-params.test.js.map