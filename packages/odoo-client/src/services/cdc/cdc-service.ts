/**
 * CDC service — Change Data Capture via mail.tracking.value.
 *
 * Access via `client.cdc` — never instantiate directly.
 *
 * ## What it does
 * Exposes Odoo's native field-change audit log as a typed stream.
 * Every time a tracked field changes, Odoo writes a mail.tracking.value row.
 * This service reads, resolves, and surfaces those rows as TrackingEvent objects.
 *
 * ## Coverage
 * - Parent models: any model with `_inherit = 'mail.thread'` and fields with `tracking=True`
 * - Child models (e.g. contract.line): only if they also inherit mail.thread
 *
 * ## Phase 1 (implemented here)
 * - `check(model)` — diagnose CDC coverage
 * - `getHistory(model, id)` — full tracked history for one record
 * - `getFeed(model, opts)` — paginated stream of all changes (for sync/migration)
 *
 * ## Phase 2 (planned)
 * - `getStateAt(model, id, timestamp)` — reconstruct field values at a point in time
 * - `getHistoryWithChildren(...)` — parent + child record history merged
 */

import type { OdooClient } from '../../client/odoo-client';
import { check as _check, getHistory as _getHistory, getFeed as _getFeed } from './functions';
import type { CdcCheckResult, GetFeedOptions, GetHistoryOptions, TrackingEvent } from './types';

export class CdcService {
  /** @internal */
  constructor(private client: OdooClient) {}

  /**
   * Check if a model supports CDC and report its tracking coverage.
   *
   * Useful as a first step before streaming history.
   *
   * ```typescript
   * const info = await client.cdc.check('contract.contract');
   * // { model: 'contract.contract', isMailThread: true, trackedFieldCount: 12, hasHistory: true }
   * ```
   *
   * RPCs: 2
   */
  async check(model: string): Promise<CdcCheckResult> {
    return _check(this.client, model);
  }

  /**
   * Get all tracked field changes for a single record, in chronological order.
   *
   * Each event represents one field change: who changed what, from what to what, when.
   * Multiple fields changed in the same write share the same `messageId`.
   *
   * ```typescript
   * const events = await client.cdc.getHistory('contract.contract', 42);
   * for (const ev of events) {
   *   console.log(`${ev.date} ${ev.authorName}: ${ev.field.label} ${ev.old.display} → ${ev.new.display}`);
   * }
   * ```
   *
   * RPCs: 2
   */
  async getHistory(model: string, id: number, opts?: GetHistoryOptions): Promise<TrackingEvent[]> {
    return _getHistory(this.client, model, id, opts);
  }

  /**
   * Stream all tracked changes for a model as a paginated async iterable.
   *
   * Use for bulk history extraction, migration, or external sync.
   * Internally pages through mail.tracking.value using an id-based cursor.
   * Resumes cleanly: pass `cursor` from a previous run's last event id.
   *
   * ```typescript
   * for await (const ev of client.cdc.getFeed('contract.contract', { since: '2025-01-01' })) {
   *   await myDb.upsert('field_changes', ev);
   * }
   * ```
   *
   * RPCs per page: 3 (first), 2 (subsequent — field metadata cached)
   */
  getFeed(model: string, opts?: GetFeedOptions): AsyncIterable<TrackingEvent> {
    return _getFeed(this.client, model, opts);
  }
}
