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
 * Combined metadata for a model including its fields.
 * 
 * This is returned by getModelMetadata() to provide a complete
 * picture of a model's structure in a single query.
 */
export interface ModelMetadata {
  /** Model information from ir.model */
  model: OdooModel;
  
  /** All fields for this model from ir.model.fields */
  fields: OdooField[];
}

/**
 * Options for introspection queries.
 */
export interface IntrospectionOptions {
  /** 
   * Whether to include transient models (wizards/temporary models).
   * Default: false
   */
  includeTransient?: boolean;
  
  /** 
   * Filter models by module name(s).
   * Useful for focusing on specific Odoo modules/apps.
   */
  modules?: string[];
  
  /**
   * Whether to bypass cache and force fresh query.
   * Default: false
   */
  bypassCache?: boolean;
}
