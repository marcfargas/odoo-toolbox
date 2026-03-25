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
import type { ResourceDefinition } from '../dsl/types';

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

        for (const child of value.resources) {
          // Auto-prefix child externalId with parent's externalId
          const prefixedChild = prefixChildExternalId(child, res.externalId);
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
 * Auto-prefix a child resource's externalId with the parent's externalId.
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
  parentExternalId: string | undefined
): ResourceDefinition {
  if (!child.externalId || !parentExternalId) {
    return child;
  }

  // If the child's externalId already contains a dot, treat it as fully qualified
  if (child.externalId.includes('.')) {
    debug('child externalId %s is already qualified, skipping prefix', child.externalId);
    return child;
  }

  // Prefix: "bgbl.fiscal_project" + "nuevo" → "bgbl.fiscal_project.nuevo"
  const prefixed = `${parentExternalId}.${child.externalId}`;
  debug('prefixed child externalId: %s → %s', child.externalId, prefixed);

  return Object.freeze({
    __type: 'resource' as const,
    model: child.model,
    externalId: prefixed,
    ...(child.ref !== undefined ? { ref: child.ref } : {}),
    values: child.values,
    ...(child.removeUnmanaged !== undefined ? { removeUnmanaged: child.removeUnmanaged } : {}),
  });
}
