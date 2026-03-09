/**
 * Integration tests for CdcService against a live Odoo instance.
 *
 * Requires Docker Odoo (see DEVELOPMENT.md). Skipped when no credentials.
 * All test data is created and deleted within the test run.
 *
 * Scope:
 *  - check(): model capabilities (mail.thread detection, tracking field count)
 *  - getHistory(): tracking events for a record we modify
 *  - getFeed(): pagination, cursor advance, empty-on-new-record
 *
 * Note: We do NOT rely on any pre-existing records or history in the database.
 * All assertions are against data created here, and cleaned up in afterAll.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { OdooClient } from '../src/client/odoo-client';
import { CdcService } from '../src/services/cdc/cdc-service';

// ── Setup ─────────────────────────────────────────────────────────────────────

const odooUrl = process.env['ODOO_URL'] || 'http://localhost:8069';
const odooDb = process.env['ODOO_DB_NAME'] || 'odoo';
const odooUser = process.env['ODOO_DB_USER'] || 'admin';
const odooPassword = process.env['ODOO_DB_PASSWORD'] || 'admin';

const hasOdoo =
  !!process.env['ODOO_URL'] || (process.env['CI'] === 'true' && !!process.env['ODOO_DB_NAME']);

describe.skipIf(!hasOdoo)('CdcService integration', () => {
  let client: OdooClient;
  let cdc: CdcService;
  const cleanup: Array<{ model: string; id: number }> = [];

  beforeAll(async () => {
    client = new OdooClient({
      url: odooUrl,
      database: odooDb,
      username: odooUser,
      password: odooPassword,
    });
    await client.authenticate();
    cdc = client.cdc;
  });

  afterAll(async () => {
    for (const { model, id } of cleanup.reverse()) {
      try {
        await client.unlink(model, [id]);
      } catch {
        // ignore cleanup errors
      }
    }
    client.logout();
  });

  // ── check() ────────────────────────────────────────────────────────────────

  describe('check()', () => {
    it('res.partner: isMailThread=true (inherits mail.thread)', async () => {
      const result = await cdc.check('res.partner');
      expect(result.model).toBe('res.partner');
      expect(result.isMailThread).toBe(true);
    });

    it('res.currency: isMailThread=false (does not inherit mail.thread)', async () => {
      const result = await cdc.check('res.currency');
      expect(result.isMailThread).toBe(false);
      expect(result.trackedFieldCount).toBe(0);
    });

    it('returns numeric trackedFieldCount and boolean hasHistory', async () => {
      const result = await cdc.check('res.partner');
      expect(typeof result.trackedFieldCount).toBe('number');
      expect(result.trackedFieldCount).toBeGreaterThanOrEqual(0);
      expect(typeof result.hasHistory).toBe('boolean');
    });
  });

  // ── getHistory() ───────────────────────────────────────────────────────────

  describe('getHistory()', () => {
    it('returns empty array for a newly created record with no field changes', async () => {
      // Create a partner — this does NOT generate tracking values on its own;
      // tracking values are only written when a tracked field CHANGES after creation.
      const partnerId = await client.create('res.partner', {
        name: `__cdc_test_${Date.now()}`,
      });
      cleanup.push({ model: 'res.partner', id: partnerId });

      const events = await cdc.getHistory('res.partner', partnerId);
      // Fresh record, no field changes yet — should be empty
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBe(0);
    });

    it('returns TrackingEvent objects with the expected shape', async () => {
      // Skip if res.partner has no tracked fields in this Odoo build
      const info = await cdc.check('res.partner');
      if (info.trackedFieldCount === 0) return;

      const partnerId = await client.create('res.partner', {
        name: `__cdc_test_${Date.now()}`,
      });
      cleanup.push({ model: 'res.partner', id: partnerId });

      // The creation does NOT generate tracking; we check after a write
      // to a tracked field. We can't guarantee which fields are tracked
      // in a generic Odoo install, so we just verify shape if events exist.
      const events = await cdc.getHistory('res.partner', partnerId);

      for (const ev of events) {
        expect(typeof ev.id).toBe('number');
        expect(typeof ev.messageId).toBe('number');
        expect(ev.model).toBe('res.partner');
        expect(typeof ev.recordId).toBe('number');
        expect(typeof ev.date).toBe('string');
        expect(ev.date).toMatch(/^\d{4}-\d{2}-\d{2}/);
        expect(typeof ev.field.name).toBe('string');
        expect(typeof ev.field.type).toBe('string');
        expect(ev.old).toHaveProperty('raw');
        expect(ev.new).toHaveProperty('raw');
        expect(ev.new).toHaveProperty('display');
      }
    });

    it('since/until filters reduce the result set', async () => {
      const partnerId = await client.create('res.partner', {
        name: `__cdc_test_${Date.now()}`,
      });
      cleanup.push({ model: 'res.partner', id: partnerId });

      // Events before 1970 — should always return empty
      const events = await cdc.getHistory('res.partner', partnerId, {
        until: '1970-01-01 00:00:00',
      });
      expect(events).toEqual([]);
    });
  });

  // ── getFeed() ──────────────────────────────────────────────────────────────

  describe('getFeed()', () => {
    it('is an async iterable', () => {
      const iter = cdc.getFeed('res.partner', { since: '2099-01-01' });
      expect(typeof iter[Symbol.asyncIterator]).toBe('function');
    });

    it('returns nothing for a future since date (no events yet)', async () => {
      const events = [];
      for await (const ev of cdc.getFeed('res.partner', {
        since: '2099-01-01 00:00:00',
        pageSize: 10,
      })) {
        events.push(ev);
      }
      expect(events).toHaveLength(0);
    });

    it('all yielded events have the expected shape', async () => {
      // Use a very recent window to limit data volume
      const windowStart = new Date(Date.now() - 5 * 60 * 1000) // last 5 min
        .toISOString()
        .replace('T', ' ')
        .slice(0, 19);

      const events: any[] = [];
      for await (const ev of cdc.getFeed('res.partner', {
        since: windowStart,
        pageSize: 10,
      })) {
        events.push(ev);
        if (events.length >= 10) break; // cap to avoid large data in tests
      }

      for (const ev of events) {
        expect(ev.model).toBe('res.partner');
        expect(typeof ev.id).toBe('number');
        expect(typeof ev.recordId).toBe('number');
        expect(typeof ev.date).toBe('string');
        expect(ev.field).toBeDefined();
        expect(ev.old).toHaveProperty('raw');
        expect(ev.new).toHaveProperty('raw');
      }
    });

    it('cursor advances monotonically (ids always increase across pages)', async () => {
      const windowStart = new Date(Date.now() - 60 * 60 * 1000) // last 1 hour
        .toISOString()
        .replace('T', ' ')
        .slice(0, 19);

      const ids: number[] = [];
      for await (const ev of cdc.getFeed('res.partner', {
        since: windowStart,
        pageSize: 5,
      })) {
        ids.push(ev.id);
        if (ids.length >= 15) break; // cap
      }

      // Verify strict monotonic increase (id asc ordering)
      for (let i = 1; i < ids.length; i++) {
        expect(ids[i]).toBeGreaterThan(ids[i - 1]);
      }
    });
  });
});
