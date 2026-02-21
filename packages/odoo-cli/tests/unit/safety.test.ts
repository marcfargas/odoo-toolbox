/**
 * Unit tests for middleware/safety.ts
 *
 * Tests: requireConfirm enforcement for READ/WRITE/DESTRUCTIVE,
 * dry-run bypass, error message content.
 */

import { describe, it, expect } from 'vitest';
import { requireConfirm } from '../../src/middleware/safety';
import { CliUsageError } from '../../src/output/errors';

describe('requireConfirm', () => {
  describe('READ level', () => {
    it('does not throw without --confirm', () => {
      expect(() =>
        requireConfirm('READ', { confirm: false }, 'records search res.partner')
      ).not.toThrow();
    });

    it('does not throw with --confirm', () => {
      expect(() =>
        requireConfirm('READ', { confirm: true }, 'records search res.partner')
      ).not.toThrow();
    });

    it('does not throw in --dry-run mode', () => {
      expect(() =>
        requireConfirm('READ', { dryRun: true }, 'records search res.partner')
      ).not.toThrow();
    });
  });

  describe('WRITE level', () => {
    it('throws CliUsageError without --confirm', () => {
      expect(() =>
        requireConfirm('WRITE', { confirm: false }, 'records create res.partner')
      ).toThrow(CliUsageError);
    });

    it('throws with message mentioning --confirm', () => {
      try {
        requireConfirm('WRITE', { confirm: false }, 'records create res.partner');
      } catch (err) {
        expect(err).toBeInstanceOf(CliUsageError);
        expect((err as CliUsageError).message).toMatch(/--confirm/i);
      }
    });

    it('throws with hints array', () => {
      try {
        requireConfirm('WRITE', { confirm: false }, 'records create res.partner');
      } catch (err) {
        expect(err).toBeInstanceOf(CliUsageError);
        expect((err as CliUsageError).hints.length).toBeGreaterThan(0);
      }
    });

    it('does not throw with --confirm=true', () => {
      expect(() =>
        requireConfirm('WRITE', { confirm: true }, 'records create res.partner')
      ).not.toThrow();
    });

    it('skips check in --dry-run mode', () => {
      expect(() =>
        requireConfirm('WRITE', { confirm: false, dryRun: true }, 'records create res.partner')
      ).not.toThrow();
    });

    it('mentions command description in error', () => {
      try {
        requireConfirm('WRITE', { confirm: false }, 'records create res.partner');
      } catch (err) {
        expect((err as CliUsageError).message).toContain('records create res.partner');
      }
    });
  });

  describe('DESTRUCTIVE level', () => {
    it('throws CliUsageError without --confirm', () => {
      expect(() =>
        requireConfirm('DESTRUCTIVE', { confirm: false }, 'records delete crm.lead')
      ).toThrow(CliUsageError);
    });

    it('does not throw with --confirm=true', () => {
      expect(() =>
        requireConfirm('DESTRUCTIVE', { confirm: true }, 'records delete crm.lead')
      ).not.toThrow();
    });

    it('skips check in --dry-run mode', () => {
      expect(() =>
        requireConfirm('DESTRUCTIVE', { confirm: false, dryRun: true }, 'records delete crm.lead')
      ).not.toThrow();
    });

    it('includes DESTRUCTIVE in error message', () => {
      try {
        requireConfirm('DESTRUCTIVE', { confirm: false }, 'records delete crm.lead');
      } catch (err) {
        expect((err as CliUsageError).message).toMatch(/destructive/i);
      }
    });
  });
});
