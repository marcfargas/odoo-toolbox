import { Introspector } from '@marcfargas/odoo-introspection';
import type { OdooClient } from '@marcfargas/odoo-client';
import { evaluate } from './evaluate';
import { flattenChildren } from './flatten';
import { resolveLookups } from './resolve';
import type { ResolveClient } from './resolve';
import {
  buildDependencyGraph,
  validateModuleDependencies,
  validateArchiveOrphans,
} from './introspect';
import { diffResources } from './diff';
import { generatePlan } from './plan';
import { applyPlan } from './apply';
import type { ApplyClient, ApplyOptions } from './apply';
import type { Plan, ApplyResult } from './types';

// ---------------------------------------------------------------------------
// plan
// ---------------------------------------------------------------------------

/**
 * Run the full read-only pipeline: evaluate → resolve → introspect → diff → plan.
 *
 * @returns A Plan describing all pending changes (empty plan = no drift).
 */
export async function plan(options: { dir: string; client: OdooClient }): Promise<Plan> {
  const { dir, client } = options;

  // 1. Evaluate — collect definitions from .ts files
  const definitions = await evaluate(dir);

  // 2. Flatten children — promote children() declarations to top-level resources
  const flatResources = flattenChildren(definitions.resources);

  // 3. Resolve lookups — replace LookupRef markers with real IDs
  const resolved = await resolveLookups(
    flatResources,
    definitions.policies,
    client as unknown as ResolveClient
  );

  // 3. Introspector — wraps client for model metadata
  const introspector = new Introspector(client);

  // 4. Get unique models from resolved resources
  const models = [...new Set(resolved.resources.map((r) => r.model))];

  // 5. Build dependency graph
  const depGraph = await buildDependencyGraph(models, introspector);

  // 6. Validate module dependencies — throw on any error
  const moduleErrors = await validateModuleDependencies(resolved, client, introspector);
  if (moduleErrors.length > 0) {
    throw new Error(`Module dependency errors:\n${moduleErrors.map((e) => `  - ${e}`).join('\n')}`);
  }

  // 7. Validate archive orphans — throw on any error
  const archiveErrors = await validateArchiveOrphans(definitions.policies, introspector);
  if (archiveErrors.length > 0) {
    throw new Error(`Archive orphan errors:\n${archiveErrors.map((e) => `  - ${e}`).join('\n')}`);
  }

  // 8. Diff — compare desired vs actual state
  // Cast to the minimal DiffClient interface — OdooClient is structurally compatible
  const diffs = await diffResources(resolved, client as any, introspector);

  // 9. Generate plan — ordered set of operations
  const result = generatePlan(diffs, depGraph, resolved, definitions.policies);

  return result;
}

// ---------------------------------------------------------------------------
// apply
// ---------------------------------------------------------------------------

/**
 * Run the full pipeline and execute the plan against Odoo.
 *
 * @returns ApplyResult with per-operation outcomes.
 */
export async function apply(options: {
  dir: string;
  client: OdooClient;
  stopOnError?: boolean;
  onProgress?: ApplyOptions['onProgress'];
  onOperationComplete?: ApplyOptions['onOperationComplete'];
}): Promise<ApplyResult> {
  const { dir, client, stopOnError, onProgress, onOperationComplete } = options;

  const executionPlan = await plan({ dir, client });

  // Cast to ApplyClient — OdooClient is structurally compatible (extra return type on installModule is ok)
  return applyPlan(executionPlan, client as unknown as ApplyClient, {
    stopOnError,
    onProgress,
    onOperationComplete,
  });
}

// ---------------------------------------------------------------------------
// diff
// ---------------------------------------------------------------------------

/**
 * Detect drift — functionally identical to plan().
 *
 * Returns the plan so the caller can inspect pending changes.
 * Exit semantics: empty plan = no drift (exit 0), non-empty = drift detected (exit 2).
 */
export async function diff(options: { dir: string; client: OdooClient }): Promise<Plan> {
  return plan(options);
}
