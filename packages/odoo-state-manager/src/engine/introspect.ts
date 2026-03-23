import createDebug from 'debug';
import type { OdooField } from '@marcfargas/odoo-introspection';
import type { Introspector } from '@marcfargas/odoo-introspection';
import type { ModelPolicy } from '../dsl/types';
import type { ResolvedState } from './types';

const debug = createDebug('odoo-state-manager:introspect');

// ---------------------------------------------------------------------------
// classifyRelationalField
// ---------------------------------------------------------------------------

/**
 * Classify a field as a relational type, or return null for non-relational fields.
 */
export function classifyRelationalField(
  field: OdooField
): 'one2many' | 'many2many' | 'many2one' | null {
  switch (field.ttype) {
    case 'many2one':
      return 'many2one';
    case 'one2many':
      return 'one2many';
    case 'many2many':
      return 'many2many';
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// buildDependencyGraph
// ---------------------------------------------------------------------------

/**
 * Build a dependency graph for the given models.
 *
 * A model A depends on model B if A has a many2one field pointing to B,
 * and B is also in the input list.
 *
 * @returns Adjacency list: model → [models it depends on]
 */
export async function buildDependencyGraph(
  models: string[],
  introspector: Introspector
): Promise<Map<string, string[]>> {
  const modelSet = new Set(models);
  const graph = new Map<string, string[]>();

  for (const modelName of models) {
    const fields = await introspector.getFields(modelName);
    const deps: string[] = [];

    for (const field of fields) {
      if (classifyRelationalField(field) === 'many2one' && field.relation) {
        if (modelSet.has(field.relation)) {
          deps.push(field.relation);
        }
      }
    }

    debug('dependencies for %s: %o', modelName, deps);
    graph.set(modelName, deps);
  }

  return graph;
}

// ---------------------------------------------------------------------------
// topologicalSort
// ---------------------------------------------------------------------------

/**
 * DFS-based topological sort of a dependency graph.
 *
 * Returns models in dependency order (dependencies come before their dependents).
 * Handles cycles gracefully by logging a warning and continuing.
 */
export function topologicalSort(graph: Map<string, string[]>): string[] {
  const visited = new Set<string>();
  const inStack = new Set<string>(); // for cycle detection
  const result: string[] = [];

  function visit(node: string): void {
    if (inStack.has(node)) {
      // Cycle detected — log warning and skip to avoid infinite loop
      debug('cycle detected at %s — skipping', node);
      console.warn(`[odoo-state-manager] topological sort: cycle detected at model '${node}'`);
      return;
    }
    if (visited.has(node)) {
      return;
    }

    inStack.add(node);

    const deps = graph.get(node) ?? [];
    for (const dep of deps) {
      visit(dep);
    }

    inStack.delete(node);
    visited.add(node);
    result.push(node);
  }

  for (const node of graph.keys()) {
    visit(node);
  }

  return result;
}

// ---------------------------------------------------------------------------
// getModelModuleMap
// ---------------------------------------------------------------------------

/**
 * For each model in the input list, determine which Odoo module provides it.
 *
 * Uses the `modules` field from OdooModel (CSV string) — takes the first module.
 *
 * @returns Map: model name → module name
 */
export async function getModelModuleMap(
  models: string[],
  introspector: Introspector
): Promise<Map<string, string>> {
  if (models.length === 0) {
    return new Map();
  }

  const allModels = await introspector.getModels();
  const modelLookup = new Map(allModels.map((m) => [m.model, m]));
  const result = new Map<string, string>();

  for (const modelName of models) {
    const odooModel = modelLookup.get(modelName);
    if (odooModel) {
      const firstModule = odooModel.modules ? odooModel.modules.split(',')[0].trim() : '';
      result.set(modelName, firstModule);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// validateModuleDependencies
// ---------------------------------------------------------------------------

/**
 * Validate that all modules required by the resolved state are either installed
 * in Odoo or present in the plan (as ir.module.module resources).
 *
 * @returns Array of error messages (empty = all ok)
 */
export async function validateModuleDependencies(
  resolved: ResolvedState,
  client: any,
  introspector: Introspector
): Promise<string[]> {
  // Collect all unique models across resources
  const models = [...new Set(resolved.resources.map((r) => r.model))];

  // Get model → module map
  const moduleMap = await getModelModuleMap(models, introspector);

  // Fetch installed modules
  const installedRecords: Array<{ name: string }> = await client.searchRead(
    'ir.module.module',
    [['state', '=', 'installed']],
    { fields: ['name'] }
  );
  const installedModules = new Set(installedRecords.map((r) => r.name));

  // Collect modules that are in the plan (ir.module.module resources)
  const planModules = new Set<string>();
  for (const resource of resolved.resources) {
    if (resource.model === 'ir.module.module') {
      const name = resource.resolvedValues['name'] ?? resource.original.values['name'];
      if (typeof name === 'string') {
        planModules.add(name);
      }
    }
  }

  const errors: string[] = [];

  for (const [model, module] of moduleMap) {
    if (!module) continue; // no module info — skip
    if (installedModules.has(module)) continue; // installed — ok
    if (planModules.has(module)) continue; // in plan — ok

    errors.push(
      `model '${model}' requires module '${module}' which is not installed and not in the plan`
    );
  }

  return errors;
}

// ---------------------------------------------------------------------------
// validateArchiveOrphans
// ---------------------------------------------------------------------------

/**
 * Validate that models with archiveOrphans=true have an `active` field.
 *
 * Odoo can only archive records when a model has an `active` boolean field.
 *
 * @returns Array of error messages (empty = all ok)
 */
export async function validateArchiveOrphans(
  policies: ModelPolicy[],
  introspector: Introspector
): Promise<string[]> {
  const errors: string[] = [];

  for (const policy of policies) {
    if (!policy.archiveOrphans) continue;

    const fields = await introspector.getFields(policy.model);
    const hasActive = fields.some((f) => f.name === 'active');

    if (!hasActive) {
      errors.push(
        `model '${policy.model}' does not have an 'active' field, cannot use archiveOrphans`
      );
    }
  }

  return errors;
}
