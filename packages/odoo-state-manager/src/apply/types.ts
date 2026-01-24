/**
 * Type definitions for plan application and execution.
 * 
 * Tracks the execution of operations and results.
 */

import { Operation } from '../plan/types.js';

/**
 * Result of a single operation execution.
 */
export interface OperationResult {
  /** The operation that was executed */
  operation: Operation;

  /** Whether the operation succeeded */
  success: boolean;

  /** Result from Odoo (ID for create, true for update/delete) */
  result?: any;

  /** Error if operation failed */
  error?: Error;

  /** Duration in milliseconds */
  duration: number;

  /** Actual ID after execution (for creates, maps temp_id to real ID) */
  actualId?: number | string;
}

/**
 * Overall execution result.
 */
export interface ApplyResult {
  /** All operation results */
  operations: OperationResult[];

  /** Total number of operations executed */
  total: number;

  /** Number of successful operations */
  applied: number;

  /** Number of failed operations */
  failed: number;

  /** Whether execution was successful (all operations passed) */
  success: boolean;

  /** Total execution time in milliseconds */
  duration: number;

  /** Start time of execution */
  startTime: Date;

  /** End time of execution */
  endTime: Date;

  /** Mapping of temporary IDs to real IDs for created records */
  idMapping: Map<string, number>;

  /** Error messages if any operations failed */
  errors?: string[];
}

/**
 * Options for applying plans.
 */
export interface ApplyOptions {
  /**
   * Whether to perform a dry-run (validate without making changes).
   * Default: false
   */
  dryRun?: boolean;

  /**
   * Whether to stop on first error or continue with remaining operations.
   * Default: true (stop on error)
   */
  stopOnError?: boolean;

  /**
   * Whether to batch similar operations (multiple creates/updates on same model).
   * Default: false for safety, true if you know your operations are independent
   */
  enableBatching?: boolean;

  /**
   * Callback for progress updates.
   * Called after each operation with (current, total, operationId)
   */
  onProgress?: (current: number, total: number, operationId: string) => void;

  /**
   * Callback for operation completion.
   * Called with operation result.
   */
  onOperationComplete?: (result: OperationResult) => void;

  /**
   * Whether to validate operations before executing.
   * Default: true
   */
  validate?: boolean;

  /**
   * Custom context to use for all operations.
   * Will be merged with any context in the operation values.
   */
  context?: Record<string, any>;

  /**
   * Maximum number of operations to execute.
   * Default: no limit
   */
  maxOperations?: number;
}

/**
 * Options for dry-run execution.
 */
export interface DryRunOptions extends ApplyOptions {
  dryRun: true;
}
