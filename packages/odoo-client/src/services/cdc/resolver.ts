/**
 * Resolver: converts raw mail.tracking.value columns into TypedValue pairs.
 *
 * ## Resolver contract
 *
 * | ttype              | column(s)                                    | notes                              |
 * |--------------------|----------------------------------------------|------------------------------------|
 * | char / binary      | old/new_value_char                           |                                    |
 * | text / html        | old/new_value_text (fallback: _char)         |                                    |
 * | integer            | old/new_value_integer                        |                                    |
 * | boolean            | old/new_value_integer                        | 0 → false, 1 → true               |
 * | float              | old/new_value_float                          |                                    |
 * | monetary           | old/new_value_float + currency_id            | currency carries [id, code]        |
 * | datetime           | old/new_value_datetime                       | ISO 'YYYY-MM-DD HH:MM:SS'          |
 * | date               | old/new_value_datetime                       | strip time component               |
 * | selection          | old/new_value_char                           | translated label; isTranslated:true|
 * | many2one           | old/new_value_integer (id) + _char (name)    | id in .id                          |
 * | many2many/one2many | not tracked by Odoo                          | raw: null                          |
 * | unknown/other      | —                                            | raw: null                          |
 *
 * @see https://github.com/odoo/odoo/blob/17.0/addons/mail/models/mail_tracking_value.py
 */

import type { OdooFieldType, TypedValue } from './types';

/** Raw row from mail.tracking.value as returned by Odoo RPC */
export interface RawTrackingRow {
  id: number;
  field_id: [number, string] | false;
  /** field_info is set when the field was deleted; field_id is false in that case */
  field_info: { name: string; desc: string; type: string; sequence?: number } | false;
  old_value_char: string | false;
  new_value_char: string | false;
  old_value_text: string | false;
  new_value_text: string | false;
  old_value_integer: number | false;
  new_value_integer: number | false;
  old_value_float: number | false;
  new_value_float: number | false;
  old_value_datetime: string | false;
  new_value_datetime: string | false;
  currency_id: [number, string] | false;
  mail_message_id: [number, string];
  create_date: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function str(v: string | false): string | null {
  return v === false || v === '' ? null : v;
}

function num(v: number | false): number | null {
  return v === false ? null : v;
}

// ── Main resolver ─────────────────────────────────────────────────────────────

/**
 * Resolve raw tracking value columns into typed old/new pair.
 *
 * Never throws — unknown ttypes return `{ raw: null, display: null }`.
 */
export function resolveValues(
  row: RawTrackingRow,
  ttype: OdooFieldType
): { old: TypedValue; new: TypedValue } {
  switch (ttype) {
    case 'char':
    case 'binary': {
      const o = str(row.old_value_char);
      const n = str(row.new_value_char);
      return { old: { raw: o, display: o }, new: { raw: n, display: n } };
    }

    case 'text':
    case 'html': {
      // Odoo uses old_value_text for long strings, falls back to old_value_char
      const o = str(row.old_value_text) ?? str(row.old_value_char);
      const n = str(row.new_value_text) ?? str(row.new_value_char);
      return { old: { raw: o, display: o }, new: { raw: n, display: n } };
    }

    case 'integer': {
      const o = num(row.old_value_integer);
      const n = num(row.new_value_integer);
      return {
        old: { raw: o, display: o !== null ? String(o) : null },
        new: { raw: n, display: n !== null ? String(n) : null },
      };
    }

    case 'boolean': {
      const toBool = (v: number | false): boolean | null => (v === false ? null : v !== 0);
      const o = toBool(row.old_value_integer);
      const n = toBool(row.new_value_integer);
      return {
        old: { raw: o, display: o !== null ? (o ? 'Yes' : 'No') : null },
        new: { raw: n, display: n !== null ? (n ? 'Yes' : 'No') : null },
      };
    }

    case 'float': {
      const o = num(row.old_value_float);
      const n = num(row.new_value_float);
      return {
        old: { raw: o, display: o !== null ? String(o) : null },
        new: { raw: n, display: n !== null ? String(n) : null },
      };
    }

    case 'monetary': {
      const o = num(row.old_value_float);
      const n = num(row.new_value_float);
      const currency = row.currency_id === false ? undefined : row.currency_id;
      return {
        old: { raw: o, display: o !== null ? String(o) : null, ...(currency && { currency }) },
        new: { raw: n, display: n !== null ? String(n) : null, ...(currency && { currency }) },
      };
    }

    case 'datetime': {
      const o = str(row.old_value_datetime);
      const n = str(row.new_value_datetime);
      return { old: { raw: o, display: o }, new: { raw: n, display: n } };
    }

    case 'date': {
      const toDate = (s: string | false): string | null => {
        const v = str(s);
        return v ? v.split(' ')[0] : null;
      };
      const o = toDate(row.old_value_datetime);
      const n = toDate(row.new_value_datetime);
      return { old: { raw: o, display: o }, new: { raw: n, display: n } };
    }

    case 'selection': {
      const o = str(row.old_value_char);
      const n = str(row.new_value_char);
      return {
        old: { raw: o, display: o, isTranslated: true },
        new: { raw: n, display: n, isTranslated: true },
      };
    }

    case 'many2one': {
      const oId = num(row.old_value_integer);
      const nId = num(row.new_value_integer);
      const oName = str(row.old_value_char);
      const nName = str(row.new_value_char);
      return {
        old: { raw: oId, display: oName, ...(oId !== null && { id: oId }) },
        new: { raw: nId, display: nName, ...(nId !== null && { id: nId }) },
      };
    }

    // many2many / one2many are not tracked by Odoo's mail.tracking mechanism
    case 'many2many':
    case 'one2many':
    default:
      return {
        old: { raw: null, display: null },
        new: { raw: null, display: null },
      };
  }
}
