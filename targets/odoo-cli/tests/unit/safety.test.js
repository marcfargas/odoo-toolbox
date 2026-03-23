"use strict";
/**
 * Unit tests for middleware/safety.ts
 *
 * Tests: requireConfirm enforcement for READ/WRITE/DESTRUCTIVE,
 * dry-run bypass, error message content.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const safety_1 = require("../../src/middleware/safety");
const errors_1 = require("../../src/output/errors");
(0, vitest_1.describe)('requireConfirm', () => {
    (0, vitest_1.describe)('READ level', () => {
        (0, vitest_1.it)('does not throw without --confirm', () => {
            (0, vitest_1.expect)(() => (0, safety_1.requireConfirm)('READ', { confirm: false }, 'records search res.partner')).not.toThrow();
        });
        (0, vitest_1.it)('does not throw with --confirm', () => {
            (0, vitest_1.expect)(() => (0, safety_1.requireConfirm)('READ', { confirm: true }, 'records search res.partner')).not.toThrow();
        });
        (0, vitest_1.it)('does not throw in --dry-run mode', () => {
            (0, vitest_1.expect)(() => (0, safety_1.requireConfirm)('READ', { dryRun: true }, 'records search res.partner')).not.toThrow();
        });
    });
    (0, vitest_1.describe)('WRITE level', () => {
        (0, vitest_1.it)('throws CliUsageError without --confirm', () => {
            (0, vitest_1.expect)(() => (0, safety_1.requireConfirm)('WRITE', { confirm: false }, 'records create res.partner')).toThrow(errors_1.CliUsageError);
        });
        (0, vitest_1.it)('throws with message mentioning --confirm', () => {
            try {
                (0, safety_1.requireConfirm)('WRITE', { confirm: false }, 'records create res.partner');
            }
            catch (err) {
                (0, vitest_1.expect)(err).toBeInstanceOf(errors_1.CliUsageError);
                (0, vitest_1.expect)(err.message).toMatch(/--confirm/i);
            }
        });
        (0, vitest_1.it)('throws with hints array', () => {
            try {
                (0, safety_1.requireConfirm)('WRITE', { confirm: false }, 'records create res.partner');
            }
            catch (err) {
                (0, vitest_1.expect)(err).toBeInstanceOf(errors_1.CliUsageError);
                (0, vitest_1.expect)(err.hints.length).toBeGreaterThan(0);
            }
        });
        (0, vitest_1.it)('does not throw with --confirm=true', () => {
            (0, vitest_1.expect)(() => (0, safety_1.requireConfirm)('WRITE', { confirm: true }, 'records create res.partner')).not.toThrow();
        });
        (0, vitest_1.it)('skips check in --dry-run mode', () => {
            (0, vitest_1.expect)(() => (0, safety_1.requireConfirm)('WRITE', { confirm: false, dryRun: true }, 'records create res.partner')).not.toThrow();
        });
        (0, vitest_1.it)('mentions command description in error', () => {
            try {
                (0, safety_1.requireConfirm)('WRITE', { confirm: false }, 'records create res.partner');
            }
            catch (err) {
                (0, vitest_1.expect)(err.message).toContain('records create res.partner');
            }
        });
    });
    (0, vitest_1.describe)('DESTRUCTIVE level', () => {
        (0, vitest_1.it)('throws CliUsageError without --confirm', () => {
            (0, vitest_1.expect)(() => (0, safety_1.requireConfirm)('DESTRUCTIVE', { confirm: false }, 'records delete crm.lead')).toThrow(errors_1.CliUsageError);
        });
        (0, vitest_1.it)('does not throw with --confirm=true', () => {
            (0, vitest_1.expect)(() => (0, safety_1.requireConfirm)('DESTRUCTIVE', { confirm: true }, 'records delete crm.lead')).not.toThrow();
        });
        (0, vitest_1.it)('skips check in --dry-run mode', () => {
            (0, vitest_1.expect)(() => (0, safety_1.requireConfirm)('DESTRUCTIVE', { confirm: false, dryRun: true }, 'records delete crm.lead')).not.toThrow();
        });
        (0, vitest_1.it)('includes DESTRUCTIVE in error message', () => {
            try {
                (0, safety_1.requireConfirm)('DESTRUCTIVE', { confirm: false }, 'records delete crm.lead');
            }
            catch (err) {
                (0, vitest_1.expect)(err.message).toMatch(/destructive/i);
            }
        });
    });
});
//# sourceMappingURL=safety.test.js.map