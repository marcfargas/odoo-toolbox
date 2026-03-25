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
import { isResourceDefinition } from '../dsl/types';
import type { ParentScope, ResourceDefinition, ResourceRef } from '../dsl/types';

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
    const inlineResources: ResourceDefinition[] = [];

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
      } else if (isResourceDefinition(value)) {
        debug('found inline resource() in %s.%s → %s', res.model, field, value.model);

        // Build parentScope (no inverseField for inline many2one)
        const parentScope = {
          ...(res.externalId !== undefined ? { parentExternalId: res.externalId } : {}),
          ...(res.ref !== undefined ? { parentRef: res.ref } : {}),
        };

        // Auto-prefix and attach parentScope
        const extracted = prefixChildExternalId(
          value,
          res.externalId,
          Object.keys(parentScope).length > 0 ? parentScope : undefined
        );

        // Validate: extracted resource must have a fully qualified externalId
        if (!extracted.externalId || !extracted.externalId.includes('.')) {
          throw new Error(
            `Inline resource() in ${res.model}.${field} must have a fully qualified external ID ` +
              `(contains a dot). Got: '${extracted.externalId ?? '(none)'}'. ` +
              `Either give the inline resource a qualified externalId or ensure the parent has an externalId for auto-prefixing.`
          );
        }

        // Replace field value with ResourceRef marker
        const ref: ResourceRef = Object.freeze({
          __type: 'resourceRef' as const,
          externalId: extracted.externalId,
        });
        cleanedValues[field] = ref;
        inlineResources.push(extracted);
      } else {
        cleanedValues[field] = value;
      }
    }

    // Rebuild parent without ChildrenRef values (if any were found)
    if (childResources.length > 0 || inlineResources.length > 0) {
      const cleaned: ResourceDefinition = Object.freeze({
        __type: 'resource' as const,
        model: res.model,
        ...(res.externalId !== undefined ? { externalId: res.externalId } : {}),
        ...(res.ref !== undefined ? { ref: res.ref } : {}),
        values: Object.freeze(cleanedValues),
        ...(res.removeUnmanaged !== undefined ? { removeUnmanaged: res.removeUnmanaged } : {}),
      });
      // Inline many2one resources go BEFORE parent (parent references them)
      result.push(...inlineResources);
      result.push(cleaned);
      // children go AFTER parent (they reference parent via inverse field)
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
