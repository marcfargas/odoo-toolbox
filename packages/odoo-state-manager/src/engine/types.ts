import type { ResourceDefinition, ModelPolicy } from '../dsl/types';

// ---------------------------------------------------------------------------
// Translation types
// ---------------------------------------------------------------------------

/** Per-field translation data extracted during transform. */
export interface TranslationEntry {
  field: string;
  lang: string;
  value: unknown;
}

/** Translation metadata stashed on a resolved resource. */
export interface TranslationMeta {
  entries: TranslationEntry[];
}

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
  /** External ID for this resource (from DSL definition). */
  externalId?: string;
  /** Translation data extracted from translated() markers during transform. */
  translations?: TranslationMeta;
  /**
   * True when the resource was found via _ref lookup but doesn't yet
   * have an external ID in ir.model.data. The apply step will write
   * the external ID (adoption).
   */
  needsAdoption?: boolean;
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
export type OperationType = 'create' | 'update' | 'delete' | 'archive' | 'unlink' | 'adopt';

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
  /** External ID for this resource (module.name format). */
  externalId?: string;
}

export interface PlanSummary {
  installs: number;
  creates: number;
  updates: number;
  unlinks: number;
  archives: number;
  adopts: number;
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
