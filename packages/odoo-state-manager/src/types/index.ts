/**
 * Type definitions for state comparison and diff detection.
 * 
 * These types define the structure of changes detected when comparing
 * desired state against actual Odoo state.
 */

/**
 * Represents a single field change detected during state comparison.
 * 
 * Each change tracks what was different, the operation needed to fix it,
 * and the old/new values for drift reporting and plan generation.
 */
export interface FieldChange {
  /** JSON pointer path to the field (e.g., 'name', 'partner_id', 'task_ids[0]') */
  path: string;

  /** 
   * Type of change detected.
   * 
   * - 'create': Field didn't exist in actual state (only in desired)
   * - 'update': Field exists but value differs
   * - 'delete': Field exists in actual but not in desired state (shouldn't occur in normal compare)
   */
  operation: 'create' | 'update' | 'delete';

  /** The desired value (from desired state) */
  newValue: any;

  /** The actual value (from Odoo), null if field didn't exist */
  oldValue: any | null;
}

/**
 * Represents all changes detected for a single model instance.
 * 
 * A diff captures what needs to be changed on a record to match desired state.
 * The model and id identify the record, and changes list all field modifications needed.
 */
export interface ModelDiff {
  /** Odoo model name (e.g., 'project.project', 'res.partner') */
  model: string;

  /** Database ID of the record being compared */
  id: number;

  /** All field changes detected for this record */
  changes: FieldChange[];

  /** Whether this record needs to be created (id might be temporary/generated) */
  isNew: boolean;

  /** 
   * If creating a new record, reference to relate it to parent (one2many scenario).
   * Format: { field: 'task_ids', parentModel: 'project.project', parentId: 123 }
   * null if this is a standalone create or update.
   */
  parentReference?: {
    field: string;
    parentModel: string;
    parentId: number;
  };
}

/**
 * Result of comparing desired state against actual Odoo state.
 * 
 * Groups all detected changes by model for plan generation and analysis.
 */
export interface ComparisonResult {
  /** Changes grouped by model name */
  changes: Map<string, ModelDiff[]>;

  /** Whether the states differ at all */
  hasDrift: boolean;

  /** Metadata about the comparison */
  metadata: {
    /** When the comparison was performed */
    timestamp: Date;
    
    /** Odoo model metadata used (field type info, readonly/computed status) */
    schemaVersion?: string;
  };
}
