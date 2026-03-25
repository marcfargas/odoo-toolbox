export { evaluate } from './evaluate';
export { domainToTuples, resolveLookups, parseExternalId } from './resolve';
export type { ResolveClient } from './resolve';
export {
  classifyRelationalField,
  buildDependencyGraph,
  topologicalSort,
  getModelModuleMap,
  validateModuleDependencies,
  validateArchiveOrphans,
} from './introspect';
export { normalizeFieldValue, diffRecord, diffResources } from './diff';
export type { FieldDiff, DiffResult } from './diff';
export { generatePlan } from './plan';
export { formatPlan } from './format';
export { applyPlan } from './apply';
export type { ApplyClient, ApplyOptions } from './apply';
export { plan, apply, diff } from './pipeline';
export type {
  EvaluationResult,
  Operation,
  OperationType,
  Plan,
  PlanSummary,
  PlanMetadata,
  OperationStatus,
  OperationResult,
  ApplyResult,
  ResolvedResource,
  ResolvedState,
} from './types';
