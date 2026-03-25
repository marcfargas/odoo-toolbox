import createDebug from 'debug';
import type { Plan, Operation, OperationResult, ApplyResult } from './types';
import { parseExternalId } from './resolve';
import { isResourceRef } from '../dsl/types';

const debug = createDebug('odoo-state-manager:apply');

// ---------------------------------------------------------------------------
// Client interface
// ---------------------------------------------------------------------------

export interface ApplyClient {
  create(model: string, values: Record<string, unknown>): Promise<number>;
  write(model: string, ids: number | number[], values: Record<string, unknown>): Promise<boolean>;
  unlink(model: string, ids: number | number[]): Promise<boolean>;
  modules: {
    installModule(name: string): Promise<void>;
  };
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ApplyOptions {
  /** Stop execution on first error. Default: true. */
  stopOnError?: boolean;
  /** Called before each operation with 1-based progress counters. */
  onProgress?: (current: number, total: number, operation: Operation) => void;
  /** Called after each operation completes (ok, error, or skipped). */
  onOperationComplete?: (result: OperationResult) => void;
}

// ---------------------------------------------------------------------------
// MODULE_MODEL constant
// ---------------------------------------------------------------------------

const MODULE_MODEL = 'ir.module.module';

// ---------------------------------------------------------------------------
// applyPlan
// ---------------------------------------------------------------------------

/**
 * Execute a Plan level by level against an Odoo instance.
 *
 * - Operations are grouped by level (ascending).
 * - Within a level: module installs run sequentially, record operations are
 *   batched per model/type (unlink and archive batch IDs; create and update
 *   run per-record to preserve individual IDs and values).
 * - `stopOnError` (default true) halts on the first failure and marks
 *   remaining operations as 'skipped'.
 */
export async function applyPlan(
  plan: Plan,
  client: ApplyClient,
  options: ApplyOptions = {}
): Promise<ApplyResult> {
  const { stopOnError = true, onProgress, onOperationComplete } = options;

  const total = plan.operations.length;
  const results: OperationResult[] = [];
  let succeeded = 0;
  let failed = 0;
  let halted = false;

  // Track created/adopted IDs by externalId for ResourceRef backfill
  const createdIds = new Map<string, number>();

  if (total === 0) {
    return { results, succeeded, failed };
  }

  // Group operations by level, ascending
  const byLevel = groupByLevel(plan.operations);
  const levels = [...byLevel.keys()].sort((a, b) => a - b);

  let operationIndex = 0;

  for (const level of levels) {
    const ops = byLevel.get(level)!;

    // --- Module installs (level 0, ir.module.module creates) ---
    const installOps = ops.filter((op) => op.model === MODULE_MODEL && op.type === 'create');
    const recordOps = ops.filter((op) => !(op.model === MODULE_MODEL && op.type === 'create'));

    // Sequential installs
    for (const op of installOps) {
      operationIndex++;
      const current = operationIndex;

      if (halted) {
        const r = skippedResult(op);
        results.push(r);
        onOperationComplete?.(r);
        continue;
      }

      onProgress?.(current, total, op);

      const r = await executeInstall(op, client);
      results.push(r);
      onOperationComplete?.(r);

      if (r.status === 'ok') {
        succeeded++;
      } else {
        failed++;
        if (stopOnError) halted = true;
      }
    }

    // Batch record operations per model + type, preserving order
    // We process them in the order they appear but batch unlink/archive
    if (recordOps.length > 0) {
      const batchedResults = await executeBatched(
        recordOps,
        client,
        createdIds,
        operationIndex,
        total,
        halted,
        stopOnError,
        onProgress,
        onOperationComplete
      );

      for (const r of batchedResults) {
        results.push(r);
        if (r.status === 'ok') succeeded++;
        else if (r.status === 'error') {
          failed++;
          if (stopOnError) halted = true;
        }
        // skipped: no counter change
      }

      operationIndex += recordOps.length;
    }
  }

  debug('apply complete: %d succeeded, %d failed', succeeded, failed);
  return { results, succeeded, failed };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function groupByLevel(operations: Operation[]): Map<number, Operation[]> {
  const map = new Map<number, Operation[]>();
  for (const op of operations) {
    const level = op.level ?? 1;
    if (!map.has(level)) map.set(level, []);
    map.get(level)!.push(op);
  }
  return map;
}

function skippedResult(operation: Operation): OperationResult {
  return { operation, status: 'skipped' };
}

async function executeInstall(op: Operation, client: ApplyClient): Promise<OperationResult> {
  const moduleName = (op.values?.['name'] as string | undefined) ?? op.description ?? MODULE_MODEL;
  debug('install module: %s', moduleName);
  try {
    await client.modules.installModule(moduleName);
    return { operation: op, status: 'ok' };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    debug('install failed: %s — %s', moduleName, error);
    return { operation: op, status: 'error', error };
  }
}

/**
 * Execute a batch of non-module-install record operations.
 *
 * Strategy:
 * - unlink: collect all IDs for the same model in a contiguous run → single call
 * - archive: collect all IDs for the same model in a contiguous run → single write({active:false})
 * - create: per-record (need individual returned IDs)
 * - update: per-record (each may have different values)
 *
 * For unlink and archive batching, we scan ahead for consecutive same-model same-type
 * ops and issue one call, producing one OperationResult per original op.
 */
async function executeBatched(
  ops: Operation[],
  client: ApplyClient,
  createdIds: Map<string, number>,
  baseIndex: number,
  total: number,
  initialHalted: boolean,
  stopOnError: boolean,
  onProgress?: (current: number, total: number, op: Operation) => void,
  onOperationComplete?: (result: OperationResult) => void
): Promise<OperationResult[]> {
  const results: OperationResult[] = [];
  let halted = initialHalted;
  let i = 0;

  while (i < ops.length) {
    const op = ops[i];
    const current = baseIndex + i + 1;

    if (halted) {
      const r = skippedResult(op);
      results.push(r);
      onOperationComplete?.(r);
      i++;
      continue;
    }

    // Try to batch unlink or archive ops of the same model
    if (op.type === 'unlink' || op.type === 'archive') {
      // Collect contiguous same-model same-type ops
      const batchStart = i;
      const batchModel = op.model;
      const batchType = op.type;
      const batchOps: Operation[] = [];

      while (i < ops.length && ops[i].type === batchType && ops[i].model === batchModel) {
        batchOps.push(ops[i]);
        i++;
      }

      const ids = batchOps.map((o) => o.id).filter((id): id is number => id !== undefined);

      // Progress callback for each op in the batch (use first op's index for first)
      for (let b = 0; b < batchOps.length; b++) {
        onProgress?.(baseIndex + batchStart + b + 1, total, batchOps[b]);
      }

      let batchError: string | undefined;
      try {
        if (batchType === 'unlink') {
          debug('unlink %s ids=%j', batchModel, ids);
          await client.unlink(batchModel, ids);
        } else {
          debug('archive %s ids=%j', batchModel, ids);
          await client.write(batchModel, ids, { active: false });
        }
      } catch (err) {
        batchError = err instanceof Error ? err.message : String(err);
        debug('%s batch failed: %s — %s', batchType, batchModel, batchError);
      }

      for (const batchOp of batchOps) {
        const r: OperationResult = batchError
          ? { operation: batchOp, status: 'error', error: batchError }
          : { operation: batchOp, status: 'ok' };
        results.push(r);
        onOperationComplete?.(r);
        if (r.status === 'error' && stopOnError) halted = true;
      }

      continue;
    }

    // Create, update, or adopt: per-record
    onProgress?.(current, total, op);

    let r: OperationResult;
    if (op.type === 'create') {
      r = await executeCreate(op, client, createdIds);
    } else if (op.type === 'update') {
      r = await executeUpdate(op, client, createdIds);
    } else if (op.type === 'adopt') {
      r = await executeAdopt(op, client, createdIds);
    } else {
      // Fallback for unknown types — treat as error
      r = { operation: op, status: 'error', error: `Unknown operation type: ${op.type}` };
    }

    results.push(r);
    onOperationComplete?.(r);

    if (r.status === 'error' && stopOnError) halted = true;

    i++;
  }

  return results;
}

/**
 * Replace any ResourceRef markers in operation values with resolved numeric IDs.
 * Returns a new values object if any replacements were made, otherwise the original.
 */
function resolveResourceRefs(
  values: Record<string, unknown>,
  createdIds: Map<string, number>
): Record<string, unknown> {
  let replaced = false;
  const resolved: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(values)) {
    if (isResourceRef(val)) {
      const id = createdIds.get(val.externalId);
      if (id === undefined) {
        throw new Error(
          `ResourceRef '${val.externalId}' could not be resolved — ` +
            `the referenced resource was not created or adopted in a prior level`
        );
      }
      resolved[key] = id;
      replaced = true;
      debug('backfill %s → id=%d', val.externalId, id);
    } else {
      resolved[key] = val;
    }
  }

  return replaced ? resolved : values;
}

async function executeCreate(
  op: Operation,
  client: ApplyClient,
  createdIds: Map<string, number>
): Promise<OperationResult> {
  const values = op.values ? resolveResourceRefs(op.values, createdIds) : {};
  debug('create %s values=%j', op.model, values);
  try {
    const id = await client.create(op.model, values);
    debug('create %s → id=%d', op.model, id);

    // Track created ID for ResourceRef backfill
    if (op.externalId) {
      createdIds.set(op.externalId, id);
    }

    // Write external ID to ir.model.data if present
    if (op.externalId) {
      await writeExternalId(client, op.externalId, op.model, id);
    }

    return { operation: op, status: 'ok', id };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    debug('create %s failed: %s', op.model, error);
    return { operation: op, status: 'error', error };
  }
}

async function executeAdopt(
  op: Operation,
  client: ApplyClient,
  createdIds: Map<string, number>
): Promise<OperationResult> {
  if (!op.externalId || !op.id) {
    return { operation: op, status: 'error', error: 'adopt requires externalId and id' };
  }
  debug('adopt %s id=%d externalId=%s', op.model, op.id, op.externalId);
  try {
    await writeExternalId(client, op.externalId, op.model, op.id);

    // Track adopted ID for ResourceRef backfill
    createdIds.set(op.externalId, op.id);

    return { operation: op, status: 'ok' };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    debug('adopt %s id=%d failed: %s', op.model, op.id, error);
    return { operation: op, status: 'error', error };
  }
}

async function writeExternalId(
  client: ApplyClient,
  externalId: string,
  model: string,
  resId: number
): Promise<void> {
  const { module, name } = parseExternalId(externalId);
  debug('writing ir.model.data: %s.%s → %s#%d', module, name, model, resId);
  await client.create('ir.model.data', {
    module,
    name,
    model,
    res_id: resId,
    noupdate: true,
  });
}

async function executeUpdate(
  op: Operation,
  client: ApplyClient,
  createdIds: Map<string, number>
): Promise<OperationResult> {
  const values = op.values ? resolveResourceRefs(op.values, createdIds) : {};
  debug('update %s id=%d values=%j', op.model, op.id, values);
  try {
    const ids = op.id !== undefined ? [op.id] : [];
    await client.write(op.model, ids, values);

    // Track ID for ResourceRef backfill (inline resource in update mode)
    if (op.externalId && op.id !== undefined) {
      createdIds.set(op.externalId, op.id);
    }

    return { operation: op, status: 'ok' };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    debug('update %s id=%d failed: %s', op.model, op.id, error);
    return { operation: op, status: 'error', error };
  }
}
