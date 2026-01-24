/**
 * Plan application module.
 * 
 * Applies generated plans to Odoo.
 * 
 * Handles:
 * - Executing operations in order
 * - Tracking temporary ID to real ID mappings for created records
 * - Error handling and progress callbacks
 * - Dry-run mode for validation
 */

import { OdooClient } from '@odoo-toolbox/client';
import { ExecutionPlan, Operation } from '../plan/types.js';
import { ApplyResult, OperationResult, ApplyOptions } from './types.js';

/**
 * Apply an execution plan to Odoo.
 * 
 * Executes operations in order, handling creates, updates, and deletes.
 * Maps temporary IDs to real database IDs for created records.
 * 
 * @param plan - The execution plan to apply
 * @param client - OdooClient authenticated instance
 * @param options - Execution options (dry-run, stop on error, etc)
 * @returns Apply result with all operation outcomes and final ID mappings
 * 
 * @example
 * ```typescript
 * const result = await applyPlan(plan, client, {
 *   dryRun: false,
 *   stopOnError: true,
 *   onProgress: (current, total) => console.log(`${current}/${total}`),
 * });
 * 
 * console.log(`Applied ${result.applied}/${result.total} operations`);
 * if (result.failed > 0) {
 *   console.log('Errors:', result.errors);
 * }
 * ```
 */
export async function applyPlan(
  plan: ExecutionPlan,
  client: OdooClient,
  options: ApplyOptions = {}
): Promise<ApplyResult> {
  const {
    dryRun = false,
    stopOnError = true,
    onProgress,
    onOperationComplete,
    validate = true,
    context = {},
    maxOperations,
  } = options;

  const startTime = new Date();
  const operations = plan.operations;
  const operationResults: OperationResult[] = [];
  const idMapping = new Map<string, number>();
  const errors: string[] = [];

  // Validate plan size
  if (maxOperations && operations.length > maxOperations) {
    const error = `Plan exceeds maxOperations limit: ${operations.length} > ${maxOperations}`;
    errors.push(error);
    return {
      operations: [],
      total: operations.length,
      applied: 0,
      failed: operations.length,
      success: false,
      duration: Date.now() - startTime.getTime(),
      startTime,
      endTime: new Date(),
      idMapping,
      errors,
    };
  }

  // Execute each operation
  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i];
    const operationStartTime = Date.now();

    try {
      // Validate operation if needed
      if (validate) {
        validateOperation(operation, idMapping);
      }

      let result: any;

      if (dryRun) {
        // Dry-run: validate without executing
        result = `[DRY-RUN] Would ${operation.type} ${operation.model}[${operation.id}]`;
      } else {
        // Execute operation
        result = await executeOperation(operation, client, context, idMapping);

        // For creates, map temp ID to real ID
        if (operation.type === 'create' && typeof result === 'number') {
          idMapping.set(operation.id, result);
        }
      }

      const duration = Date.now() - operationStartTime;
      const operationResult: OperationResult = {
        operation,
        success: true,
        result,
        duration,
        actualId:
          operation.type === 'create'
            ? (idMapping.get(operation.id) ?? result)
            : extractId(operation.id),
      };

      operationResults.push(operationResult);
      onOperationComplete?.(operationResult);
    } catch (error) {
      const duration = Date.now() - operationStartTime;
      const errorMsg = error instanceof Error ? error.message : String(error);
      const operationResult: OperationResult = {
        operation,
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        duration,
      };

      operationResults.push(operationResult);
      onOperationComplete?.(operationResult);

      const fullError = `Operation ${i}: ${operation.type} ${operation.model}[${operation.id}] failed: ${errorMsg}`;
      errors.push(fullError);

      if (stopOnError) {
        break;
      }
    }

    onProgress?.(i + 1, operations.length, operation.id);
  }

  const endTime = new Date();
  const applied = operationResults.filter((r) => r.success).length;

  return {
    operations: operationResults,
    total: operations.length,
    applied,
    failed: operationResults.length - applied,
    success: applied === operationResults.length && errors.length === 0,
    duration: endTime.getTime() - startTime.getTime(),
    startTime,
    endTime,
    idMapping,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Execute a single operation on Odoo.
 * 
 * @param operation - The operation to execute
 * @param client - OdooClient instance
 * @param baseContext - Base context to use for all operations
 * @param idMapping - Current ID mapping for resolving references
 * @returns Result from Odoo (ID for create, true for update/delete)
 * @throws If operation fails
 */
async function executeOperation(
  operation: Operation,
  client: OdooClient,
  baseContext: Record<string, any>,
  idMapping: Map<string, number>
): Promise<any> {
  const { type, model, id, values = {} } = operation;

  // Resolve any ID references in values
  const resolvedValues = resolveIdReferences(values, idMapping);

  // Merge context
  const operationContext = { ...baseContext, ...(resolvedValues.context || {}) };
  delete resolvedValues.context;

  switch (type) {
    case 'create': {
      /**
       * Create operation.
       * 
       * Handled in: odoo/models.py:BaseModel.create()
       * Creates a new record with the provided values.
       * Context variables are used for defaults and behavior control.
       * 
       * @see https://github.com/odoo/odoo/blob/17.0/odoo/models.py#L3800
       */
      return await client.create(model, resolvedValues, operationContext);
    }

    case 'update': {
      /**
       * Update operation.
       * 
       * Handled in: odoo/models.py:BaseModel.write()
       * Updates existing record(s) with the provided values.
       * Multiple IDs can be passed for bulk update.
       * 
       * @see https://github.com/odoo/odoo/blob/17.0/odoo/models.py#L4100
       */
      const recordId = extractId(id);
      return await client.write(model, recordId, resolvedValues, operationContext);
    }

    case 'delete': {
      /**
       * Delete operation.
       * 
       * Handled in: odoo/models.py:BaseModel.unlink()
       * Permanently removes record(s) from the database.
       * Triggers cascading deletes for related records based on field definitions.
       * 
       * @see https://github.com/odoo/odoo/blob/17.0/odoo/models.py#L4400
       */
      const recordId = extractId(id);
      return await client.unlink(model, recordId);
    }

    default:
      throw new Error(`Unknown operation type: ${type}`);
  }
}

/**
 * Validate an operation before execution.
 * 
 * Checks for:
 * - References to non-existent IDs in idMapping
 * - Dependency resolution
 * - Valid operation structure
 * 
 * @param operation - The operation to validate
 * @param idMapping - Current ID mapping
 * @throws If validation fails
 */
function validateOperation(operation: Operation, idMapping: Map<string, number>): void {
  const { type, model, id, values = {} } = operation;

  // Validate required fields
  if (!type || !model || !id) {
    throw new Error(
      `Invalid operation structure: missing required fields (type, model, id)`
    );
  }

  // Validate operation type
  if (!['create', 'update', 'delete'].includes(type)) {
    throw new Error(`Invalid operation type: ${type}`);
  }

  // For updates/deletes, validate that ID is resolvable
  if ((type === 'update' || type === 'delete') && id.startsWith('temp_')) {
    throw new Error(
      `Cannot ${type} record with temporary ID ${id}. Record must be created first.`
    );
  }

  // Check for unresolved ID references in values
  checkUnresolvedReferences(values, idMapping);
}

/**
 * Check if there are unresolved ID references in values.
 * 
 * Recursively checks objects and arrays for string values matching 'model:temp_id' pattern.
 * 
 * @param values - Values to check
 * @param idMapping - Current ID mapping
 * @throws If unresolved references found
 */
function checkUnresolvedReferences(values: any, idMapping: Map<string, number>): void {
  if (!values || typeof values !== 'object') {
    return;
  }

  if (Array.isArray(values)) {
    values.forEach((item) => checkUnresolvedReferences(item, idMapping));
  } else {
    Object.values(values).forEach((value) => {
      if (typeof value === 'string' && value.includes(':')) {
        const [, id] = value.split(':');
        if (id && id.startsWith('temp_') && !idMapping.has(value)) {
          throw new Error(`Unresolved ID reference: ${value}`);
        }
      }
      checkUnresolvedReferences(value, idMapping);
    });
  }
}

/**
 * Resolve temporary ID references in operation values.
 * 
 * Replaces strings matching 'model:temp_1' with actual database IDs from idMapping.
 * Handles nested objects and arrays recursively.
 * 
 * @param values - Values that may contain ID references
 * @param idMapping - Mapping of temp IDs to real IDs
 * @returns Values with resolved IDs
 */
function resolveIdReferences(
  values: Record<string, any>,
  idMapping: Map<string, number>
): Record<string, any> {
  const resolved: Record<string, any> = {};

  Object.entries(values).forEach(([key, value]) => {
    resolved[key] = resolveValue(value, idMapping);
  });

  return resolved;
}

/**
 * Recursively resolve a single value.
 * 
 * @param value - The value to resolve
 * @param idMapping - ID mapping for reference resolution
 * @returns Resolved value (real ID if reference, original otherwise)
 */
function resolveValue(value: any, idMapping: Map<string, number>): any {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string' && value.includes(':')) {
    const resolved = idMapping.get(value);
    if (resolved !== undefined) {
      return resolved;
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveValue(item, idMapping));
  }

  if (typeof value === 'object') {
    const resolved: Record<string, any> = {};
    Object.entries(value).forEach(([key, val]) => {
      resolved[key] = resolveValue(val, idMapping);
    });
    return resolved;
  }

  return value;
}

/**
 * Extract numeric ID from 'model:id' format.
 * 
 * @param id - ID in format 'model:id' or just numeric
 * @returns Numeric ID
 * @throws If ID cannot be parsed
 */
function extractId(id: string): number {
  const parts = id.split(':');
  const numericId = parts.length > 1 ? parts[1] : id;

  const parsed = parseInt(numericId, 10);
  if (isNaN(parsed)) {
    throw new Error(`Invalid ID format: ${id}`);
  }

  return parsed;
}

/**
 * Apply a plan with dry-run mode.
 * 
 * Validates the plan without making actual changes to Odoo.
 * Useful for reviewing plans before applying.
 * 
 * @param plan - The execution plan to validate
 * @param client - OdooClient instance
 * @param options - Apply options (will be merged with dryRun: true)
 * @returns Apply result as if operations were executed
 * 
 * @example
 * ```typescript
 * const dryRunResult = await dryRunPlan(plan, client, {
 *   validate: true,
 * });
 * 
 * console.log(`Would apply ${dryRunResult.applied} operations`);
 * ```
 */
export async function dryRunPlan(
  plan: ExecutionPlan,
  client: OdooClient,
  options: Omit<ApplyOptions, 'dryRun'> = {}
): Promise<ApplyResult> {
  return applyPlan(plan, client, { ...options, dryRun: true });
}

// Re-export types
export * from './types.js';
