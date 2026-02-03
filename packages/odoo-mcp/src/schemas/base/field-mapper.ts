/**
 * Odoo field type to JSON Schema mapping utilities.
 *
 * Converts Odoo field definitions (from ir.model.fields or fields_get())
 * to JSON Schema compatible field definitions for MCP tool schemas.
 *
 * @see https://github.com/odoo/odoo/blob/17.0/odoo/fields.py for Odoo field types
 */

import type { OdooField } from '@odoo-toolbox/introspection';
import type { BaseFieldSchema, JsonSchemaType } from './types.js';

/**
 * Mapping from Odoo field types (ttype) to JSON Schema types.
 *
 * Based on Odoo's field type system in odoo/fields.py:
 * - String types (char, text, html) → string
 * - Numeric types (integer, float, monetary) → number/integer
 * - Boolean → boolean
 * - Dates → string with format
 * - Relational fields have special array handling
 */
const ODOO_TYPE_MAP: Record<string, Partial<BaseFieldSchema>> = {
  // String types
  char: { type: 'string' },
  text: { type: 'string' },
  html: { type: 'string', format: 'html' },

  // Numeric types
  integer: { type: 'integer' },
  float: { type: 'number' },
  monetary: { type: 'number' },

  // Boolean
  boolean: { type: 'boolean' },

  // Date/time types (Odoo uses ISO 8601 strings)
  date: { type: 'string', format: 'date' },
  datetime: { type: 'string', format: 'date-time' },

  // Relational fields
  // many2one: Returns [id, display_name] tuple or false
  many2one: {
    type: ['array', 'null'] as JsonSchemaType[],
    description: 'Related record as [id, display_name] or null',
  },
  // one2many/many2many: Return arrays of IDs
  one2many: {
    type: 'array',
    items: { type: 'integer' },
    description: 'List of related record IDs',
  },
  many2many: {
    type: 'array',
    items: { type: 'integer' },
    description: 'List of related record IDs',
  },

  // Selection: String value from predefined choices
  selection: { type: 'string' },

  // Binary data (base64 encoded)
  binary: { type: 'string', format: 'base64' },

  // Reference field (polymorphic relation as "model,id" string)
  reference: { type: 'string' },

  // Properties fields (dynamic user-defined fields)
  properties: { type: 'array' },
  properties_definition: { type: 'array' },
};

/**
 * Convert an Odoo field definition to a JSON Schema field definition.
 *
 * @param field - Odoo field from ir.model.fields or fields_get()
 * @returns JSON Schema compatible field definition
 *
 * @example
 * ```typescript
 * const odooField = { name: 'partner_id', ttype: 'many2one', relation: 'res.partner' };
 * const schema = mapOdooField(odooField);
 * // { type: ['array', 'null'], description: '...', relation: 'res.partner' }
 * ```
 */
export function mapOdooField(field: OdooField): BaseFieldSchema {
  const odooType = field.ttype;
  const baseMapping = ODOO_TYPE_MAP[odooType] || { type: 'string' as JsonSchemaType };

  const result: BaseFieldSchema = {
    ...baseMapping,
    type: baseMapping.type || 'string',
    description: field.field_description || field.name,
    odooType,
  };

  // Add help text if available
  if (field.help) {
    result.description = `${result.description}. ${field.help}`;
  }

  // Handle selection fields - add enum values
  if (odooType === 'selection' && field.selection) {
    try {
      // selection is stored as Python repr, try to parse common formats
      const selection = parseSelectionValues(field.selection);
      if (selection.length > 0) {
        result.enum = selection.map((opt) => opt[0]);
        const enumDesc = selection.map((opt) => `${opt[0]}=${opt[1]}`).join(', ');
        result.description = `${result.description}. Options: ${enumDesc}`;
      }
    } catch {
      // If parsing fails, keep description only
    }
  }

  // Handle relational fields - add relation info
  if (field.relation && ['many2one', 'one2many', 'many2many'].includes(odooType)) {
    result.relation = field.relation;
    result.description = `${result.description} (-> ${field.relation})`;
  }

  // Mark readonly/computed fields
  if (field.readonly || field.compute) {
    result.readOnly = true;
  }

  return result;
}

/**
 * Parse Odoo selection field values from string representation.
 *
 * Selection fields in ir.model.fields store their options as a string
 * representation of a Python list of tuples.
 *
 * @param selectionStr - Selection string from ir.model.fields
 * @returns Array of [value, label] tuples
 */
function parseSelectionValues(selectionStr: string): [string, string][] {
  // Common formats:
  // "[('draft', 'Draft'), ('posted', 'Posted')]"
  // "[['draft', 'Draft'], ['posted', 'Posted']]"

  // Try to extract tuples/arrays using regex
  const tupleRegex = /[([]'"]([^'"]+)['"],\s*['"]([^'"]+)['"]\]/g;
  const results: [string, string][] = [];

  let match;
  while ((match = tupleRegex.exec(selectionStr)) !== null) {
    results.push([match[1], match[2]]);
  }

  return results;
}

/**
 * Convert multiple Odoo fields to a fields record.
 *
 * @param fields - Array of Odoo fields
 * @returns Record of field name to schema definition
 */
export function mapOdooFields(fields: OdooField[]): Record<string, BaseFieldSchema> {
  const result: Record<string, BaseFieldSchema> = {};

  for (const field of fields) {
    result[field.name] = mapOdooField(field);
  }

  return result;
}
