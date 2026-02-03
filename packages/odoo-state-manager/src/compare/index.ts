/**
 * State comparison module.
 *
 * Compares desired state against actual Odoo state to detect drift.
 *
 * Handles Odoo-specific field types and quirks:
 * - many2one fields return [id, display_name] from Odoo but accept just id
 * - one2many/many2many return arrays of IDs from read() operations
 * - computed/readonly fields are ignored in comparisons
 * - null values and empty arrays are normalized for comparison
 */

import { OdooField } from '@odoo-toolbox/introspection';
import { FieldChange, ModelDiff } from '../types';

/**
 * Options for comparison behavior.
 */
export interface CompareOptions {
  /**
   * Field metadata to determine which fields are readonly/computed.
   * If provided, computed and readonly fields are ignored.
   * Format: Map<modelName, Map<fieldName, OdooField>>
   */
  fieldMetadata?: Map<string, Map<string, OdooField>>;

  /**
   * Whether to include null/undefined values in changes.
   * Default: true (report all differences)
   */
  includeNullValues?: boolean;

  /**
   * Custom comparison function for complex field types.
   * Receives (fieldName, desired, actual) and returns true if equal.
   */
  customComparators?: Map<string, (d: any, a: any) => boolean>;
}

/**
 * Deep compare desired state against actual Odoo state.
 *
 * Handles Odoo-specific field types:
 * - many2one: Normalizes [id, name] from read() to just id
 * - one2many/many2many: Compares as ID arrays
 * - computed/readonly: Skips if field metadata available
 *
 * @param model Odoo model name
 * @param id Record ID
 * @param desiredState Desired field values
 * @param actualState Actual field values from Odoo
 * @param options Comparison options (field metadata, custom comparators)
 * @returns Array of field changes detected
 *
 * @example
 * ```typescript
 * const changes = compareRecord(
 *   'project.project',
 *   1,
 *   { name: 'Q1 Planning', partner_id: 5 },
 *   { name: 'Q1', partner_id: [5, 'ACME Corp'] }
 * );
 * // Returns changes for 'name' and 'partner_id' fields
 * ```
 */
export function compareRecord(
  model: string,
  id: number,
  desiredState: Record<string, any>,
  actualState: Record<string, any>,
  options: CompareOptions = {}
): FieldChange[] {
  const changes: FieldChange[] = [];
  const { fieldMetadata, customComparators } = options;

  // Get field info for this model to check for readonly/computed
  const modelFields = fieldMetadata?.get(model);

  // Check desired fields against actual
  for (const [fieldName, desiredValue] of Object.entries(desiredState)) {
    // Skip readonly and computed fields
    if (modelFields) {
      const fieldInfo = modelFields.get(fieldName);
      if (fieldInfo?.readonly || fieldInfo?.compute) {
        continue;
      }
    }

    const actualValue = actualState[fieldName];

    // Use custom comparator if available
    if (customComparators?.has(fieldName)) {
      const isEqual = customComparators.get(fieldName)!(desiredValue, actualValue);
      if (!isEqual) {
        changes.push({
          path: fieldName,
          operation: actualValue === undefined ? 'create' : 'update',
          newValue: desiredValue,
          oldValue: actualValue ?? null,
        });
      }
      continue;
    }

    // Normalize Odoo field types for comparison
    const normalizedActual = normalizeOdooValue(fieldName, actualValue, modelFields);
    const normalizedDesired = normalizeOdooValue(fieldName, desiredValue, modelFields);

    // Check if this is a relational field (one2many or many2many)
    const fieldInfo = modelFields?.get(fieldName);
    const isRelationalField =
      fieldInfo?.ttype === 'one2many' ||
      fieldInfo?.ttype === 'many2many' ||
      (Array.isArray(normalizedDesired) &&
        Array.isArray(normalizedActual) &&
        normalizedDesired.every((v) => typeof v === 'number') &&
        normalizedActual.every((v) => typeof v === 'number'));

    // Compare normalized values
    if (!deepEqual(normalizedDesired, normalizedActual, isRelationalField)) {
      changes.push({
        path: fieldName,
        operation: actualValue === undefined ? 'create' : 'update',
        newValue: desiredValue,
        oldValue: actualValue ?? null,
      });
    }
  }

  return changes;
}

/**
 * Check if two arrays contain the same elements, ignoring order.
 * Used for comparing relational fields (one2many, many2many).
 */
function arraySetEqual(a: any[], b: any[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);
  return sortedA.every((val, idx) => val === sortedB[idx]);
}

/**
 * Compare multiple model instances.
 *
 * @param model Odoo model name
 * @param desiredStates Map of id -> desired fields
 * @param actualStates Map of id -> actual fields from Odoo
 * @param options Comparison options
 * @returns Array of ModelDiff for changed records
 */
export function compareRecords(
  model: string,
  desiredStates: Map<number, Record<string, any>>,
  actualStates: Map<number, Record<string, any>>,
  options: CompareOptions = {}
): ModelDiff[] {
  const diffs: ModelDiff[] = [];

  for (const [id, desiredState] of desiredStates) {
    const actualState = actualStates.get(id) || {};
    const changes = compareRecord(model, id, desiredState, actualState, options);

    if (changes.length > 0) {
      diffs.push({
        model,
        id,
        changes,
        isNew: !actualStates.has(id),
      });
    }
  }

  return diffs;
}

/**
 * Normalize Odoo field values for comparison.
 *
 * Handles Odoo-specific quirks:
 * - many2one: [id, display_name] → id
 * - one2many/many2many: IDs remain as arrays
 * - null/undefined: normalized to null for consistency
 *
 * Handled in Odoo source:
 * - addons/base/models/ir_model_fields.py: Field type definitions
 * - odoo/fields.py: Many2one.convert_to_read() returns [id, name] tuples
 *
 * @see https://github.com/odoo/odoo/blob/17.0/odoo/fields.py#L2156
 */
function normalizeOdooValue(
  fieldName: string,
  value: any,
  fieldMetadata?: Map<string, OdooField>
): any {
  if (value === null || value === undefined) {
    return null;
  }

  // Get field type if metadata available
  const fieldInfo = fieldMetadata?.get(fieldName);
  const fieldType = fieldInfo?.ttype;

  // many2one: Odoo returns [id, display_name], normalize to id
  if (
    fieldType === 'many2one' ||
    (Array.isArray(value) &&
      value.length === 2 &&
      typeof value[0] === 'number' &&
      typeof value[1] === 'string')
  ) {
    if (Array.isArray(value)) {
      return value[0];
    }
  }

  // one2many/many2many: Keep as array of IDs, sort for consistent comparison
  if (fieldType === 'one2many' || fieldType === 'many2many') {
    if (Array.isArray(value)) {
      return value.sort((a, b) => a - b);
    }
  }

  // Primitive types: return as-is
  return value;
}

/**
 * Deep equality comparison.
 *
 * Handles:
 * - Primitives and null
 * - Arrays (order-sensitive, except for relational field IDs)
 * - Objects (recursive)
 *
 * @param a First value
 * @param b Second value
 * @param isRelationalField Whether this is a relational field (array of IDs)
 * @returns true if values are deeply equal
 */
function deepEqual(a: any, b: any, isRelationalField = false): boolean {
  // Handle null/undefined
  if (a === null || a === undefined) {
    return b === null || b === undefined;
  }
  if (b === null || b === undefined) {
    return false;
  }

  // Handle primitives
  if (typeof a !== 'object' || typeof b !== 'object') {
    return a === b;
  }

  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    // For relational fields (arrays of numeric IDs), order doesn't matter
    if (isRelationalField) {
      return arraySetEqual(a, b);
    }

    if (a.length !== b.length) {
      return false;
    }
    return a.every((val, idx) => deepEqual(val, b[idx]));
  }

  // Handle objects
  if (Array.isArray(a) || Array.isArray(b)) {
    return false; // One is array, one isn't
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) {
    return false;
  }

  return keysA.every((key) => deepEqual(a[key], b[key]));
}

export type { FieldChange, ModelDiff, ComparisonResult } from '../types';
