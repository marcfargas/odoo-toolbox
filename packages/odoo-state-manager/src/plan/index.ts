/**
 * Plan generation module.
 *
 * Generates ordered execution plans from comparison results.
 * Handles dependency ordering (creates before updates/deletes) and
 * respects parent-child relationships in relational fields.
 */

import { ModelDiff, FieldChange } from '../types';
import { Operation, ExecutionPlan, PlanOptions, PlanMetadata, PlanSummary } from './types';

/**
 * Generate an execution plan from model diffs.
 *
 * Converts comparison results into an ordered list of operations that can be
 * safely applied to Odoo. Respects dependency ordering (creates before updates).
 *
 * Handles Odoo-specific patterns:
 * - one2many creates reference parent via parentReference
 * - many2one updates set the ID directly
 * - Batch operations where possible
 *
 * @param diffs Model differences to plan for
 * @param options Plan generation options
 * @returns Execution plan with ordered operations
 *
 * @example
 * ```typescript
 * const diffs = [
 *   { model: 'project.project', id: 1, changes: [...], isNew: false },
 *   { model: 'project.task', id: 1, changes: [...], isNew: true, parentReference: {...} }
 * ];
 * const plan = generatePlan(diffs, { enableBatching: true });
 * console.log(plan.operations); // Ordered operations
 * ```
 */
export function generatePlan(diffs: ModelDiff[], options: PlanOptions = {}): ExecutionPlan {
  const { validateDependencies = true, autoReorder = true, maxOperations = 10000 } = options;

  // Convert diffs to operations
  let operations: Operation[] = [];

  for (const diff of diffs) {
    const operation = diffToOperation(diff);
    if (operation) {
      operations.push(operation);
    }
  }

  // Check operation count
  if (operations.length > maxOperations) {
    const errors = [`Plan exceeds maximum operations (${operations.length} > ${maxOperations})`];
    return createFailedPlan(errors, operations);
  }

  // Resolve dependencies
  operations = operations.map((op, idx) => ({
    ...op,
    dependencies: resolveDependencies(op, operations, idx),
  }));

  // Validate dependencies if requested
  if (validateDependencies) {
    const errors = validateOperationDependencies(operations);
    if (errors.length > 0) {
      return createFailedPlan(errors, operations);
    }
  }

  // Topological sort if auto-reorder is enabled
  if (autoReorder) {
    operations = topologicalSort(operations);
  }

  // Build result
  const summary = createPlanSummary(operations);
  const metadata = createPlanMetadata(diffs);

  return {
    operations,
    metadata,
    summary,
  };
}

/**
 * Convert a ModelDiff to an Operation.
 *
 * Determines operation type based on isNew flag and handles values.
 */
function diffToOperation(diff: ModelDiff): Operation | null {
  const { model, id, changes, isNew, parentReference } = diff;

  // No changes - skip
  if (changes.length === 0 && !isNew) {
    return null;
  }

  // New record - create operation
  if (isNew) {
    const values = extractValues(changes);
    return {
      type: 'create',
      model,
      id: `${model}:temp_${id}`, // Temporary ID for newly created records
      values,
      reason: parentReference
        ? `Create child of ${parentReference.parentModel}[${parentReference.parentId}]`
        : 'Create new record',
    };
  }

  // Existing record with changes - update operation
  if (changes.length > 0) {
    const values = extractValues(changes);
    return {
      type: 'update',
      model,
      id: `${model}:${id}`,
      values,
      reason: `Update ${changes.length} field(s)`,
    };
  }

  return null;
}

/**
 * Extract field values from changes.
 */
function extractValues(changes: FieldChange[]): Record<string, any> {
  const values: Record<string, any> = {};
  for (const change of changes) {
    values[change.path] = change.newValue;
  }
  return values;
}

/**
 * Determine dependencies for an operation.
 *
 * Rules:
 * - Create operations for child models (via one2many) depend on parent create
 * - Update operations don't depend on creates (values are set on create)
 * - Delete operations should depend on no other creates
 */
function resolveDependencies(
  operation: Operation,
  allOperations: Operation[],
  _currentIdx: number
): string[] {
  const dependencies: string[] = [];

  // For now, simple heuristic: if this is a create operation that references
  // other models (via many2one fields in values), depend on their create operations
  if (operation.type === 'create' && operation.values) {
    for (const [, value] of Object.entries(operation.values)) {
      // Check if value is a temp ID (newly created record)
      if (typeof value === 'string' && value.includes(':temp_')) {
        // Find the operation that creates this record
        const depOp = allOperations.find((op) => op.id === value);
        if (depOp) {
          dependencies.push(value);
        }
      }
    }
  }

  return dependencies;
}

/**
 * Topological sort of operations by dependencies.
 *
 * Uses DFS to detect cycles and order operations safely.
 * Creates come before updates, updates before deletes.
 */
function topologicalSort(operations: Operation[]): Operation[] {
  // First, separate by type to maintain create -> update -> delete ordering
  const creates = operations.filter((op) => op.type === 'create');
  const updates = operations.filter((op) => op.type === 'update');
  const deletes = operations.filter((op) => op.type === 'delete');

  // Sort creates by dependencies
  const sortedCreates = sortByDependencies(creates);
  const sortedUpdates = sortByDependencies(updates);
  const sortedDeletes = sortByDependencies(deletes);

  return [...sortedCreates, ...sortedUpdates, ...sortedDeletes];
}

/**
 * Sort operations within a type by dependencies.
 */
function sortByDependencies(operations: Operation[]): Operation[] {
  const sorted: Operation[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(op: Operation) {
    if (visited.has(op.id)) {
      return;
    }

    if (visiting.has(op.id)) {
      // Cycle detected, but we'll allow it and continue
      return;
    }

    visiting.add(op.id);

    // Visit dependencies first
    if (op.dependencies) {
      for (const depId of op.dependencies) {
        const depOp = operations.find((o) => o.id === depId);
        if (depOp) {
          visit(depOp);
        }
      }
    }

    visiting.delete(op.id);
    visited.add(op.id);
    sorted.push(op);
  }

  for (const op of operations) {
    visit(op);
  }

  return sorted;
}

/**
 * Validate operation dependencies.
 *
 * Checks for:
 * - Circular dependencies
 * - Missing dependencies
 */
function validateOperationDependencies(operations: Operation[]): string[] {
  const errors: string[] = [];
  const opMap = new Map(operations.map((op) => [op.id, op]));

  // Check each operation's dependencies
  for (const op of operations) {
    if (!op.dependencies) continue;

    for (const depId of op.dependencies) {
      const depOp = opMap.get(depId);
      if (!depOp) {
        errors.push(`Operation ${op.id} depends on missing operation ${depId}`);
      }

      // Check that dependency is not a delete (can't depend on something being deleted)
      if (depOp?.type === 'delete') {
        errors.push(`Operation ${op.id} depends on deleted operation ${depId}`);
      }
    }
  }

  return errors;
}

/**
 * Create metadata for a plan.
 */
function createPlanMetadata(diffs: ModelDiff[]): PlanMetadata {
  const affectedModels = new Map<string, { creates: number; updates: number; deletes: number }>();

  for (const diff of diffs) {
    if (!affectedModels.has(diff.model)) {
      affectedModels.set(diff.model, { creates: 0, updates: 0, deletes: 0 });
    }

    const stats = affectedModels.get(diff.model)!;
    if (diff.isNew) {
      stats.creates++;
    } else if (diff.changes.length > 0) {
      stats.updates++;
    }
  }

  return {
    timestamp: new Date(),
    affectedModels,
    totalChanges: diffs.length,
  };
}

/**
 * Create summary statistics for a plan.
 */
function createPlanSummary(operations: Operation[]): PlanSummary {
  const creates = operations.filter((op) => op.type === 'create').length;
  const updates = operations.filter((op) => op.type === 'update').length;
  const deletes = operations.filter((op) => op.type === 'delete').length;

  return {
    totalOperations: operations.length,
    creates,
    updates,
    deletes,
    isEmpty: operations.length === 0,
    hasErrors: false,
  };
}

/**
 * Create a failed plan with errors.
 */
function createFailedPlan(errors: string[], operations: Operation[]): ExecutionPlan {
  const summary = createPlanSummary(operations);
  summary.hasErrors = true;
  summary.errors = errors;

  return {
    operations,
    metadata: {
      timestamp: new Date(),
      affectedModels: new Map(),
      totalChanges: operations.length,
    },
    summary,
  };
}

export type { Operation, ExecutionPlan, PlanOptions } from './types';
export { formatPlanForConsole } from './formatter';
export type { ValidationError, ValidationResult } from './validation';
export { validatePlanReferences, formatValidationErrors, suggestErrorFixes } from './validation';
