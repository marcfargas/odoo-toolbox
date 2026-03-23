import type { ResourceDefinition, ModelPolicy } from '../dsl/types';

// ---------------------------------------------------------------------------
// Resolve types
// ---------------------------------------------------------------------------

export interface ResolvedResource {
  original: ResourceDefinition;
  model: string;
  mode: 'create' | 'update';
  resolvedId: number | null;
  /** Field values with all LookupRef markers replaced by numeric IDs. */
  resolvedValues: Record<string, unknown>;
}

export interface ResolvedState {
  resources: ResolvedResource[];
  policies: ModelPolicy[];
}

// ---------------------------------------------------------------------------
// Evaluation result
// ---------------------------------------------------------------------------

/** Collected definitions from all project files. */
export interface EvaluationResult {
  resources: ResourceDefinition[];
  policies: ModelPolicy[];
  files: string[];
}

/** A single operation to perform against Odoo. */
export type OperationType = 'create' | 'update' | 'delete' | 'archive' | 'unlink';

export interface Operation {
  type: OperationType;
  model: string;
  /** Odoo record id, undefined for create operations. */
  id?: number;
  /** Field values for create/update operations. */
  values?: Record<string, unknown>;
  /** Human-readable description for logging. */
  description?: string;
  /** Execution level — lower levels run first. Level 0 = module installs. */
  level?: number;
  /** Field-level changes for update operations (for display purposes). */
  changes?: Array<{ field: string; desired: unknown; actual: unknown }>;
}

export interface PlanSummary {
  installs: number;
  creates: number;
  updates: number;
  unlinks: number;
  archives: number;
  total: number;
  isEmpty: boolean;
}

export interface PlanMetadata {
  timestamp: string;
  /** All unique model names referenced by the plan operations. */
  models: string[];
}

/** A set of operations derived from the evaluation result and current Odoo state. */
export interface Plan {
  operations: Operation[];
  summary: PlanSummary;
  metadata: PlanMetadata;
}

export type OperationStatus = 'ok' | 'error' | 'skipped';

export interface OperationResult {
  operation: Operation;
  status: OperationStatus;
  /** Odoo record id after create, if applicable. */
  id?: number;
  error?: string;
}

export interface ApplyResult {
  results: OperationResult[];
  /** Number of successful operations. */
  succeeded: number;
  /** Number of failed operations. */
  failed: number;
}
