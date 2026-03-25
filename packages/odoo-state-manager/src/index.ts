export { resource, lookup, model, children } from './dsl';
export type {
  LookupRef,
  ResourceDefinition,
  ModelPolicy,
  Definition,
  LookupDomain,
  DomainShorthand,
  RawDomain,
  RemoveUnmanagedMap,
  ChildrenRef,
} from './dsl';
export { isLookupRef, isResourceDefinition, isModelPolicy, isChildrenRef } from './dsl';
export {
  evaluate,
  flattenChildren,
  domainToTuples,
  resolveLookups,
  parseExternalId,
} from './engine';
export type { ResolveClient } from './engine';
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
} from './engine';
export { plan, apply, diff, formatPlan } from './engine';
export { exportData, importData } from './clone';
export type {
  DataDomain,
  ExportOptions,
  ImportOptions,
  Snapshot,
  SnapshotMetadata,
  ExportedRecord,
  ImportResult,
} from './clone';
