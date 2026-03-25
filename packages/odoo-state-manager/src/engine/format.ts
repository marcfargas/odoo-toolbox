import type { Plan, Operation } from './types';

// ---------------------------------------------------------------------------
// ANSI colors
// ---------------------------------------------------------------------------

const ANSI = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
} as const;

function colorize(text: string, color: keyof typeof ANSI, enabled: boolean): string {
  if (!enabled) return text;
  return `${ANSI[color]}${text}${ANSI.reset}`;
}

// ---------------------------------------------------------------------------
// Auto-detect TTY
// ---------------------------------------------------------------------------

function isTTY(): boolean {
  return process.stdout.isTTY === true;
}

// ---------------------------------------------------------------------------
// formatValue — produce a display string for a field value
// ---------------------------------------------------------------------------

function formatValue(value: unknown): string {
  if (typeof value === 'string') return `"${value}"`;
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return JSON.stringify(value);
  return String(value);
}

// ---------------------------------------------------------------------------
// formatOperation — render a single operation block
// ---------------------------------------------------------------------------

function formatOperation(op: Operation, color: boolean): string {
  const lines: string[] = [];

  const symbol = opSymbol(op);
  const symbolColored = colorizeSymbol(symbol, op, color);
  const desc = op.description ? ` "${op.description}"` : '';
  const extId = op.externalId ? ` [${op.externalId}]` : '';
  const header = `${symbolColored} ${op.model}${desc}${extId}`;
  lines.push(header);

  // For adopts: show binding info
  if (op.type === 'adopt') {
    const line = `    Binding external ID to existing record #${op.id}`;
    lines.push(color ? colorize(line, 'green', true) : line);
  }

  // For creates: list all field values
  if (op.type === 'create' && op.values) {
    for (const [field, value] of Object.entries(op.values)) {
      const line = `    ${field}: ${formatValue(value)}`;
      lines.push(line);
    }
  }

  // For updates: list field changes
  if (op.type === 'update' && op.changes && op.changes.length > 0) {
    for (const change of op.changes) {
      const changeLine = `    ~ ${change.field}: ${formatValue(change.actual)} → ${formatValue(change.desired)}`;
      lines.push(color ? colorize(changeLine, 'yellow', true) : changeLine);
    }
  }

  return lines.join('\n');
}

function opSymbol(op: Operation): string {
  switch (op.type) {
    case 'create':
      return '+';
    case 'update':
      return '~';
    case 'unlink':
    case 'delete':
      return '-';
    case 'archive':
      return '!';
    case 'adopt':
      return '*';
    default:
      return '?';
  }
}

function colorizeSymbol(symbol: string, op: Operation, color: boolean): string {
  if (!color) return symbol;
  switch (op.type) {
    case 'create':
      return colorize(symbol, 'green', true);
    case 'update':
      return colorize(symbol, 'yellow', true);
    case 'unlink':
    case 'delete':
      return colorize(symbol, 'red', true);
    case 'archive':
      return colorize(symbol, 'yellow', true);
    case 'adopt':
      return colorize(symbol, 'green', true);
    default:
      return symbol;
  }
}

// ---------------------------------------------------------------------------
// formatSummary — produce the "Plan: X to install, ..." line
// ---------------------------------------------------------------------------

function formatSummary(plan: Plan, color: boolean): string {
  if (plan.summary.isEmpty) {
    return color
      ? colorize('No changes. Infrastructure is up-to-date.', 'green', true)
      : 'No changes. Infrastructure is up-to-date.';
  }

  const parts: string[] = [];

  if (plan.summary.installs > 0) {
    parts.push(`${plan.summary.installs} to install`);
  }
  if (plan.summary.creates > 0) {
    parts.push(`${plan.summary.creates} to create`);
  }
  if (plan.summary.updates > 0) {
    parts.push(`${plan.summary.updates} to update`);
  }
  if (plan.summary.unlinks > 0) {
    parts.push(`${plan.summary.unlinks} to remove`);
  }
  if (plan.summary.archives > 0) {
    parts.push(`${plan.summary.archives} to archive`);
  }
  if (plan.summary.adopts > 0) {
    parts.push(`${plan.summary.adopts} to adopt`);
  }

  const line = `Plan: ${parts.join(', ')}.`;
  return color ? colorize(line, 'bold', true) : line;
}

// ---------------------------------------------------------------------------
// formatPlan
// ---------------------------------------------------------------------------

/**
 * Format a Plan as Terraform-style console output.
 *
 * @param plan - The plan to format.
 * @param colorize - Whether to use ANSI colors. Defaults to auto-detecting TTY.
 * @returns Formatted string suitable for console output.
 */
export function formatPlan(plan: Plan, colorize?: boolean): string {
  const color = colorize ?? isTTY();

  if (plan.summary.isEmpty) {
    return formatSummary(plan, color);
  }

  const sections: string[] = [];

  for (const op of plan.operations) {
    sections.push(formatOperation(op, color));
  }

  sections.push('');
  sections.push(formatSummary(plan, color));

  return sections.join('\n');
}
