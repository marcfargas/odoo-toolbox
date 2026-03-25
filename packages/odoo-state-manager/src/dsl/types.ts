/** Domain shorthand: object keys become ['key', '=', value] tuples. */
export type DomainShorthand = Record<string, unknown>;
export type DomainTuple = [string, string, unknown];
export type RawDomain = DomainTuple[];
export type LookupDomain = DomainShorthand | RawDomain;

export interface LookupRef {
  readonly __type: 'lookup';
  readonly model: string;
  readonly domain: LookupDomain;
}

export interface ResourceRef {
  readonly __type: 'resourceRef';
  readonly externalId: string;
}

export type RemoveUnmanagedMap = Record<string, boolean>;

/** Tracks a child resource's relationship to its parent for scoping _ref lookups. */
export interface ParentScope {
  /** The inverse many2one field on the child model (e.g., 'project_id'). Undefined for inline many2one resources. */
  readonly inverseField?: string;
  /** Parent's external ID (if available). Used to resolve parent's record ID. */
  readonly parentExternalId?: string;
  /** Parent's _ref lookup (if available). Fallback when no externalId. */
  readonly parentRef?: LookupRef;
}

export interface ResourceDefinition {
  readonly __type: 'resource';
  readonly model: string;
  readonly ref?: LookupRef;
  /** Stable external ID for this resource (stored in ir.model.data). */
  readonly externalId?: string;
  readonly values: Record<string, unknown>;
  readonly removeUnmanaged?: RemoveUnmanagedMap;
  /** Set by flattenChildren when the resource was a child with an inverseField. */
  readonly parentScope?: ParentScope;
}

export interface ModelPolicy {
  readonly __type: 'model';
  readonly model: string;
  readonly removeOrphans?: boolean;
  readonly archiveOrphans?: boolean;
}

export type Definition = ResourceDefinition | ModelPolicy;

// Type guards
export function isLookupRef(v: unknown): v is LookupRef {
  return typeof v === 'object' && v !== null && (v as any).__type === 'lookup';
}
export function isResourceDefinition(v: unknown): v is ResourceDefinition {
  return typeof v === 'object' && v !== null && (v as any).__type === 'resource';
}
export function isModelPolicy(v: unknown): v is ModelPolicy {
  return typeof v === 'object' && v !== null && (v as any).__type === 'model';
}
export function isResourceRef(v: unknown): v is ResourceRef {
  return typeof v === 'object' && v !== null && (v as any).__type === 'resourceRef';
}
