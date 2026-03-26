import createDebug from 'debug';
import type { OdooField } from '@marcfargas/odoo-introspection';
import type { ResolvedState, ResolvedResource } from './types';

const debug = createDebug('odoo-state-manager:diff');

// ---------------------------------------------------------------------------
// System fields — always skipped during diff
// ---------------------------------------------------------------------------

const SYSTEM_FIELDS = new Set([
  'id',
  '__last_update',
  'write_date',
  'create_date',
  'write_uid',
  'create_uid',
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FieldDiff {
  field: string;
  desired: unknown;
  actual: unknown;
}

export interface TranslationFieldDiff {
  field: string;
  lang: string;
  desired: unknown;
  actual: unknown;
}

export interface DiffResult {
  resource: ResolvedResource;
  mode: 'create' | 'update';
  /** Empty for create mode — all fields are new. */
  changes: FieldDiff[];
  /** Diffs for translated field values in non-default languages. */
  translationChanges: TranslationFieldDiff[];
  /** true for creates, or updates with at least one diff. */
  hasChanges: boolean;
}

interface DiffClient {
  read<T = any>(
    model: string,
    ids: number[],
    fields?: string[],
    context?: Record<string, unknown>
  ): Promise<T[]>;
}

// ---------------------------------------------------------------------------
// normalizeFieldValue
// ---------------------------------------------------------------------------

/**
 * Normalize an Odoo field value for comparison.
 *
 * - many2one: `[42, 'Display Name']` → `42`, `false` → `null`
 * - one2many/many2many: sort array numerically for order-insensitive comparison
 * - everything else: pass through unchanged
 */
export function normalizeFieldValue(value: unknown, fieldType: string): unknown {
  switch (fieldType) {
    case 'many2one': {
      if (value === false) return null;
      if (Array.isArray(value) && value.length === 2) return value[0];
      return value;
    }
    case 'one2many':
    case 'many2many': {
      if (Array.isArray(value)) {
        return [...value].sort((a, b) => (a as number) - (b as number));
      }
      return value;
    }
    default:
      return value;
  }
}

// ---------------------------------------------------------------------------
// diffRecord
// ---------------------------------------------------------------------------

/**
 * Compare desired field values against actual field values from Odoo.
 *
 * - Skips system fields (id, write_date, etc.)
 * - Skips readonly and computed fields when field metadata is provided
 * - Normalizes both values before comparing (many2one, many2many, one2many)
 *
 * @returns Array of FieldDiff for fields whose values differ.
 */
export function diffRecord(
  desired: Record<string, unknown>,
  actual: Record<string, unknown>,
  fields?: Map<string, OdooField>
): FieldDiff[] {
  const diffs: FieldDiff[] = [];

  for (const [fieldName, desiredValue] of Object.entries(desired)) {
    // Skip system fields
    if (SYSTEM_FIELDS.has(fieldName)) {
      debug('skip system field %s', fieldName);
      continue;
    }

    // Skip readonly/computed fields when metadata available
    if (fields) {
      const meta = fields.get(fieldName);
      if (meta) {
        if (meta.readonly) {
          debug('skip readonly field %s', fieldName);
          continue;
        }
        if (meta.compute) {
          debug('skip computed field %s', fieldName);
          continue;
        }
      }
    }

    // Determine field type for normalization
    const fieldType = fields?.get(fieldName)?.ttype ?? 'char';

    const normalizedDesired = normalizeFieldValue(desiredValue, fieldType);
    const normalizedActual = normalizeFieldValue(actual[fieldName], fieldType);

    if (!valuesEqual(normalizedDesired, normalizedActual)) {
      debug('field %s changed: %o → %o', fieldName, normalizedActual, normalizedDesired);
      diffs.push({ field: fieldName, desired: normalizedDesired, actual: normalizedActual });
    }
  }

  return diffs;
}

// ---------------------------------------------------------------------------
// valuesEqual (deep equality for arrays and primitives)
// ---------------------------------------------------------------------------

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// diffResources
// ---------------------------------------------------------------------------

/**
 * Compare all resolved resources against actual Odoo state.
 *
 * - 'update' mode: fetches the actual record via client.read(), then diffs
 * - 'create' mode: all fields are new — no fetching needed
 *
 * @returns DiffResult per resource
 */
export async function diffResources(
  resolved: ResolvedState,
  client: DiffClient,
  introspector: { getFields(model: string): Promise<OdooField[]> }
): Promise<DiffResult[]> {
  const results: DiffResult[] = [];

  for (const resource of resolved.resources) {
    if (resource.mode === 'create') {
      debug('resource %s (create) — all fields new', resource.model);
      results.push({
        resource,
        mode: 'create',
        changes: [],
        translationChanges: [],
        hasChanges: true,
      });
      continue;
    }

    // update mode — fetch actual record and diff
    const fieldNames = Object.keys(resource.resolvedValues);
    const actualRecords = await client.read(resource.model, [resource.resolvedId!], fieldNames);
    const actual = (actualRecords[0] ?? {}) as Record<string, unknown>;

    debug('fetched actual record %s#%d', resource.model, resource.resolvedId);

    // Build field metadata map for this model
    const rawFields = await introspector.getFields(resource.model);
    const fieldMap = new Map<string, OdooField>(rawFields.map((f) => [f.name, f]));

    const changes = diffRecord(resource.resolvedValues, actual, fieldMap);

    // Diff translations if present
    const translationChanges: TranslationFieldDiff[] = [];
    if (resource.translations && resource.translations.entries.length > 0) {
      // Group translations by language
      const byLang = new Map<string, Array<{ field: string; value: unknown }>>();
      for (const entry of resource.translations.entries) {
        if (!byLang.has(entry.lang)) byLang.set(entry.lang, []);
        byLang.get(entry.lang)!.push({ field: entry.field, value: entry.value });
      }

      for (const [lang, langFields] of byLang) {
        const fieldNamesForLang = langFields.map((f) => f.field);
        const actualLangRecords = await client.read(
          resource.model,
          [resource.resolvedId!],
          fieldNamesForLang,
          { lang }
        );
        const actualLang = (actualLangRecords[0] ?? {}) as Record<string, unknown>;

        for (const { field, value } of langFields) {
          const fieldType = fieldMap.get(field)?.ttype ?? 'char';
          const normalizedDesired = normalizeFieldValue(value, fieldType);
          const normalizedActual = normalizeFieldValue(actualLang[field], fieldType);

          if (!valuesEqual(normalizedDesired, normalizedActual)) {
            translationChanges.push({
              field,
              lang,
              desired: normalizedDesired,
              actual: normalizedActual,
            });
          }
        }
      }
    }

    results.push({
      resource,
      mode: 'update',
      changes,
      translationChanges,
      hasChanges: changes.length > 0 || translationChanges.length > 0,
    });
  }

  return results;
}
