/**
 * Plan validation utilities.
 * 
 * Validates execution plans for common issues and provides actionable fix suggestions.
 * 
 * Handles:
 * - Relational record existence validation (many2one, one2many references)
 * - Error diagnostics with suggested fixes
 * - Pre-apply safety checks
 * 
 * @see https://github.com/odoo/odoo/blob/17.0/odoo/fields.py#L2000 (Many2one field handling)
 * @see https://github.com/odoo/odoo/blob/17.0/odoo/models.py#L2500 (create/write validation)
 */

import { Operation, ExecutionPlan } from './types.js';
import { OdooClient } from '@odoo-toolbox/client';

/**
 * Validation error with diagnostic information and suggested fixes.
 */
export interface ValidationError {
  /** Error message */
  message: string;

  /** Operation that caused the error (if applicable) */
  operationId?: string;

  /** Field name that failed validation (if applicable) */
  fieldName?: string;

  /** Suggested fixes (ordered by likelihood of resolution) */
  suggestedFixes: string[];

  /** Error severity: 'error' | 'warning' */
  severity: 'error' | 'warning';

  /** Relevant operation details for context */
  context?: Record<string, any>;
}

/**
 * Result of plan validation.
 */
export interface ValidationResult {
  /** Whether validation passed (no errors) */
  isValid: boolean;

  /** List of validation errors found */
  errors: ValidationError[];

  /** Warnings that don't block execution but should be noted */
  warnings: ValidationError[];

  /** Models that need verification */
  recordsToVerify: Array<{ model: string; id: number }>;
}

/**
 * Validate a plan for relational record existence.
 * 
 * Checks that:
 * - All many2one references point to existing records
 * - Parent references in one2many creates exist or are being created
 * - Foreign keys are valid before update/delete operations
 * 
 * Handles temporary IDs (model:temp_N) for newly created records.
 * 
 * @param plan Plan to validate
 * @param client OdooClient for verification queries (optional for offline validation)
 * @returns Validation result with errors and suggested fixes
 * 
 * @example
 * ```typescript
 * const result = await validatePlanReferences(plan, client);
 * if (!result.isValid) {
 *   for (const error of result.errors) {
 *     console.error(error.message);
 *     console.log('Suggested fixes:');
 *     error.suggestedFixes.forEach(fix => console.log(`  - ${fix}`));
 *   }
 * }
 * ```
 * 
 * @see https://github.com/odoo/odoo/blob/17.0/odoo/fields.py#L2156 (Many2one conversion)
 */
export async function validatePlanReferences(
  plan: ExecutionPlan,
  client?: OdooClient
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const recordsToVerify: Set<string> = new Set();

  // Build a map of created records for reference resolution
  const createdRecords = new Map<string, string>();
  for (const op of plan.operations) {
    if (op.type === 'create') {
      createdRecords.set(op.id, op.model);
    }
  }

  // Validate each operation
  for (let i = 0; i < plan.operations.length; i++) {
    const op = plan.operations[i];

    // For create/update operations, check field references
    if ((op.type === 'create' || op.type === 'update') && op.values) {
      const fieldErrors = validateOperationValues(
        op,
        plan.operations,
        createdRecords,
        i
      );
      errors.push(...fieldErrors);

      // Collect record references for verification
      for (const [fieldName, value] of Object.entries(op.values)) {
        if (typeof value === 'number' && fieldName.endsWith('_id')) {
          recordsToVerify.add(`${op.model}:${value}`);
        } else if (Array.isArray(value) && fieldName.endsWith('_ids')) {
          value.forEach(id => {
            if (typeof id === 'number') {
              recordsToVerify.add(`${op.model}:${id}`);
            }
          });
        }
      }
    }

    // For delete operations, check that record exists
    if (op.type === 'delete' && !op.id.includes('temp_')) {
      const idMatch = op.id.match(/:(\d+)$/);
      if (idMatch) {
        recordsToVerify.add(op.id);
      }
    }
  }

  // If client provided, verify records exist in Odoo
  if (client && recordsToVerify.size > 0) {
    const verificationErrors = await verifyRecordsExist(
      Array.from(recordsToVerify),
      client,
      plan.operations
    );
    errors.push(...verificationErrors);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    recordsToVerify: Array.from(recordsToVerify).map(ref => {
      const [model, id] = ref.split(':');
      return { model, id: parseInt(id, 10) };
    }),
  };
}

/**
 * Validate operation values for reference integrity.
 * 
 * Checks that many2one and many2many references in operation values
 * either point to existing records or to records being created.
 * 
 * Handles:
 * - Temporary ID references (model:temp_1)
 * - Direct ID values
 * - Array of IDs for many2many fields
 * - Parent references in one2many creates
 */
function validateOperationValues(
  operation: Operation,
  allOperations: Operation[],
  createdRecords: Map<string, string>,
  operationIndex: number
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!operation.values) {
    return errors;
  }

  for (const [fieldName, value] of Object.entries(operation.values)) {
    // Handle many2one fields (end with _id or are relational)
    if (fieldName.endsWith('_id') && value !== null && value !== undefined) {
      if (typeof value === 'number') {
        // Direct ID reference - will be verified later
        continue;
      } else if (typeof value === 'string' && value.includes(':')) {
        // Temporary ID reference
        const refError = validateTempIdReference(
          value,
          operation,
          fieldName,
          createdRecords,
          operationIndex,
          allOperations
        );
        if (refError) {
          errors.push(refError);
        }
      }
    }

    // Handle many2many fields (end with _ids)
    if (fieldName.endsWith('_ids') && Array.isArray(value)) {
      for (const id of value) {
        if (typeof id === 'string' && id.includes(':')) {
          const refError = validateTempIdReference(
            id,
            operation,
            fieldName,
            createdRecords,
            operationIndex,
            allOperations
          );
          if (refError) {
            errors.push(refError);
          }
        }
      }
    }
  }

  return errors;
}

/**
 * Validate a temporary ID reference.
 * 
 * Ensures that references to newly created records (model:temp_N) are valid:
 * - The operation being referenced exists in the plan
 * - The operation is a create operation
 * - The operation appears before this operation in execution order
 */
function validateTempIdReference(
  tempId: string,
  operation: Operation,
  fieldName: string,
  createdRecords: Map<string, string>,
  operationIndex: number,
  allOperations: Operation[]
): ValidationError | null {
  const [refModel] = tempId.split(':');

  // Find the operation being referenced
  const referencedOp = allOperations.find(
    op => op.type === 'create' && op.id === tempId
  );

  if (!referencedOp) {
    return {
      message: `Operation references non-existent temporary record: ${tempId}`,
      operationId: operation.id,
      fieldName,
      severity: 'error',
      suggestedFixes: [
        `Ensure record ${tempId} is created before this operation (check operation order)`,
        `Verify the referenced model name is correct: ${refModel}`,
        `Check that ${fieldName} actually expects a ${refModel} record`,
      ],
      context: {
        operation,
        reference: tempId,
        fieldName,
      },
    };
  }

  // Check operation order - referenced operation must come before this one
  const refIndex = allOperations.indexOf(referencedOp);
  if (refIndex >= operationIndex) {
    return {
      message: `Circular dependency detected: ${operation.id} references ${tempId} which is created later`,
      operationId: operation.id,
      fieldName,
      severity: 'error',
      suggestedFixes: [
        `Reorder operations: create ${tempId} before operation ${operation.id}`,
        `Check if dependencies are properly defined in the plan`,
        `Consider splitting the operation into multiple steps`,
      ],
      context: {
        operation,
        reference: tempId,
        dependencyChain: [operation.id, tempId],
      },
    };
  }

  return null;
}

/**
 * Verify that referenced records exist in Odoo.
 * 
 * Performs existence checks against the Odoo database for all referenced records.
 * This is an optional validation step that requires a connected OdooClient.
 * 
 * Handles:
 * - Batch queries for efficiency
 * - Detailed error messages with record names when available
 * - Suggested fixes for missing records
 * 
 * @see https://github.com/odoo/odoo/blob/17.0/odoo/models.py#L2490 (search validation)
 */
async function verifyRecordsExist(
  recordRefs: string[],
  client: OdooClient,
  operations: Operation[]
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];
  const recordsByModel = new Map<string, number[]>();

  // Group records by model
  for (const ref of recordRefs) {
    const [model, idStr] = ref.split(':');
    const id = parseInt(idStr, 10);

    if (!recordsByModel.has(model)) {
      recordsByModel.set(model, []);
    }
    recordsByModel.get(model)!.push(id);
  }

  // Query existence for each model
  for (const [model, ids] of recordsByModel) {
    try {
      const existingIds = await client.search(model, [['id', 'in', ids]]);
      const missingIds = ids.filter(id => !existingIds.includes(id));

      if (missingIds.length > 0) {
        // Find which operations reference the missing records
        const affectedOps = operations.filter(op => {
          if (!op.values) return false;
          for (const value of Object.values(op.values)) {
            if (typeof value === 'number' && missingIds.includes(value)) {
              return true;
            }
            if (Array.isArray(value)) {
              for (const v of value) {
                if (typeof v === 'number' && missingIds.includes(v)) {
                  return true;
                }
              }
            }
          }
          return false;
        });

        errors.push({
          message: `Records do not exist in ${model}: ${missingIds.join(', ')}`,
          severity: 'error',
          suggestedFixes: [
            `Verify that ${model} records with IDs [${missingIds.join(', ')}] exist in Odoo`,
            `Check if these records were already deleted or have a different ID`,
            `Review the comparison results to ensure the correct IDs are being referenced`,
            `Run a fresh compare to update the plan with current state`,
          ],
          context: {
            model,
            missingIds,
            affectedOperations: affectedOps.map(op => op.id),
          },
        });
      }
    } catch (error) {
      // Handle query failures gracefully
      const message = error instanceof Error ? error.message : String(error);
      errors.push({
        message: `Failed to verify records in ${model}: ${message}`,
        severity: 'warning',
        suggestedFixes: [
          `Check that you have read permissions on ${model}`,
          `Verify the model name is correct and exists in your Odoo instance`,
          `Try running validation again or skip record verification`,
        ],
        context: {
          model,
          ids,
          error: message,
        },
      });
    }
  }

  return errors;
}

/**
 * Format validation errors for console output.
 * 
 * Produces human-readable error messages with suggested fixes.
 * 
 * @example
 * ```typescript
 * const result = await validatePlanReferences(plan, client);
 * console.error(formatValidationErrors(result));
 * ```
 */
export function formatValidationErrors(result: ValidationResult): string {
  if (result.isValid && result.warnings.length === 0) {
    return '✓ Plan validation passed\n';
  }

  const lines: string[] = [];

  if (result.errors.length > 0) {
    lines.push(`✗ ${result.errors.length} validation error(s):\n`);
    for (const error of result.errors) {
      lines.push(`  ✗ ${error.message}`);
      if (error.fieldName) {
        lines.push(`    Field: ${error.fieldName}`);
      }
      if (error.operationId) {
        lines.push(`    Operation: ${error.operationId}`);
      }
      if (error.suggestedFixes.length > 0) {
        lines.push('    Suggested fixes:');
        error.suggestedFixes.forEach((fix, i) => {
          lines.push(`      ${i + 1}. ${fix}`);
        });
      }
      lines.push('');
    }
  }

  if (result.warnings.length > 0) {
    lines.push(`⚠ ${result.warnings.length} warning(s):\n`);
    for (const warning of result.warnings) {
      lines.push(`  ⚠ ${warning.message}`);
      if (warning.suggestedFixes.length > 0) {
        lines.push('    Suggested fixes:');
        warning.suggestedFixes.forEach((fix, i) => {
          lines.push(`      ${i + 1}. ${fix}`);
        });
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Suggest fixes for common Odoo errors.
 * 
 * Analyzes error messages and provides actionable suggestions.
 * 
 * Detects common error patterns:
 * - "Access denied" → Check user permissions
 * - "does not exist" → Check IDs and model names
 * - "missing required field" → Check field mappings
 * - "ValidationError" → Check field constraints
 * 
 * @param error The error message or Error object
 * @param context Additional context (operation details, etc)
 * @returns List of suggested fixes
 * 
 * @see https://github.com/odoo/odoo/blob/17.0/odoo/exceptions.py (Odoo error types)
 */
export function suggestErrorFixes(
  error: Error | string,
  context?: Record<string, any>
): string[] {
  const message = typeof error === 'string' ? error : error.message;
  const suggestions: string[] = [];

  // Access errors
  if (message.match(/access.*denied|permission/i)) {
    suggestions.push('Check that the user has read/write permissions on the model');
    suggestions.push('Verify user belongs to the correct security groups');
    suggestions.push('Check model access rules (ir.model.access)');
    suggestions.push('Check field access rules (ir.model.fields.access)');
  }

  // Does not exist / not found errors
  if (message.match(/does not exist|not found|[Nn]o matching|0 records?/i)) {
    suggestions.push('Verify that the record IDs are correct');
    suggestions.push('Check if the records were deleted before operation');
    suggestions.push('Ensure domain filters match the intended records');
    if (context?.model) {
      suggestions.push(`Try searching ${context.model} to verify correct IDs`);
    }
  }

  // Missing required field
  if (message.match(/required.*field|missing.*field|[Mm]andatory/i)) {
    suggestions.push('Check that all required fields are included in the operation');
    suggestions.push('Review Odoo model definition for field requirements');
    if (context?.operation) {
      suggestions.push(`Verify operation includes all required fields for ${context.operation.model}`);
    }
    suggestions.push('Use introspection to get required fields list');
  }

  // Validation errors
  if (message.match(/validation|constraint|[Ii]nvalid/i)) {
    suggestions.push('Check field values match expected types and constraints');
    suggestions.push('Verify relational fields point to valid records');
    suggestions.push('Check for circular references or impossible states');
    suggestions.push('Review custom onchange methods that might affect validation');
  }

  // Many2one type errors
  if (message.match(/many2one|relation|foreign key/i)) {
    suggestions.push('Verify the relational field points to a valid record');
    suggestions.push('Check that you are using record ID, not name');
    suggestions.push('Ensure the related record exists before linking to it');
  }

  // Context-specific errors
  if (message.match(/context|parameter/i)) {
    suggestions.push('Check that context variables are valid for the operation');
    suggestions.push('Verify context does not conflict with operation values');
  }

  // Generic suggestions if no specific pattern matched
  if (suggestions.length === 0) {
    suggestions.push('Check the Odoo error message for specific details');
    suggestions.push('Review operation values for typos or incorrect types');
    suggestions.push('Verify all referenced records exist in Odoo');
    suggestions.push('Check user permissions and access rights');
  }

  return suggestions;
}
