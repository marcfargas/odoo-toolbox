/**
 * Field classification and filtering for data clone operations.
 *
 * Determines which fields to read during export and which to write
 * during import, based on introspected field metadata.
 */

import createDebug from 'debug';
import type { OdooField } from '@marcfargas/odoo-introspection';

const debug = createDebug('odoo-state-manager:clone:fields');

/**
 * System fields that are never exported or imported.
 * These are managed by the ORM and cannot (or should not) be written.
 */
const SYSTEM_FIELDS = new Set([
  'id',
  'create_uid',
  'create_date',
  'write_uid',
  'write_date',
  '__last_update',
  'display_name',
]);

/**
 * Fields that are always excluded from export/import because they
 * trigger side effects or are managed by Odoo subsystems (mail, activity, etc.).
 *
 * These fields are technically writable and non-computed, but writing them
 * during import causes constraint violations or unintended side effects.
 */
const ALWAYS_EXCLUDED_FIELDS = new Set([
  // Mail/messaging — writing these triggers follower subscriptions,
  // notification emails, and "cannot follow twice" constraints
  'message_follower_ids',
  'message_partner_ids',
  'message_ids',
  'message_main_attachment_id',
  'message_channel_ids',

  // Activity — triggers activity scheduling logic
  'activity_ids',
  'activity_user_id',
  'activity_type_id',
  'activity_date_deadline',
  'activity_summary',

  // Website — instance-specific
  'website_message_ids',
]);

/**
 * Determine which fields should be exported for a given model.
 *
 * Filters out:
 * - System/ORM-managed fields (id, create_date, etc.)
 * - Computed fields (have a `compute` definition)
 * - one2many fields (inverse relations — would pull unbounded data)
 * - Binary fields (unless explicitly included)
 * - Explicitly excluded fields
 *
 * @returns Array of field names to include in the export
 */
export function getExportableFields(
  fields: OdooField[],
  options: {
    excludeFields?: string[];
    includeBinaryFields?: boolean;
  } = {}
): string[] {
  const { excludeFields = [], includeBinaryFields = false } = options;
  const excludeSet = new Set(excludeFields);

  const result: string[] = [];

  for (const field of fields) {
    // Skip system fields
    if (SYSTEM_FIELDS.has(field.name)) {
      continue;
    }

    // Skip always-excluded fields (mail, activity, etc.)
    if (ALWAYS_EXCLUDED_FIELDS.has(field.name)) {
      continue;
    }

    // Skip explicitly excluded fields
    if (excludeSet.has(field.name)) {
      continue;
    }

    // Skip computed fields — they will be recomputed on create
    if (field.compute) {
      debug('skipping computed field %s.%s', field.model, field.name);
      continue;
    }

    // Skip readonly fields — these cannot be written via create/write
    if (field.readonly) {
      debug('skipping readonly field %s.%s', field.model, field.name);
      continue;
    }

    // Skip one2many (inverse relations, can't write directly)
    if (field.ttype === 'one2many') {
      continue;
    }

    // Skip binary fields unless explicitly included
    if (field.ttype === 'binary' && !includeBinaryFields) {
      debug('skipping binary field %s.%s', field.model, field.name);
      continue;
    }

    result.push(field.name);
  }

  return result;
}

/**
 * Extract many2one references from a record's field values.
 *
 * Odoo returns many2one fields as `[id, display_name]` tuples or `false`.
 * This function extracts the `(model, id)` pairs for dependency resolution.
 *
 * @returns Array of `{ model, id }` references found in the record
 */
export function extractMany2oneRefs(
  record: Record<string, unknown>,
  fields: OdooField[]
): Array<{ model: string; id: number }> {
  const refs: Array<{ model: string; id: number }> = [];

  for (const field of fields) {
    if (field.ttype !== 'many2one' || !field.relation) {
      continue;
    }

    const value = record[field.name];
    const id = normalizeMany2oneId(value);
    if (id !== null) {
      refs.push({ model: field.relation, id });
    }
  }

  return refs;
}

/**
 * Normalize a many2one field value to a plain numeric ID.
 *
 * Handles the two shapes Odoo returns:
 * - `[id, display_name]` → id
 * - `id` (number) → id
 * - `false` / null / undefined → null
 */
export function normalizeMany2oneId(value: unknown): number | null {
  if (Array.isArray(value) && value.length >= 2 && typeof value[0] === 'number') {
    return value[0];
  }
  if (typeof value === 'number' && value > 0) {
    return value;
  }
  return null;
}

/**
 * Normalize all many2one fields in a record from `[id, name]` tuples to plain IDs.
 * Returns a new object (does not mutate the input).
 */
export function normalizeRecord(
  record: Record<string, unknown>,
  fields: OdooField[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const m2oFields = new Set(fields.filter((f) => f.ttype === 'many2one').map((f) => f.name));

  for (const [key, value] of Object.entries(record)) {
    if (m2oFields.has(key)) {
      const id = normalizeMany2oneId(value);
      result[key] = id !== null ? id : false;
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Identify many2one fields that reference the same model (self-referential).
 *
 * These need special handling during import: create with null, then update
 * in a second pass after all records of this model exist.
 */
export function getSelfReferentialFields(model: string, fields: OdooField[]): string[] {
  return fields.filter((f) => f.ttype === 'many2one' && f.relation === model).map((f) => f.name);
}
