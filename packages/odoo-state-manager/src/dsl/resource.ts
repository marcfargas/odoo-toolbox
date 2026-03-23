import type { LookupRef, RemoveUnmanagedMap, ResourceDefinition } from './types';

export function resource(model: string, definition: Record<string, unknown>): ResourceDefinition {
  const { _ref, removeUnmanaged, ...values } = definition;
  return Object.freeze({
    __type: 'resource' as const,
    model,
    ...(_ref !== undefined ? { ref: _ref as LookupRef } : {}),
    values: Object.freeze({ ...values }),
    ...(removeUnmanaged !== undefined
      ? { removeUnmanaged: removeUnmanaged as RemoveUnmanagedMap }
      : {}),
  });
}
