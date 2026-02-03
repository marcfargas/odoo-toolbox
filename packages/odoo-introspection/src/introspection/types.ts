/**
 * Type definitions for Odoo model introspection.
 *
 * These interfaces map to Odoo's ir.model and ir.model.fields models,
 * which provide runtime metadata about models and their fields.
 *
 * @see https://github.com/odoo/odoo/blob/17.0/odoo/addons/base/models/ir_model.py
 * @see https://github.com/odoo/odoo/blob/17.0/odoo/addons/base/models/ir_model_fields.py
 */

/**
 * Represents an Odoo model from ir.model.
 *
 * Odoo stores model metadata in the ir.model table, including the technical name,
 * human-readable name, and information about the model's origin (module).
 */
export interface OdooModel {
  /** Technical model name (e.g., 'res.partner', 'project.task') */
  model: string;

  /** Human-readable model name (e.g., 'Contact', 'Project Task') */
  name: string;

  /** Optional description or help text for the model */
  info?: string;

  /** Whether this is a transient model (wizard/temporary data) */
  transient: boolean;

  /** Comma-separated list of modules that define or extend this model */
  modules?: string;

  /** Internal database ID of the ir.model record */
  id: number;
}

/**
 * Represents an Odoo field from ir.model.fields.
 *
 * Odoo stores field metadata in ir.model.fields, including type information,
 * relationships, constraints, and help text. This is queried during introspection
 * to build TypeScript type definitions.
 */
export interface OdooField {
  /** Technical field name (e.g., 'name', 'partner_id', 'task_ids') */
  name: string;

  /** Human-readable field label (e.g., 'Name', 'Customer', 'Tasks') */
  field_description: string;

  /**
   * Odoo field type (ttype = "type of type").
   *
   * Common values:
   * - Primitives: 'char', 'text', 'integer', 'float', 'boolean', 'date', 'datetime'
   * - Relational: 'many2one', 'one2many', 'many2many'
   * - Special: 'selection', 'binary', 'html', 'monetary'
   *
   * @see https://github.com/odoo/odoo/blob/17.0/odoo/fields.py for field type definitions
   */
  ttype: string;

  /** Whether this field is required (cannot be null/empty) */
  required: boolean;

  /** Whether this field is readonly (computed or system-managed) */
  readonly: boolean;

  /**
   * For relational fields (many2one, one2many, many2many), the related model name.
   * Example: For a 'partner_id' many2one field, relation would be 'res.partner'
   */
  relation?: string;

  /** Help text or description for this field, shown in UI tooltips */
  help?: string;

  /**
   * For selection fields, the available choices as a string representation.
   * Format varies (could be Python list repr), needs parsing for codegen.
   */
  selection?: string;

  /**
   * If set, indicates this is a computed field (not stored in database by default).
   * Contains the compute method name or definition.
   * Computed fields are typically readonly unless explicitly made writable.
   *
   * @see https://github.com/odoo/odoo/blob/17.0/odoo/fields.py#L1234 for compute behavior
   */
  compute?: string;

  /** Internal database ID of the ir.model.fields record */
  id: number;

  /** The model this field belongs to */
  model: string;
}

/**
 * Combined metadata for a model: the model info plus all its fields.
 */
export interface ModelMetadata {
  /** Model information from ir.model */
  model: OdooModel;

  /** Fields for this model from ir.model.fields */
  fields: OdooField[];
}

/**
 * Options for introspection operations.
 */
export interface IntrospectionOptions {
  /** Include transient/wizard models (default: false) */
  includeTransient?: boolean;

  /** Filter by module names (optional) */
  modules?: string[];

  /** Bypass cache and query Odoo directly (default: false) */
  bypassCache?: boolean;
}
