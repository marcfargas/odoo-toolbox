/**
 * Maps Odoo field types to TypeScript type definitions.
 * 
 * Odoo's field type system is defined in:
 * @see https://github.com/odoo/odoo/blob/17.0/odoo/fields.py
 * 
 * This module handles the conversion from Odoo's ttype values to TypeScript type expressions.
 */

import { OdooField } from '../introspection/types';

/**
 * Represents a TypeScript type expression as a string.
 * Can be a simple type ('string') or complex type ('number | [number, string]').
 */
export type TypeScriptTypeExpression = string;

/**
 * Maps a single Odoo field to its TypeScript type expression.
 * 
 * Handles:
 * - Primitive types (char, text, integer, float, boolean, date, datetime)
 * - Relational types (many2one, one2many, many2many)
 * - Special types (selection, binary, html, monetary)
 * - Required vs optional (via boolean return)
 * 
 * @param field - The Odoo field metadata
 * @returns TypeScript type expression for this field
 */
export function mapFieldType(field: OdooField): TypeScriptTypeExpression {
  switch (field.ttype) {
    // Primitive string types
    case 'char':
    case 'text':
    case 'html':
      return 'string';

    // Numeric types
    case 'integer':
      return 'number';

    case 'float':
    case 'monetary':
      return 'number';

    // Boolean
    case 'boolean':
      return 'boolean';

    // Date and time - use ISO string format for compatibility
    case 'date':
    case 'datetime':
      return 'string'; // ISO 8601 format

    // Many to one: can be ID (number) or [id, display_name] tuple from read operations
    // In write/create operations, use just the ID.
    case 'many2one':
      return 'number';

    // One to many and many to many: arrays of IDs
    case 'one2many':
    case 'many2many':
      return 'number[]';

    // Selection: string value from the available options
    case 'selection':
      return 'string';

    // Binary data: base64 string
    case 'binary':
      return 'string';

    // Default: treat as any for unknown types
    default:
      return 'any';
  }
}

/**
 * Gets the TypeScript type expression for a field, including optional modifier.
 * 
 * Respects Odoo's `required` attribute:
 * - If required: field is non-optional (e.g., 'string')
 * - If not required: field is optional (e.g., 'string | undefined')
 * 
 * Readonly fields (computed fields) are not marked as such in the type,
 * since the state manager will handle write constraints. The type definition
 * includes all fields for read operations, and write operations are validated
 * at the application level.
 * 
 * @param field - The Odoo field metadata
 * @returns TypeScript type expression with optional modifier if needed
 */
export function getFieldTypeExpression(field: OdooField): TypeScriptTypeExpression {
  const baseType = mapFieldType(field);
  
  // If field is required, it's non-optional
  if (field.required) {
    return baseType;
  }
  
  // If field is optional, add undefined
  return `${baseType} | undefined`;
}

/**
 * Determines if a field can be written to (for method signature generation).
 * 
 * Returns false for:
 * - Computed/readonly fields (not writeable)
 * - id field (never writeable)
 * - System fields (create_date, write_date, etc.)
 * 
 * @param field - The Odoo field metadata
 * @returns true if field can be written in create/write operations
 */
export function isWritableField(field: OdooField): boolean {
  // System fields that cannot be written
  const systemFields = [
    'id',
    'create_date',
    'create_uid',
    'write_date',
    'write_uid',
    '__last_update'
  ];

  if (systemFields.includes(field.name)) {
    return false;
  }

  // Readonly/computed fields cannot be written
  if (field.readonly) {
    return false;
  }

  return true;
}

/**
 * Generates a JSDoc type comment for a field.
 * 
 * Includes:
 * - Field type
 * - Help text from Odoo if available
 * - Whether field is required
 * 
 * @param field - The Odoo field metadata
 * @returns JSDoc comment for the field
 */
export function generateFieldJSDoc(field: OdooField): string {
  const lines: string[] = [];
  lines.push('/**');

  // Add description from field_description (label)
  if (field.field_description) {
    lines.push(` * ${field.field_description}`);
  }

  // Add help text from Odoo if available
  if (field.help) {
    // Clean up multiline help text
    const helpText = field.help
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join(' ');
    
    if (helpText) {
      lines.push(` * `);
      lines.push(` * ${helpText}`);
    }
  }

  // Add metadata
  lines.push(' *');
  
  if (field.required) {
    lines.push(' * @required');
  }

  if (field.readonly) {
    lines.push(' * @readonly');
  }

  // For relational fields, note the related model
  if (field.relation && (field.ttype === 'many2one' || field.ttype === 'one2many' || field.ttype === 'many2many')) {
    lines.push(` * @relation ${field.relation}`);
  }

  lines.push(' */');

  return lines.join('\n');
}
