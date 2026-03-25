/**
 * Flatten children() declarations into top-level resources.
 *
 * Scans all resources for ChildrenRef values. For each:
 * 1. Extracts child ResourceDefinitions
 * 2. Auto-prefixes child externalIds with the parent's externalId
 * 3. Adds children as top-level resources
 * 4. Removes the ChildrenRef from the parent's values
 *
 * This runs between evaluate and resolve.
 */

import createDebug from 'debug';
import { isChildrenRef } from '../dsl/children';
import type { ParentScope, ResourceDefinition } from '../dsl/types';

const debug = createDebug('odoo-state-manager:flatten');

/**
 * Flatten children declarations into top-level resources.
 *
 * @returns A new array of resources with children promoted to top-level.
 */
export function flattenChildren(resources: ResourceDefinition[]): ResourceDefinition[] {
  const result: ResourceDefinition[] = [];

  for (const res of resources) {
    // Check if any field value is a ChildrenRef
    const cleanedValues: Record<string, unknown> = {};
    const childResources: ResourceDefinition[] = [];

    for (const [field, value] of Object.entries(res.values)) {
      if (isChildrenRef(value)) {
        debug('found children() in %s.%s (%d children)', res.model, field, value.resources.length);

        // Build parent scope for _ref scoping (if inverseField is provided)
        const parentScope: ParentScope | undefined = value.inverseField
          ? {
              inverseField: value.inverseField,
              ...(res.externalId !== undefined ? { parentExternalId: res.externalId } : {}),
              ...(res.ref !== undefined ? { parentRef: res.ref } : {}),
            }
          : undefined;

        for (const child of value.resources) {
          // Auto-prefix child externalId with parent's externalId
          const prefixedChild = prefixChildExternalId(child, res.externalId, parentScope);
          childResources.push(prefixedChild);
        }

        // Don't include the ChildrenRef in the parent's values
      } else {
        cleanedValues[field] = value;
      }
    }

    // Rebuild parent without ChildrenRef values (if any were found)
    if (childResources.length > 0) {
      const cleaned: ResourceDefinition = Object.freeze({
        __type: 'resource' as const,
        model: res.model,
        ...(res.externalId !== undefined ? { externalId: res.externalId } : {}),
        ...(res.ref !== undefined ? { ref: res.ref } : {}),
        values: Object.freeze(cleanedValues),
        ...(res.removeUnmanaged !== undefined ? { removeUnmanaged: res.removeUnmanaged } : {}),
      });
      result.push(cleaned);
      result.push(...childResources);
    } else {
      result.push(res);
    }
  }

  return result;
}

/**
 * Auto-prefix a child resource's externalId with the parent's externalId,
 * and attach parentScope for _ref scoping.
 *
 * If the child has externalId "nuevo" and the parent has "bgbl.fiscal_project",
 * the child's externalId becomes "bgbl.fiscal_project.nuevo".
 *
 * If the child already has a fully qualified externalId (contains a dot),
 * it is left unchanged.
 *
 * If the parent has no externalId, the child is returned unchanged.
 */
function prefixChildExternalId(
  child: ResourceDefinition,
  parentExternalId: string | undefined,
  parentScope: ParentScope | undefined
): ResourceDefinition {
  const needsPrefix = child.externalId && parentExternalId && !child.externalId.includes('.');
  const needsScope = parentScope !== undefined;

  if (!needsPrefix && !needsScope) {
    return child;
  }

  let prefixed = child.externalId;
  if (needsPrefix) {
    prefixed = `${parentExternalId}.${child.externalId}`;
    debug('prefixed child externalId: %s → %s', child.externalId, prefixed);
  } else if (child.externalId?.includes('.')) {
    debug('child externalId %s is already qualified, skipping prefix', child.externalId);
  }

  return Object.freeze({
    __type: 'resource' as const,
    model: child.model,
    ...(prefixed !== undefined ? { externalId: prefixed } : {}),
    ...(child.ref !== undefined ? { ref: child.ref } : {}),
    values: child.values,
    ...(child.removeUnmanaged !== undefined ? { removeUnmanaged: child.removeUnmanaged } : {}),
    ...(needsScope ? { parentScope } : {}),
  });
}
