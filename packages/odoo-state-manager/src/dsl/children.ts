import type { ResourceDefinition } from './types';

/**
 * A children wrapper that declares child resources for a one2many field.
 *
 * When the parent resource has an externalId, each child's externalId is
 * automatically prefixed with the parent's externalId at resolve time.
 *
 * @example
 * resource('project.project', 'bgbl.fiscal', {
 *   type_ids: children('project.task.type', [
 *     resource('project.task.type', 'nuevo', { name: 'Nuevo' }),
 *     resource('project.task.type', 'done', { name: 'Done' }),
 *   ]),
 * })
 */
export interface ChildrenRef {
  readonly __type: 'children';
  readonly model: string;
  /** Inverse many2one field on the child model (e.g., 'project_id'). Scopes _ref lookups to the parent. */
  readonly inverseField?: string;
  readonly resources: ResourceDefinition[];
}

export function isChildrenRef(v: unknown): v is ChildrenRef {
  return typeof v === 'object' && v !== null && (v as any).__type === 'children';
}

export function children(model: string, resources: ResourceDefinition[]): ChildrenRef;
export function children(
  model: string,
  inverseField: string,
  resources: ResourceDefinition[]
): ChildrenRef;
export function children(
  model: string,
  inverseFieldOrResources: string | ResourceDefinition[],
  maybeResources?: ResourceDefinition[]
): ChildrenRef {
  if (typeof inverseFieldOrResources === 'string') {
    return Object.freeze({
      __type: 'children' as const,
      model,
      inverseField: inverseFieldOrResources,
      resources: maybeResources!,
    });
  }
  return Object.freeze({ __type: 'children' as const, model, resources: inverseFieldOrResources });
}
