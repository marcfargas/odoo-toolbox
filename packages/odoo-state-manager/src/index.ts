export { resource, lookup, model } from './dsl';
export type {
  LookupRef,
  ResourceDefinition,
  ModelPolicy,
  Definition,
  LookupDomain,
  DomainShorthand,
  RawDomain,
  RemoveUnmanagedMap,
} from './dsl';
export { isLookupRef, isResourceDefinition, isModelPolicy } from './dsl';
export { evaluate, domainToTuples, resolveLookups } from './engine';
export type { ResolveClient } from './engine';
export type {
  EvaluationResult,
  Operation,
  OperationType,
  Plan,
  OperationStatus,
  OperationResult,
  ApplyResult,
  ResolvedResource,
  ResolvedState,
} from './engine';
