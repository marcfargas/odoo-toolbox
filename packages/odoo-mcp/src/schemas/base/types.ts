/**
 * Type definitions for base model schemas.
 *
 * Base schemas provide documented field definitions for core Odoo models
 * that the MCP server uses internally. These are merged with live field
 * data from Odoo introspection to provide complete, well-documented schemas.
 */

/**
 * JSON Schema type for a field.
 */
export type JsonSchemaType =
  | 'string'
  | 'integer'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'null';

/**
 * Base field definition with documentation.
 *
 * Provides a JSON Schema-compatible field definition with
 * Odoo-specific metadata for better LLM understanding.
 */
export interface BaseFieldSchema {
  /** JSON Schema type(s) for the field */
  type: JsonSchemaType | JsonSchemaType[];

  /** Human-readable description of the field's purpose */
  description: string;

  /** For string fields, the format (e.g., 'date', 'date-time', 'email') */
  format?: string;

  /** For selection fields, the allowed values */
  enum?: string[];

  /** For array fields, the item type schema */
  items?: { type: JsonSchemaType };

  /** Whether the field is readonly/computed */
  readOnly?: boolean;

  /** For relational fields, the target model */
  relation?: string;

  /** Odoo field type (ttype) for reference */
  odooType?: string;
}

/**
 * Complete base schema for an Odoo model.
 *
 * Defines the known, stable fields for a model with rich documentation.
 * This is merged with live introspection data at runtime.
 */
export interface BaseModelSchema {
  /** Technical model name (e.g., 'ir.model', 'mail.message') */
  model: string;

  /** Human-readable description of the model's purpose */
  description: string;

  /** Field definitions keyed by field name */
  fields: Record<string, BaseFieldSchema>;

  /** Required field names */
  required: string[];
}

/**
 * Merged schema combining base definitions with live Odoo fields.
 */
export interface MergedModelSchema {
  /** Technical model name */
  model: string;

  /** Model description */
  description: string;

  /** All fields (base + live merged) */
  fields: Record<string, BaseFieldSchema>;

  /** Required field names */
  required: string[];

  /** Fields that came from base schema (for debugging) */
  baseFields: string[];

  /** Fields discovered from live Odoo (for debugging) */
  liveFields: string[];
}
