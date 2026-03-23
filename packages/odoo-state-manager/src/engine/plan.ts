import createDebug from 'debug';
import { topologicalSort } from './introspect';
import type { DiffResult } from './diff';
import type { Operation, Plan, PlanSummary, PlanMetadata, ResolvedState } from './types';
import type { ModelPolicy } from '../dsl/types';

const debug = createDebug('odoo-state-manager:plan');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODULE_MODEL = 'ir.module.module';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sort order for operation types within a level. */
function operationOrder(type: Operation['type']): number {
  switch (type) {
    case 'create':
      return 0;
    case 'update':
      return 1;
    case 'unlink':
      return 2;
    case 'archive':
      return 3;
    case 'delete':
      return 4;
    default:
      return 5;
  }
}

// ---------------------------------------------------------------------------
// generatePlan
// ---------------------------------------------------------------------------

/**
 * Generate an ordered Plan from diff results.
 *
 * Level 0: Module installs (ir.module.module creates).
 * Level 1+: Record operations ordered by topological sort of the dependency graph.
 *   Within a level, creates run before updates, updates before unlinks.
 * Final level: removeOrphans/archiveOrphans policy placeholder operations.
 */
export function generatePlan(
  diffs: DiffResult[],
  depGraph: Map<string, string[]>,
  resolved: ResolvedState,
  policies: ModelPolicy[]
): Plan {
  const operations: Operation[] = [];

  // -------------------------------------------------------------------------
  // Level 0: Module installs
  // -------------------------------------------------------------------------

  const moduleDiffs = diffs.filter(
    (d) => d.resource.model === MODULE_MODEL && d.mode === 'create' && d.hasChanges
  );

  for (const diff of moduleDiffs) {
    const res = diff.resource;
    const moduleName =
      (res.resolvedValues['name'] as string | undefined) ??
      (res.original.values['name'] as string | undefined) ??
      MODULE_MODEL;

    debug('module install: %s', moduleName);
    operations.push({
      type: 'create',
      model: MODULE_MODEL,
      values: res.resolvedValues,
      description: moduleName,
      level: 0,
    });
  }

  // -------------------------------------------------------------------------
  // Level 1+: Record operations by topological order
  // -------------------------------------------------------------------------

  // Filter out module diffs and skipped resources
  const recordDiffs = diffs.filter((d) => d.resource.model !== MODULE_MODEL && d.hasChanges);

  // Build an ordering for models using topological sort
  const sortedModels = topologicalSort(depGraph);

  // Assign a level (1-based) per model based on topo order
  const modelLevelMap = new Map<string, number>();
  for (let i = 0; i < sortedModels.length; i++) {
    // Skip the module model — it's level 0
    if (sortedModels[i] === MODULE_MODEL) continue;
    modelLevelMap.set(sortedModels[i], i + 1);
  }

  // Group diffs by model
  const diffsByModel = new Map<string, DiffResult[]>();
  for (const diff of recordDiffs) {
    const model = diff.resource.model;
    if (!diffsByModel.has(model)) {
      diffsByModel.set(model, []);
    }
    diffsByModel.get(model)!.push(diff);
  }

  // Build operations per model in topo order
  // For models not in sortedModels (missing from depGraph), use a high level
  const MAX_FALLBACK_LEVEL = sortedModels.length + 1;

  // Collect all models with diffs, sorted by their level
  const modelsWithDiffs = [...diffsByModel.keys()].sort((a, b) => {
    const la = modelLevelMap.get(a) ?? MAX_FALLBACK_LEVEL;
    const lb = modelLevelMap.get(b) ?? MAX_FALLBACK_LEVEL;
    return la - lb;
  });

  for (const model of modelsWithDiffs) {
    const modelDiffs = diffsByModel.get(model)!;
    const level = modelLevelMap.get(model) ?? MAX_FALLBACK_LEVEL;

    // Sort within model: creates before updates before unlinks
    const sorted = [...modelDiffs].sort((a, b) => {
      const opA = a.mode === 'create' ? 'create' : 'update';
      const opB = b.mode === 'create' ? 'create' : 'update';
      return operationOrder(opA) - operationOrder(opB);
    });

    for (const diff of sorted) {
      const res = diff.resource;
      const description = deriveDescription(res.resolvedValues, res.original.values);

      if (diff.mode === 'create') {
        operations.push({
          type: 'create',
          model,
          values: res.resolvedValues,
          description,
          level,
        });
      } else {
        // update mode — include field changes for display
        operations.push({
          type: 'update',
          model,
          id: res.resolvedId ?? undefined,
          values: res.resolvedValues,
          description,
          level,
          changes: diff.changes,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Final level: Policy placeholder operations
  // -------------------------------------------------------------------------

  const finalLevel = (modelLevelMap.size > 0 ? Math.max(...modelLevelMap.values()) : 1) + 1;

  for (const policy of policies) {
    if (policy.archiveOrphans) {
      debug('policy archiveOrphans for %s → placeholder archive op', policy.model);
      operations.push({
        type: 'archive',
        model: policy.model,
        description: `archive orphans of ${policy.model}`,
        level: finalLevel,
      });
    } else if (policy.removeOrphans) {
      debug('policy removeOrphans for %s → placeholder unlink op', policy.model);
      operations.push({
        type: 'unlink',
        model: policy.model,
        description: `remove orphans of ${policy.model}`,
        level: finalLevel,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Build summary
  // -------------------------------------------------------------------------

  const installs = operations.filter(
    (op) => op.type === 'create' && op.model === MODULE_MODEL
  ).length;
  const creates = operations.filter(
    (op) => op.type === 'create' && op.model !== MODULE_MODEL
  ).length;
  const updates = operations.filter((op) => op.type === 'update').length;
  const unlinks = operations.filter((op) => op.type === 'unlink').length;
  const archives = operations.filter((op) => op.type === 'archive').length;
  const total = operations.length;

  const summary: PlanSummary = {
    installs,
    creates,
    updates,
    unlinks,
    archives,
    total,
    isEmpty: total === 0,
  };

  const metadata: PlanMetadata = {
    timestamp: new Date().toISOString(),
    models: [...new Set(operations.map((op) => op.model))],
  };

  debug(
    'plan: %d installs, %d creates, %d updates, %d unlinks, %d archives',
    installs,
    creates,
    updates,
    unlinks,
    archives
  );

  return { operations, summary, metadata };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive a human-readable description from field values.
 * Uses 'name', 'display_name', or 'code' as a fallback.
 */
function deriveDescription(
  resolvedValues: Record<string, unknown>,
  originalValues: Record<string, unknown>
): string {
  for (const key of ['name', 'display_name', 'code', 'complete_name']) {
    const v = resolvedValues[key] ?? originalValues[key];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return '';
}
