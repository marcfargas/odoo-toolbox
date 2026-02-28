/**
 * CDC service core logic: check, getHistory, getFeed.
 *
 * ## RPC query strategy
 *
 * ### getHistory(model, id) — 2 RPCs
 * 1. searchRead mail.tracking.value filtered by model+res_id via relational domain
 * 2. searchRead ir.model.fields for ttype/name resolution (batch, keyed by field_id)
 *
 * ### getFeed(model, opts) — 3 RPCs first page, 2 subsequent (with field cache)
 * 1. searchRead mail.tracking.value with id > cursor, order id asc
 * 2. searchRead mail.message by ID set for res_id + author
 * 3. searchRead ir.model.fields for field metadata (cached after first page)
 *
 * ## Cursor design
 * getFeed uses plain `id > lastId` on mail.tracking.value.
 * create_date has sub-second DB precision — equality comparisons fail.
 * since/until are INITIAL filters only; continuation uses id cursor.
 *
 * @see https://github.com/odoo/odoo/blob/17.0/addons/mail/models/mail_tracking_value.py
 */

import debug from 'debug';
import type { OdooClient } from '../../client/odoo-client';
import { FieldMetaCache, type CachedFieldMeta } from './field-cache';
import { resolveValues, type RawTrackingRow } from './resolver';
import type {
  CdcCheckResult,
  FieldMeta,
  GetFeedOptions,
  GetHistoryOptions,
  OdooFieldType,
  TrackingEvent,
} from './types';

const log = debug('odoo-client:cdc');

// ── Field constants ───────────────────────────────────────────────────────────

/** Fields to fetch from mail.tracking.value */
const TV_FIELDS = [
  'field_id',
  'field_info',
  'old_value_char',
  'new_value_char',
  'old_value_text',
  'new_value_text',
  'old_value_integer',
  'new_value_integer',
  'old_value_float',
  'new_value_float',
  'old_value_datetime',
  'new_value_datetime',
  'currency_id',
  'mail_message_id',
  'create_date',
];

/** Fields to fetch from mail.message */
const MSG_FIELDS = ['id', 'res_id', 'date', 'author_id'];

/** Fields to fetch from ir.model.fields */
const FIELD_META_FIELDS = ['id', 'name', 'ttype', 'field_description'];

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Resolve field metadata for a batch of field IDs.
 * Uses cache; fetches missing IDs from Odoo.
 */
async function resolveFieldMeta(
  client: OdooClient,
  fieldIds: number[],
  cache: FieldMetaCache
): Promise<Map<number, CachedFieldMeta>> {
  const result = new Map<number, CachedFieldMeta>();

  // Fill from cache first
  for (const id of fieldIds) {
    const cached = cache.get(id);
    if (cached) result.set(id, cached);
  }

  // Fetch missing IDs
  const missing = cache.missing(fieldIds);
  if (missing.length > 0) {
    log('fetching %d field metadata entries from ir.model.fields', missing.length);
    const rows = await client.searchRead<CachedFieldMeta>(
      'ir.model.fields',
      [['id', 'in', missing]],
      { fields: FIELD_META_FIELDS }
    );
    for (const row of rows) {
      cache.set(row);
      result.set(row.id, row);
    }
  }

  return result;
}

/**
 * Build a FieldMeta from a tracking value row and resolved field metadata.
 * Handles the deleted-field case where field_id is false but field_info is set.
 */
function buildFieldMeta(row: RawTrackingRow, resolved: Map<number, CachedFieldMeta>): FieldMeta {
  if (row.field_id !== false) {
    const [fieldId, fieldLabel] = row.field_id;
    const meta = resolved.get(fieldId);
    return {
      id: fieldId,
      name: meta?.name ?? String(fieldId),
      label: fieldLabel,
      type: (meta?.ttype ?? 'unknown') as OdooFieldType,
    };
  }

  // Field was deleted — use preserved field_info JSON
  if (row.field_info) {
    const fi = row.field_info;
    return {
      id: 0,
      name: fi.name,
      label: fi.desc,
      type: fi.type as OdooFieldType,
      deletedInfo: fi,
    };
  }

  // Neither field_id nor field_info — should not happen, but handle gracefully
  return { id: 0, name: '(unknown)', label: '(unknown)', type: 'unknown' };
}

/**
 * Assemble TrackingEvent from a raw row, field metadata, and message data.
 */
function buildEvent(
  row: RawTrackingRow,
  fieldMeta: FieldMeta,
  messageData: { res_id: number; date: string; author_id: [number, string] | false }
): TrackingEvent {
  const { old: oldVal, new: newVal } = resolveValues(row, fieldMeta.type);
  const authorId = messageData.author_id !== false ? messageData.author_id[0] : 0;
  const authorName = messageData.author_id !== false ? messageData.author_id[1] : 'Unknown';

  return {
    id: row.id,
    messageId: row.mail_message_id[0],
    model: '', // filled by caller
    recordId: messageData.res_id,
    date: row.create_date,
    authorId,
    authorName,
    field: fieldMeta,
    old: oldVal,
    new: newVal,
  };
}

// ── Public functions ──────────────────────────────────────────────────────────

/**
 * Check if a model supports CDC and report its tracking coverage.
 *
 * RPCs: 2 (ir.model.fields + mail.tracking.value count)
 */
export async function check(client: OdooClient, model: string): Promise<CdcCheckResult> {
  log('check %s', model);

  // RPC 1: model fields — detect mail.thread + count tracked fields
  const fields = await client.searchRead<{
    name: string;
    tracking: number | false;
  }>('ir.model.fields', [['model', '=', model]], {
    fields: ['name', 'tracking'],
    limit: 1000,
  });

  const isMailThread = fields.some((f) => f.name === 'message_ids');
  const trackedFieldCount = fields.filter(
    (f) => f.tracking !== false && f.tracking !== null && (f.tracking as number) > 0
  ).length;

  // RPC 2: count existing tracking history
  const historyCount = await client.searchCount('mail.tracking.value', [
    ['mail_message_id.model', '=', model],
  ]);

  return {
    model,
    isMailThread,
    trackedFieldCount,
    hasHistory: historyCount > 0,
  };
}

/**
 * Get all tracked field changes for a single record.
 *
 * RPCs: 2 (mail.tracking.value + ir.model.fields)
 */
export async function getHistory(
  client: OdooClient,
  model: string,
  id: number,
  opts: GetHistoryOptions = {}
): Promise<TrackingEvent[]> {
  log('getHistory %s#%d', model, id);

  const domain: unknown[] = [
    ['mail_message_id.model', '=', model],
    ['mail_message_id.res_id', '=', id],
  ];

  if (opts.since) domain.push(['create_date', '>=', opts.since]);
  if (opts.until) domain.push(['create_date', '<', opts.until]);

  const order = opts.order === 'desc' ? 'id desc' : 'id asc';

  // RPC 1: all tracking values for this record
  const rows = await client.searchRead<RawTrackingRow>('mail.tracking.value', domain, {
    fields: TV_FIELDS,
    order,
  });

  if (rows.length === 0) return [];

  // Filter by field name if requested
  const filtered =
    opts.fields && opts.fields.length > 0
      ? rows.filter((r) => {
          if (r.field_id !== false) {
            // We don't know the name yet — will filter after resolving meta
            return true; // include for now, filter below
          }
          if (r.field_info) {
            return opts.fields!.includes(r.field_info.name);
          }
          return false;
        })
      : rows;

  // RPC 2: batch resolve field metadata
  const fieldIds = [
    ...new Set(filtered.flatMap((r) => (r.field_id !== false ? [r.field_id[0]] : []))),
  ];
  const cache = new FieldMetaCache();
  const fieldMetaMap = await resolveFieldMeta(client, fieldIds, cache);

  // Build events (we have res_id and author from the message via create_uid/create_date)
  // For getHistory, we need author — fetch from mail.message
  const msgIds = [...new Set(filtered.map((r) => r.mail_message_id[0]))];
  log('fetching %d messages for author/res_id', msgIds.length);
  const messages = await client.read<{
    id: number;
    res_id: number;
    date: string;
    author_id: [number, string] | false;
  }>('mail.message', msgIds, MSG_FIELDS);

  const msgMap = new Map(messages.map((m) => [m.id, m]));

  const events: TrackingEvent[] = [];
  for (const row of filtered) {
    const fieldMeta = buildFieldMeta(row, fieldMetaMap);

    // Apply field name filter after resolving
    if (opts.fields && opts.fields.length > 0 && !opts.fields.includes(fieldMeta.name)) {
      continue;
    }

    const msg = msgMap.get(row.mail_message_id[0]);
    if (!msg) {
      log('warn: message %d not found for tracking value %d', row.mail_message_id[0], row.id);
      continue;
    }

    const event = buildEvent(row, fieldMeta, msg);
    event.model = model;
    events.push(event);
  }

  return events;
}

/**
 * Paginated feed of all tracked changes for a model.
 * Returns an AsyncIterable — iterate with `for await`.
 *
 * RPCs per page: 3 first page, 2 subsequent (field metadata cached).
 *
 * ```typescript
 * for await (const event of client.cdc.getFeed('contract.contract', { since: '2025-01-01' })) {
 *   console.log(event.recordId, event.field.name, event.old.display, '→', event.new.display);
 * }
 * ```
 */
export async function* getFeed(
  client: OdooClient,
  model: string,
  opts: GetFeedOptions = {}
): AsyncIterable<TrackingEvent> {
  const pageSize = opts.pageSize ?? 100;
  const fieldCache = new FieldMetaCache();
  let cursor = opts.cursor ?? 0;
  let page = 0;

  log('getFeed %s pageSize=%d since=%s cursor=%d', model, pageSize, opts.since, cursor);

  while (true) {
    page++;

    // Build domain
    const domain: unknown[] = [['mail_message_id.model', '=', model]];

    if (cursor === 0 && opts.since) {
      // Initial filter: start from since date
      domain.push(['create_date', '>=', opts.since]);
    } else {
      // Continuation: id-only cursor (avoids sub-second datetime precision issues)
      domain.push(['id', '>', cursor]);
    }

    if (opts.until) domain.push(['create_date', '<', opts.until]);
    if (opts.domain && opts.domain.length > 0) domain.push(...opts.domain);

    log('page %d: cursor=%d domain=%j', page, cursor, domain);

    // RPC 1: tracking values
    const rows = await client.searchRead<RawTrackingRow>('mail.tracking.value', domain, {
      fields: TV_FIELDS,
      order: 'id asc',
      limit: pageSize,
    });

    if (rows.length === 0) {
      log('page %d: empty, done', page);
      return;
    }

    // RPC 2: message data for res_id + author
    const msgIds = [...new Set(rows.map((r) => r.mail_message_id[0]))];
    const messages = await client.read<{
      id: number;
      res_id: number;
      date: string;
      author_id: [number, string] | false;
    }>('mail.message', msgIds, MSG_FIELDS);
    const msgMap = new Map(messages.map((m) => [m.id, m]));

    // RPC 3 (first page) or cache: field metadata
    const fieldIds = [
      ...new Set(rows.flatMap((r) => (r.field_id !== false ? [r.field_id[0]] : []))),
    ];
    const fieldMetaMap = await resolveFieldMeta(client, fieldIds, fieldCache);

    // Build and yield events
    for (const row of rows) {
      const fieldMeta = buildFieldMeta(row, fieldMetaMap);
      const msg = msgMap.get(row.mail_message_id[0]);
      if (!msg) {
        log('warn: message %d not found for tracking value %d', row.mail_message_id[0], row.id);
        continue;
      }
      const event = buildEvent(row, fieldMeta, msg);
      event.model = model;
      yield event;
    }

    // Advance cursor to last row's id
    cursor = rows[rows.length - 1].id;
    log('page %d: yielded %d events, cursor now %d', page, rows.length, cursor);

    // If we got fewer rows than pageSize, we're done
    if (rows.length < pageSize) {
      log('page %d: last page (got %d < %d)', page, rows.length, pageSize);
      return;
    }
  }
}
