/**
 * Plan formatting for console output.
 *
 * Formats execution plans in a Terraform-like style for human review before applying.
 * Uses ANSI colors and symbols to show changes clearly.
 */

import { ExecutionPlan, Operation } from './types';

/**
 * ANSI color codes for console output.
 */
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m', // Creates
  yellow: '\x1b[33m', // Updates
  red: '\x1b[31m', // Deletes
  cyan: '\x1b[36m', // Metadata
  gray: '\x1b[90m', // Comments
};

/**
 * Format an execution plan for console display.
 *
 * Output style:
 * ```
 * # project.project[1]
 * ~ name: "Q1" -> "Q1 Planning"
 * + task_ids: [] -> [1, 2, 3]
 *
 * + project.task[new:1]
 *   + name: "Research"
 *   + priority: "high"
 *
 * Plan: 2 to add, 1 to change, 0 to destroy.
 * ```
 *
 * @param plan Execution plan to format
 * @param colorize Whether to use ANSI colors (default: true for tty, false for piped output)
 * @returns Formatted plan string
 */
export function formatPlanForConsole(
  plan: ExecutionPlan,
  colorize: boolean = isTtyOutput()
): string {
  const lines: string[] = [];

  // Show errors if any
  if (plan.summary.hasErrors && plan.summary.errors) {
    lines.push(`${colorize ? colors.red : ''}Errors in plan:${colorize ? colors.reset : ''}`);
    for (const error of plan.summary.errors) {
      lines.push(`  - ${error}`);
    }
    lines.push('');
  }

  // If empty plan
  if (plan.summary.isEmpty) {
    lines.push('No changes. Your infrastructure matches the desired state.');
    return lines.join('\n');
  }

  // Group operations by model
  const operationsByModel = new Map<string, Operation[]>();
  for (const op of plan.operations) {
    if (!operationsByModel.has(op.model)) {
      operationsByModel.set(op.model, []);
    }
    operationsByModel.get(op.model)!.push(op);
  }

  // Format each model's operations
  for (const [, operations] of operationsByModel) {
    for (const op of operations) {
      lines.push(formatOperation(op, colorize));
    }
  }

  // Summary line
  lines.push('');
  lines.push(formatSummary(plan.summary, colorize));

  return lines.join('\n');
}

/**
 * Format a single operation.
 */
function formatOperation(op: Operation, colorize: boolean): string {
  const lines: string[] = [];

  // Operation header with model and ID
  const symbol = getOperationSymbol(op.type);
  const color = getOperationColor(op.type, colorize);
  const reset = colorize ? colors.reset : '';

  if (op.type === 'create') {
    lines.push(`${color}${symbol} ${op.model}[${extractId(op.id)}]${reset}`);
  } else if (op.type === 'update') {
    lines.push(`${color}${symbol} ${op.model}[${extractId(op.id)}]${reset}`);
  } else {
    lines.push(`${color}${symbol} ${op.model}[${extractId(op.id)}]${reset}`);
  }

  // Field changes
  if (op.values) {
    for (const [field, newValue] of Object.entries(op.values)) {
      const fieldLine = formatFieldChange(op.type, field, newValue, colorize);
      lines.push(`  ${fieldLine}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Format a single field change.
 */
function formatFieldChange(
  opType: string,
  field: string,
  newValue: any,
  colorize: boolean
): string {
  const symbol = getOperationSymbol(opType);
  const color = getOperationColor(opType, colorize);
  const reset = colorize ? colors.reset : '';

  const valueStr = formatValue(newValue);

  if (opType === 'create') {
    return `${color}${symbol}${reset} ${field} = ${valueStr}`;
  } else if (opType === 'update') {
    // Note: We'd need old value to show the full transition, but we don't have it in Operation
    return `${color}${symbol}${reset} ${field} = ${valueStr}`;
  } else {
    // delete
    return `${color}${symbol}${reset} ${field}`;
  }
}

/**
 * Get the symbol for an operation type.
 */
function getOperationSymbol(opType: string): string {
  switch (opType) {
    case 'create':
      return '+';
    case 'update':
      return '~';
    case 'delete':
      return '-';
    default:
      return '?';
  }
}

/**
 * Get the ANSI color for an operation type.
 */
function getOperationColor(opType: string, colorize: boolean): string {
  if (!colorize) return '';

  switch (opType) {
    case 'create':
      return colors.green;
    case 'update':
      return colors.yellow;
    case 'delete':
      return colors.red;
    default:
      return '';
  }
}

/**
 * Format a value for display.
 */
function formatValue(value: any): string {
  if (value === null || value === undefined) {
    return '(null)';
  }

  if (typeof value === 'string') {
    return `"${value}"`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }
    if (value.length <= 3) {
      return `[${value.join(', ')}]`;
    }
    return `[${value.slice(0, 3).join(', ')}, ... (${value.length} total)]`;
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Extract ID from operation ID string.
 *
 * Examples:
 * - "project.task:1" -> "1"
 * - "project.task:temp_1" -> "new:1"
 */
function extractId(id: string): string {
  const parts = id.split(':');
  if (parts.length === 2) {
    const idPart = parts[1];
    if (idPart.startsWith('temp_')) {
      return `new:${idPart.substring(5)}`;
    }
    return idPart;
  }
  return id;
}

/**
 * Format the plan summary line.
 */
function formatSummary(summary: any, colorize: boolean): string {
  const addColor = colorize ? colors.green : '';
  const changeColor = colorize ? colors.yellow : '';
  const destroyColor = colorize ? colors.red : '';
  const reset = colorize ? colors.reset : '';

  const parts: string[] = [];

  if (summary.creates > 0) {
    parts.push(`${addColor}${summary.creates} to add${reset}`);
  }

  if (summary.updates > 0) {
    parts.push(`${changeColor}${summary.updates} to change${reset}`);
  }

  if (summary.deletes > 0) {
    parts.push(`${destroyColor}${summary.deletes} to destroy${reset}`);
  }

  if (parts.length === 0) {
    return 'Plan: no changes.';
  }

  return `Plan: ${parts.join(', ')}.`;
}

/**
 * Check if output is being written to a terminal (TTY).
 *
 * Used to decide whether to include ANSI color codes.
 */
function isTtyOutput(): boolean {
  if (typeof process === 'undefined') {
    return false;
  }

  return process.stdout?.isTTY ?? false;
}

export { ExecutionPlan } from './types';
