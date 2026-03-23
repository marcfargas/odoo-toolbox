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

export type RemoveUnmanagedMap = Record<string, boolean>;

export interface ResourceDefinition {
  readonly __type: 'resource';
  readonly model: string;
  readonly ref?: LookupRef;
  readonly values: Record<string, unknown>;
  readonly removeUnmanaged?: RemoveUnmanagedMap;
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
