/**
 * Type definitions for plan generation and execution.
 * 
 * A plan is the ordered list of operations (create, update, delete) needed to
 * transform actual state into desired state. Plans respect dependencies and
 * are designed to be safely applied to Odoo.
 */

/**
 * Single operation to apply to Odoo.
 * 
 * Each operation represents one create, update, or delete action on a record.
 * Operations include dependencies tracking for safe execution ordering.
 */
export interface Operation {
  /** 'create' | 'update' | 'delete' - the operation type */
  type: 'create' | 'update' | 'delete';

  /** Odoo model name (e.g., 'project.task') */
  model: string;

  /** 
   * Record ID or temporary ID for creates.
   * Format: 'model:id' (e.g., 'project.task:1')
   * For creates: 'model:temp_1' to reference the newly created record
   */
  id: string;

  /** 
   * Field values to set for create/update operations.
   * For delete operations, this is empty.
   */
  values?: Record<string, any>;

  /** 
   * IDs of other operations this operation depends on.
   * Example: A one2many child might depend on its parent create operation.
   * Format: indices in the operations array or operation IDs.
   */
  dependencies?: string[];

  /** Optional metadata about why this operation was generated */
  reason?: string;
}

/**
 * Execution plan - ordered list of operations with metadata.
 * 
 * A plan is the output of the plan generator. It's designed to be:
 * - Readable by humans (before running)
 * - Safe to execute (respects dependencies)
 * - Reviewable (like terraform plan)
 */
export interface ExecutionPlan {
  /** All operations in execution order (respecting dependencies) */
  operations: Operation[];

  /** Metadata about the plan */
  metadata: PlanMetadata;

  /** Summary statistics */
  summary: PlanSummary;
}

/**
 * Metadata about plan generation.
 */
export interface PlanMetadata {
  /** When plan was generated */
  timestamp: Date;

  /** Which models are affected and in what way */
  affectedModels: Map<string, { creates: number; updates: number; deletes: number }>;

  /** Total number of changes */
  totalChanges: number;

  /** Optional reference to the comparison result used to generate this plan */
  comparisonVersion?: string;
}

/**
 * Summary statistics for a plan.
 */
export interface PlanSummary {
  /** Total number of operations */
  totalOperations: number;

  /** Number of create operations */
  creates: number;

  /** Number of update operations */
  updates: number;

  /** Number of delete operations */
  deletes: number;

  /** Whether the plan is empty (no changes) */
  isEmpty: boolean;

  /** Whether the plan has any errors/issues */
  hasErrors: boolean;

  /** Error messages if any */
  errors?: string[];
}

/**
 * Options for plan generation behavior.
 */
export interface PlanOptions {
  /**
   * Whether to batch operations when possible (e.g., multi-write).
   * Default: true
   */
  enableBatching?: boolean;

  /**
   * Whether to validate dependencies and topological ordering.
   * Default: true
   */
  validateDependencies?: boolean;

  /**
   * Custom dependency resolver for complex relationships.
   * Called with (operation, allOperations) to determine dependencies.
   */
  resolveDependencies?: (operation: Operation, allOperations: Operation[]) => string[];

  /**
   * Whether to automatically reorder operations based on dependencies.
   * Default: true
   */
  autoReorder?: boolean;

  /**
   * Maximum number of operations to allow in a single plan.
   * Default: 10000
   */
  maxOperations?: number;
}
