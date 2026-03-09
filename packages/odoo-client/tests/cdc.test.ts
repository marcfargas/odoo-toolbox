/**
 * Unit tests for CDC service.
 *
 * All test data is synthetic — no real IDs, dates, names, or values
 * from any live Odoo instance are used here.
 *
 * Tests cover:
 *   - resolver: every ttype → correct TypedValue columns, edge cases
 *   - field-cache: get/set/miss, TTL expiry, capacity enforcement
 *   - check(): isMailThread detection, trackedFieldCount
 *   - getHistory(): domain construction, field filter, deleted-field fallback
 *   - getFeed(): pagination, cursor resume, since→id cursor transition
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveValues, type RawTrackingRow } from '../src/services/cdc/resolver';
import { FieldMetaCache } from '../src/services/cdc/field-cache';

// ── Test data factories (all synthetic) ──────────────────────────────────────

/** Build a minimal RawTrackingRow with all-false defaults. Use overrides for the case under test. */
function makeRow(overrides: Partial<RawTrackingRow> = {}): RawTrackingRow {
  return {
    id: 1,
    field_id: [10, 'Test Field (Model)'],
    field_info: false,
    old_value_char: false,
    new_value_char: false,
    old_value_text: false,
    new_value_text: false,
    old_value_integer: false,
    new_value_integer: false,
    old_value_float: false,
    new_value_float: false,
    old_value_datetime: false,
    new_value_datetime: false,
    currency_id: false,
    mail_message_id: [100, 'test.model,1'],
    create_date: '2020-01-15 10:00:00',
    ...overrides,
  };
}

// ── Resolver tests ────────────────────────────────────────────────────────────

describe('resolveValues', () => {
  describe('char', () => {
    it('maps old/new_value_char to raw and display', () => {
      const row = makeRow({ old_value_char: 'draft', new_value_char: 'posted' });
      const { old, new: nv } = resolveValues(row, 'char');
      expect(old).toEqual({ raw: 'draft', display: 'draft' });
      expect(nv).toEqual({ raw: 'posted', display: 'posted' });
    });

    it('returns null for false (unset)', () => {
      const { old, new: nv } = resolveValues(makeRow(), 'char');
      expect(old.raw).toBeNull();
      expect(nv.raw).toBeNull();
    });

    it('returns null for empty string', () => {
      const { old } = resolveValues(makeRow({ old_value_char: '' }), 'char');
      expect(old.raw).toBeNull();
    });
  });

  describe('text / html', () => {
    it('prefers old_value_text over old_value_char when both present', () => {
      const row = makeRow({ old_value_text: 'long body', old_value_char: 'short' });
      const { old } = resolveValues(row, 'text');
      expect(old.raw).toBe('long body');
    });

    it('falls back to old_value_char when old_value_text is false', () => {
      const row = makeRow({ old_value_char: 'fallback', old_value_text: false });
      const { old } = resolveValues(row, 'text');
      expect(old.raw).toBe('fallback');
    });

    it('html uses same column logic as text', () => {
      const row = makeRow({ new_value_text: '<p>content</p>' });
      const { new: nv } = resolveValues(row, 'html');
      expect(nv.raw).toBe('<p>content</p>');
    });
  });

  describe('integer', () => {
    it('returns number with string display', () => {
      const row = makeRow({ old_value_integer: 0, new_value_integer: 42 });
      const { old, new: nv } = resolveValues(row, 'integer');
      expect(old).toEqual({ raw: 0, display: '0' });
      expect(nv).toEqual({ raw: 42, display: '42' });
    });

    it('returns null for false', () => {
      const { old } = resolveValues(makeRow(), 'integer');
      expect(old.raw).toBeNull();
      expect(old.display).toBeNull();
    });
  });

  describe('boolean', () => {
    it('maps 0 → false/No, 1 → true/Yes', () => {
      const row = makeRow({ old_value_integer: 0, new_value_integer: 1 });
      const { old, new: nv } = resolveValues(row, 'boolean');
      expect(old).toEqual({ raw: false, display: 'No' });
      expect(nv).toEqual({ raw: true, display: 'Yes' });
    });

    it('returns null for false (unset)', () => {
      const { old } = resolveValues(makeRow(), 'boolean');
      expect(old.raw).toBeNull();
      expect(old.display).toBeNull();
    });

    it('treats any non-zero integer as true', () => {
      const { new: nv } = resolveValues(makeRow({ new_value_integer: 2 }), 'boolean');
      expect(nv.raw).toBe(true);
    });
  });

  describe('float', () => {
    it('returns the number with string display', () => {
      const row = makeRow({ old_value_float: 1.5, new_value_float: 3.14 });
      const { old, new: nv } = resolveValues(row, 'float');
      expect(old.raw).toBe(1.5);
      expect(nv.display).toBe('3.14');
    });

    it('returns null for false', () => {
      const { old } = resolveValues(makeRow(), 'float');
      expect(old.raw).toBeNull();
    });
  });

  describe('monetary', () => {
    it('attaches currency tuple when currency_id is present', () => {
      const row = makeRow({
        old_value_float: 0,
        new_value_float: 100,
        currency_id: [1, 'USD'],
      });
      const { old, new: nv } = resolveValues(row, 'monetary');
      expect(old.currency).toEqual([1, 'USD']);
      expect(nv.currency).toEqual([1, 'USD']);
      expect(nv.raw).toBe(100);
    });

    it('omits currency property when currency_id is false', () => {
      const row = makeRow({ old_value_float: 50 });
      const { old } = resolveValues(row, 'monetary');
      expect(old.currency).toBeUndefined();
    });
  });

  describe('datetime', () => {
    it('returns the datetime string unchanged', () => {
      const row = makeRow({
        old_value_datetime: '2020-01-01 00:00:00',
        new_value_datetime: '2020-06-30 23:59:59',
      });
      const { old, new: nv } = resolveValues(row, 'datetime');
      expect(old.raw).toBe('2020-01-01 00:00:00');
      expect(nv.raw).toBe('2020-06-30 23:59:59');
    });
  });

  describe('date', () => {
    it('strips the time component, leaving only the date', () => {
      const row = makeRow({
        old_value_datetime: '2020-01-01 00:00:00',
        new_value_datetime: '2020-12-31 00:00:00',
      });
      const { old, new: nv } = resolveValues(row, 'date');
      expect(old.raw).toBe('2020-01-01');
      expect(nv.raw).toBe('2020-12-31');
    });

    it('returns null for false', () => {
      const { old } = resolveValues(makeRow(), 'date');
      expect(old.raw).toBeNull();
    });
  });

  describe('selection', () => {
    it('uses old_value_char and marks isTranslated: true', () => {
      const row = makeRow({ old_value_char: 'option_a', new_value_char: 'option_b' });
      const { old, new: nv } = resolveValues(row, 'selection');
      expect(old).toEqual({ raw: 'option_a', display: 'option_a', isTranslated: true });
      expect(nv).toEqual({ raw: 'option_b', display: 'option_b', isTranslated: true });
    });
  });

  describe('many2one', () => {
    it('uses integer for id and char for display name', () => {
      const row = makeRow({
        old_value_integer: false,
        new_value_integer: 42,
        old_value_char: false,
        new_value_char: 'Related Record',
      });
      const { old, new: nv } = resolveValues(row, 'many2one');
      expect(old).toEqual({ raw: null, display: null });
      expect(nv).toEqual({ raw: 42, display: 'Related Record', id: 42 });
    });

    it('does not include id property when id is null', () => {
      const { old } = resolveValues(makeRow(), 'many2one');
      expect(old.id).toBeUndefined();
    });
  });

  describe('many2many / one2many', () => {
    it('returns null gracefully — these types are not tracked by Odoo', () => {
      const { old, new: nv } = resolveValues(makeRow(), 'many2many');
      expect(old).toEqual({ raw: null, display: null });
      expect(nv).toEqual({ raw: null, display: null });

      const { old: o2, new: n2 } = resolveValues(makeRow(), 'one2many');
      expect(o2.raw).toBeNull();
      expect(n2.raw).toBeNull();
    });
  });

  describe('binary', () => {
    it('uses old_value_char', () => {
      const { new: nv } = resolveValues(makeRow({ new_value_char: 'ZmFrZQ==' }), 'binary');
      expect(nv.raw).toBe('ZmFrZQ==');
    });
  });

  describe('unknown ttype', () => {
    it('returns null gracefully without throwing', () => {
      expect(() => resolveValues(makeRow(), 'some_future_type')).not.toThrow();
      const { old, new: nv } = resolveValues(makeRow(), 'some_future_type');
      expect(old.raw).toBeNull();
      expect(nv.raw).toBeNull();
    });
  });
});

// ── FieldMetaCache tests ──────────────────────────────────────────────────────

describe('FieldMetaCache', () => {
  it('returns undefined for an ID never stored', () => {
    const cache = new FieldMetaCache();
    expect(cache.get(1)).toBeUndefined();
  });

  it('stores and retrieves an entry by ID', () => {
    const cache = new FieldMetaCache();
    const meta = { id: 1, name: 'state', ttype: 'selection', field_description: 'Status' };
    cache.set(meta);
    expect(cache.get(1)).toEqual(meta);
  });

  it('missing() returns only IDs not in cache', () => {
    const cache = new FieldMetaCache();
    cache.set({ id: 1, name: 'a', ttype: 'char', field_description: 'A' });
    expect(cache.missing([1, 2, 3])).toEqual([2, 3]);
  });

  it('missing() returns empty array when all IDs are cached', () => {
    const cache = new FieldMetaCache();
    cache.set({ id: 1, name: 'a', ttype: 'char', field_description: 'A' });
    cache.set({ id: 2, name: 'b', ttype: 'char', field_description: 'B' });
    expect(cache.missing([1, 2])).toEqual([]);
  });

  it('treats expired entries as missing (past TTL)', () => {
    vi.useFakeTimers();
    const cache = new FieldMetaCache();
    cache.set({ id: 1, name: 'x', ttype: 'char', field_description: 'X' });
    expect(cache.get(1)).toBeDefined();

    vi.advanceTimersByTime(5 * 60 * 1000 + 1); // 5 min + 1ms
    expect(cache.get(1)).toBeUndefined();
    expect(cache.missing([1])).toEqual([1]);

    vi.useRealTimers();
  });
});

// ── check() function tests ────────────────────────────────────────────────────

describe('check()', () => {
  let check: (client: any, model: string) => Promise<any>;

  beforeEach(async () => {
    const mod = await import('../src/services/cdc/functions');
    check = mod.check;
  });

  it('detects mail.thread when message_ids field is present', async () => {
    const mockClient = {
      searchRead: async () => [
        { name: 'message_ids', tracking: false },
        { name: 'field_a', tracking: 1 },
        { name: 'field_b', tracking: 10 },
      ],
      searchCount: async () => 3,
    } as any;

    const result = await check(mockClient, 'test.model');
    expect(result.model).toBe('test.model');
    expect(result.isMailThread).toBe(true);
    expect(result.trackedFieldCount).toBe(2);
    expect(result.hasHistory).toBe(true);
  });

  it('returns isMailThread: false when message_ids is absent', async () => {
    const mockClient = {
      searchRead: async () => [{ name: 'name', tracking: false }],
      searchCount: async () => 0,
    } as any;

    const result = await check(mockClient, 'test.model');
    expect(result.isMailThread).toBe(false);
    expect(result.trackedFieldCount).toBe(0);
    expect(result.hasHistory).toBe(false);
  });

  it('counts only fields where tracking > 0 (ignores 0 and false)', async () => {
    const mockClient = {
      searchRead: async () => [
        { name: 'message_ids', tracking: false },
        { name: 'untracked_a', tracking: 0 },
        { name: 'tracked_b', tracking: 1 },
        { name: 'untracked_c', tracking: false },
        { name: 'tracked_d', tracking: 100 },
      ],
      searchCount: async () => 1,
    } as any;

    const result = await check(mockClient, 'test.model');
    expect(result.trackedFieldCount).toBe(2); // tracked_b + tracked_d only
  });

  it('reports hasHistory: false when searchCount returns 0', async () => {
    const mockClient = {
      searchRead: async () => [{ name: 'message_ids', tracking: false }],
      searchCount: async () => 0,
    } as any;

    const result = await check(mockClient, 'test.model');
    expect(result.hasHistory).toBe(false);
  });
});

// ── getHistory() function tests ───────────────────────────────────────────────

describe('getHistory()', () => {
  let getHistory: any;

  beforeEach(async () => {
    const mod = await import('../src/services/cdc/functions');
    getHistory = mod.getHistory;
  });

  // Synthetic tracking row — no real DB values
  const syntheticTrackingRow = makeRow({
    id: 1,
    field_id: [10, 'Status (Model)'],
    old_value_char: 'option_a',
    new_value_char: 'option_b',
    mail_message_id: [100, 'test.model,1'],
    create_date: '2020-01-15 10:00:00',
  });

  const syntheticFieldMeta = {
    id: 10,
    name: 'state',
    ttype: 'selection',
    field_description: 'Status',
  };

  const syntheticMessage = {
    id: 100,
    res_id: 1,
    date: '2020-01-15 10:00:00',
    author_id: [1, 'Test User'],
  };

  function makeMockClient(tvRows = [syntheticTrackingRow]) {
    return {
      searchRead: vi.fn().mockImplementation(async (model: string) => {
        if (model === 'mail.tracking.value') return tvRows;
        if (model === 'ir.model.fields') return [syntheticFieldMeta];
        return [];
      }),
      read: vi.fn().mockResolvedValue([syntheticMessage]),
    } as any;
  }

  it('returns empty array when no tracking rows exist', async () => {
    const mockClient = {
      searchRead: vi.fn().mockResolvedValue([]),
      read: vi.fn(),
    } as any;

    const result = await getHistory(mockClient, 'test.model', 1);
    expect(result).toEqual([]);
    expect(mockClient.read).not.toHaveBeenCalled();
  });

  it('builds a correct TrackingEvent from a synthetic row', async () => {
    const events = await getHistory(makeMockClient(), 'test.model', 1);
    expect(events).toHaveLength(1);

    const ev = events[0];
    expect(ev.id).toBe(1);
    expect(ev.messageId).toBe(100);
    expect(ev.model).toBe('test.model');
    expect(ev.recordId).toBe(1);
    expect(ev.date).toBe('2020-01-15 10:00:00');
    expect(ev.authorName).toBe('Test User');
    expect(ev.field.name).toBe('state');
    expect(ev.field.type).toBe('selection');
    expect(ev.old.display).toBe('option_a');
    expect(ev.new.display).toBe('option_b');
  });

  it('sends correct relational domain to mail.tracking.value', async () => {
    const mockClient = makeMockClient();
    await getHistory(mockClient, 'test.model', 42);

    const [model, domain] = mockClient.searchRead.mock.calls[0];
    expect(model).toBe('mail.tracking.value');
    expect(domain).toContainEqual(['mail_message_id.model', '=', 'test.model']);
    expect(domain).toContainEqual(['mail_message_id.res_id', '=', 42]);
  });

  it('appends since filter to domain when provided', async () => {
    const mockClient = makeMockClient([]);
    await getHistory(mockClient, 'test.model', 1, { since: '2020-06-01' });

    const [, domain] = mockClient.searchRead.mock.calls[0];
    expect(domain).toContainEqual(['create_date', '>=', '2020-06-01']);
  });

  it('appends until filter to domain when provided', async () => {
    const mockClient = makeMockClient([]);
    await getHistory(mockClient, 'test.model', 1, { until: '2021-01-01' });

    const [, domain] = mockClient.searchRead.mock.calls[0];
    expect(domain).toContainEqual(['create_date', '<', '2021-01-01']);
  });

  it('filters results by field name when opts.fields is given', async () => {
    const rowA = makeRow({
      id: 1,
      field_id: [10, 'Status (M)'],
      old_value_char: 'a',
      new_value_char: 'b',
      mail_message_id: [100, 'x'],
    });
    const rowB = makeRow({
      id: 2,
      field_id: [11, 'Name (M)'],
      old_value_char: 'x',
      new_value_char: 'y',
      mail_message_id: [100, 'x'],
    });
    const mockClient = {
      searchRead: vi.fn().mockImplementation(async (model: string) => {
        if (model === 'mail.tracking.value') return [rowA, rowB];
        if (model === 'ir.model.fields')
          return [
            { id: 10, name: 'state', ttype: 'selection', field_description: 'Status' },
            { id: 11, name: 'name', ttype: 'char', field_description: 'Name' },
          ];
        return [];
      }),
      read: vi.fn().mockResolvedValue([syntheticMessage]),
    } as any;

    const events = await getHistory(mockClient, 'test.model', 1, { fields: ['state'] });
    expect(events).toHaveLength(1);
    expect(events[0].field.name).toBe('state');
  });

  it('handles deleted-field case (field_id=false, field_info set)', async () => {
    const deletedRow = makeRow({
      id: 1,
      field_id: false,
      field_info: { name: 'removed_field', desc: 'Removed Field', type: 'char' },
      old_value_char: 'before',
      new_value_char: 'after',
      mail_message_id: [100, 'test.model,1'],
    });
    const mockClient = {
      searchRead: vi
        .fn()
        .mockImplementation(async (model: string) =>
          model === 'mail.tracking.value' ? [deletedRow] : []
        ),
      read: vi.fn().mockResolvedValue([syntheticMessage]),
    } as any;

    const events = await getHistory(mockClient, 'test.model', 1);
    expect(events).toHaveLength(1);
    expect(events[0].field.id).toBe(0);
    expect(events[0].field.name).toBe('removed_field');
    expect(events[0].field.label).toBe('Removed Field');
    expect(events[0].field.deletedInfo).toEqual({
      name: 'removed_field',
      desc: 'Removed Field',
      type: 'char',
    });
  });

  it('requests asc order by default', async () => {
    const mockClient = makeMockClient([]);
    await getHistory(mockClient, 'test.model', 1);
    const [, , opts] = mockClient.searchRead.mock.calls[0];
    expect(opts.order).toBe('id asc');
  });

  it('requests desc order when specified', async () => {
    const mockClient = makeMockClient([]);
    await getHistory(mockClient, 'test.model', 1, { order: 'desc' });
    const [, , opts] = mockClient.searchRead.mock.calls[0];
    expect(opts.order).toBe('id desc');
  });

  it('issues only one ir.model.fields call when multiple rows share the same field_id', async () => {
    const row2 = { ...syntheticTrackingRow, id: 2 };
    const mockClient = makeMockClient([syntheticTrackingRow, row2]);
    await getHistory(mockClient, 'test.model', 1);

    const fieldMetaCalls = mockClient.searchRead.mock.calls.filter(
      ([m]: [string]) => m === 'ir.model.fields'
    );
    expect(fieldMetaCalls).toHaveLength(1);
  });
});

// ── getFeed() pagination and cursor tests ─────────────────────────────────────

describe('getFeed()', () => {
  let getFeed: any;

  beforeEach(async () => {
    const mod = await import('../src/services/cdc/functions');
    getFeed = mod.getFeed;
  });

  function makeTrackingRow(id: number): RawTrackingRow {
    return makeRow({
      id,
      field_id: [10, 'Status (Model)'],
      old_value_char: 'option_a',
      new_value_char: 'option_b',
      mail_message_id: [200 + id, 'test.model,1'],
      create_date: '2020-01-15 10:00:00',
    });
  }

  /** Client whose searchRead cycles through pre-defined pages of tracking rows. */
  function makeFeedClient(pages: RawTrackingRow[][]): any {
    let pageIndex = 0;
    return {
      searchRead: vi.fn().mockImplementation(async (model: string) => {
        if (model === 'mail.tracking.value') return pages[pageIndex++] ?? [];
        if (model === 'ir.model.fields')
          return [{ id: 10, name: 'state', ttype: 'selection', field_description: 'Status' }];
        return [];
      }),
      read: vi.fn().mockImplementation(async (_model: string, ids: number[]) =>
        ids.map((id) => ({
          id,
          res_id: id,
          date: '2020-01-15 10:00:00',
          author_id: [1, 'Test User'],
        }))
      ),
    };
  }

  it('yields all events across multiple pages', async () => {
    const pages = [
      [makeTrackingRow(1), makeTrackingRow(2), makeTrackingRow(3)],
      [makeTrackingRow(4), makeTrackingRow(5)],
      [], // signals end
    ];
    const events = [];
    for await (const ev of getFeed(makeFeedClient(pages), 'test.model', { pageSize: 3 })) {
      events.push(ev);
    }
    expect(events).toHaveLength(5);
    expect(events.map((e: any) => e.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it('stops when a page returns fewer rows than pageSize', async () => {
    const pages = [
      [makeTrackingRow(1), makeTrackingRow(2)], // 2 < pageSize=3 → done
    ];
    const events = [];
    for await (const ev of getFeed(makeFeedClient(pages), 'test.model', { pageSize: 3 })) {
      events.push(ev);
    }
    expect(events).toHaveLength(2);
  });

  it('yields nothing when the first page is empty', async () => {
    const events = [];
    for await (const ev of getFeed(makeFeedClient([[]]), 'test.model', {})) {
      events.push(ev);
    }
    expect(events).toHaveLength(0);
  });

  it('uses create_date >= since filter on the first page only', async () => {
    const pages = [
      [makeTrackingRow(10), makeTrackingRow(11), makeTrackingRow(12)],
      [makeTrackingRow(13)],
    ];
    const client = makeFeedClient(pages);

    for await (const _ of getFeed(client, 'test.model', { since: '2020-01-01', pageSize: 3 })) {
      // consume
    }

    // Filter to tracking value calls only (ir.model.fields calls are interleaved)
    const tvCalls = client.searchRead.mock.calls.filter(
      ([m]: [string]) => m === 'mail.tracking.value'
    );

    // Page 1 must carry the since filter
    const [, page1Domain] = tvCalls[0];
    expect(page1Domain).toContainEqual(['create_date', '>=', '2020-01-01']);

    // Page 2 must use id > cursor — NOT a date filter
    const [, page2Domain] = tvCalls[1];
    expect(page2Domain).toContainEqual(['id', '>', 12]);
    const hasDateFilter = (page2Domain as any[]).some(
      (c: any) => Array.isArray(c) && c[0] === 'create_date' && c[1] === '>='
    );
    expect(hasDateFilter).toBe(false);
  });

  it('skips the since filter and uses id > cursor when cursor is provided', async () => {
    const client = makeFeedClient([[makeTrackingRow(50)]]);

    for await (const _ of getFeed(client, 'test.model', {
      cursor: 49,
      since: '2020-01-01',
    })) {
      // consume
    }

    const [, domain] = client.searchRead.mock.calls[0];
    expect(domain).toContainEqual(['id', '>', 49]);
    const hasDateFilter = (domain as any[]).some(
      (c: any) => Array.isArray(c) && c[0] === 'create_date' && c[1] === '>='
    );
    expect(hasDateFilter).toBe(false);
  });

  it('sets model on every yielded event', async () => {
    const client = makeFeedClient([[makeTrackingRow(1)]]);
    const events = [];
    for await (const ev of getFeed(client, 'test.model', {})) {
      events.push(ev);
    }
    expect(events[0].model).toBe('test.model');
  });

  it('uses id asc order for stable pagination', async () => {
    const client = makeFeedClient([[]]);
    for await (const _ of getFeed(client, 'test.model', {})) {
      // consume
    }
    const [, , opts] = client.searchRead.mock.calls[0];
    expect(opts.order).toBe('id asc');
  });
});
