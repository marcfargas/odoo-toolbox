/**
 * Safety module for Odoo operations
 *
 * Provides opt-in safety guards for write/delete operations.
 * Safety is off by default (backwards compatible). Consumers opt in
 * via per-client config or a global default.
 *
 * Usage:
 *   // Per-client (recommended for multi-env)
 *   const client = new OdooClient({ ...config, safety: mySafetyContext });
 *
 *   // Global default (convenience for single-client scripts)
 *   setDefaultSafetyContext(mySafetyContext);
 */

export type SafetyLevel = 'READ' | 'WRITE' | 'DELETE';

export interface OperationInfo {
  /** Operation identifier, e.g. 'odoo.create', 'odoo.unlink' */
  name: string;
  /** Safety classification */
  level: SafetyLevel;
  /** Odoo model name */
  model: string;
  /** Human-readable description */
  description: string;
  /** Base URL of the target Odoo instance (helps confirm() decide per-env) */
  target?: string;
  /** Additional context for the confirm callback */
  details?: Record<string, unknown>;
}

export interface SafetyContext {
  /** Called before WRITE and DELETE operations. Return true to proceed, false to block. */
  confirm: (op: OperationInfo) => Promise<boolean>;
}

/**
 * Known Odoo methods that are safe (read-only).
 * Exported so consumers can extend if needed.
 */
export const READ_METHODS = new Set([
  'search',
  'read',
  'search_read',
  'search_count',
  'fields_get',
  'name_get',
  'name_search',
  'default_get',
  'onchange',
  'load_views',
  'check_access_rights',
  'check_access_rule',
  'read_group',
]);

/** Methods classified as DELETE (irreversible removal). */
export const DELETE_METHODS = new Set(['unlink']);

/**
 * Infer safety level from an Odoo method name.
 * READ for known read methods, DELETE for unlink, WRITE for everything else.
 */
export function inferSafetyLevel(method: string): SafetyLevel {
  if (READ_METHODS.has(method)) return 'READ';
  if (DELETE_METHODS.has(method)) return 'DELETE';
  return 'WRITE';
}

// --- Global default ---

let defaultSafetyContext: SafetyContext | null = null;

/**
 * Set the process-wide default safety context.
 * Used as fallback when a client has no per-instance safety configured.
 * Pass null to disable the global default.
 */
export function setDefaultSafetyContext(ctx: SafetyContext | null): void {
  defaultSafetyContext = ctx;
}

/**
 * Get the current global default safety context.
 */
export function getDefaultSafetyContext(): SafetyContext | null {
  return defaultSafetyContext;
}

/**
 * Resolve the effective safety context for a client.
 *
 * Resolution order:
 * 1. Per-client context (if not undefined)
 * 2. Global default
 * 3. null (no safety)
 *
 * The distinction between `undefined` (not set, use default) and
 * `null` (explicitly disabled) is intentional.
 */
export function resolveSafetyContext(
  clientContext: SafetyContext | null | undefined
): SafetyContext | null {
  if (clientContext !== undefined) return clientContext;
  return defaultSafetyContext;
}
