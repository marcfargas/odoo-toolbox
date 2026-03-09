/**
 * CDC (Change Data Capture) service types.
 * Built on mail.tracking.value — Odoo's native field-change audit log.
 */

export type OdooFieldType =
  | 'char'
  | 'text'
  | 'html'
  | 'integer'
  | 'float'
  | 'monetary'
  | 'datetime'
  | 'date'
  | 'boolean'
  | 'selection'
  | 'many2one'
  | 'many2many'
  | 'one2many'
  | 'binary'
  | string;

/**
 * Metadata about the field that was changed.
 * When a field is deleted from the schema after being tracked,
 * `deletedInfo` carries the preserved metadata and `id` is 0.
 */
export interface FieldMeta {
  /** ir.model.fields id (0 if field was deleted) */
  id: number;
  /** Technical field name, e.g. 'state' */
  name: string;
  /** Display label at time of change, e.g. 'Status' */
  label: string;
  type: OdooFieldType;
  /**
   * Preserved metadata when the field was deleted after tracking.
   * Odoo stores { name, desc, type, sequence? } in mail.tracking.value.field_info.
   *
   * @see https://github.com/odoo/odoo/blob/17.0/addons/mail/models/mail_tracking_value.py
   */
  deletedInfo?: { name: string; desc: string; type: string; sequence?: number };
}

/**
 * A typed before/after value for a single field change.
 *
 * `raw` is the machine value; `display` is human-readable.
 * For many2one, `id` carries the related record ID.
 * For monetary, `currency` carries [id, code].
 * For selection, `isTranslated: true` signals the value is locale-dependent.
 */
export interface TypedValue {
  raw: string | number | boolean | null;
  display: string | null;
  /** many2one only: the related record ID */
  id?: number;
  /** monetary only: [currency_id, currency_code] */
  currency?: [number, string];
  /** selection only: value is a translated label, not the technical key */
  isTranslated?: true;
}

/**
 * A single tracked field change: one row from mail.tracking.value,
 * enriched with message and field metadata.
 */
export interface TrackingEvent {
  /** mail.tracking.value id */
  id: number;
  /** mail.message id — groups all fields changed in the same write operation */
  messageId: number;
  model: string;
  recordId: number;
  /** ISO datetime from mail.tracking.value.create_date (≈ mail.message.date) */
  date: string;
  authorId: number;
  authorName: string;
  field: FieldMeta;
  old: TypedValue;
  new: TypedValue;
}

/**
 * Result of `cdc.check()` — diagnostic about a model's CDC coverage.
 */
export interface CdcCheckResult {
  model: string;
  /** Whether the model inherits mail.thread */
  isMailThread: boolean;
  /** Number of fields with tracking > 0 in the current schema */
  trackedFieldCount: number;
  /** Whether any mail.tracking.value records exist for this model */
  hasHistory: boolean;
}

/**
 * Options for getHistory()
 */
export interface GetHistoryOptions {
  /** Filter to specific field technical names */
  fields?: string[];
  /** Only events on or after this ISO datetime */
  since?: string;
  /** Only events before this ISO datetime */
  until?: string;
  /** Default: 'asc' */
  order?: 'asc' | 'desc';
}

/**
 * Options for getFeed()
 */
export interface GetFeedOptions {
  /** Additional domain on mail.tracking.value */
  domain?: unknown[];
  /** Only events on or after this ISO datetime (used as initial filter only) */
  since?: string;
  /** Only events before this ISO datetime */
  until?: string;
  /** Records per page (default: 100) */
  pageSize?: number;
  /** Resume from a previous cursor (returned by previous page) */
  cursor?: number;
}
