import createDebug from 'debug';
import { isLookupRef } from '../dsl/types';
import type {
  LookupDomain,
  LookupRef,
  RawDomain,
  ResourceDefinition,
  ModelPolicy,
} from '../dsl/types';
import type { ResolvedResource, ResolvedState } from './types';

export type { ResolvedResource, ResolvedState };

const debug = createDebug('odoo-state-manager:resolve');

// ---------------------------------------------------------------------------
// Public client interface (minimal — allows mocking in tests)
// ---------------------------------------------------------------------------

export interface ResolveClient {
  searchRead<T = any>(
    model: string,
    domain: any[],
    options?: { fields?: string[]; limit?: number }
  ): Promise<T[]>;
}

// ---------------------------------------------------------------------------
// External ID helpers
// ---------------------------------------------------------------------------

/**
 * Split an external ID string into module and name.
 * Convention: "module.name" where module is everything before the first dot.
 *
 * Example: "bgbl.fiscal_project" → { module: "bgbl", name: "fiscal_project" }
 * Example: "bgbl.fiscal_project.nuevo" → { module: "bgbl", name: "fiscal_project.nuevo" }
 */
export function parseExternalId(externalId: string): { module: string; name: string } {
  const dotIndex = externalId.indexOf('.');
  if (dotIndex === -1) {
    throw new Error(
      `Invalid external ID '${externalId}': must contain a dot (e.g., 'module.name')`
    );
  }
  return {
    module: externalId.substring(0, dotIndex),
    name: externalId.substring(dotIndex + 1),
  };
}

// ---------------------------------------------------------------------------
// domainToTuples
// ---------------------------------------------------------------------------

/**
 * Convert a LookupDomain to RawDomain (array of tuples).
 *
 * - If domain is already an array, return as-is.
 * - If domain is an object (shorthand), convert each key to ['key', '=', value].
 */
export function domainToTuples(domain: LookupDomain): RawDomain {
  if (Array.isArray(domain)) {
    return domain as RawDomain;
  }
  return Object.entries(domain).map(([key, value]) => [key, '=', value]);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Stable string key for deduplicating (model, domain) pairs. */
function lookupKey(model: string, domain: RawDomain): string {
  return JSON.stringify({ model, domain });
}

/** Format a lookup ref for error messages. */
function fmtLookup(ref: LookupRef): string {
  return `lookup('${ref.model}', ${JSON.stringify(ref.domain)})`;
}

// ---------------------------------------------------------------------------
// resolveLookups
// ---------------------------------------------------------------------------

/**
 * Walk all resources, resolve external IDs and LookupRefs, then return
 * a ResolvedState with resolved IDs and field values.
 *
 * Resolution order for each resource (3-step fallback):
 * 1. External ID lookup via ir.model.data (if externalId is set)
 * 2. _ref lookup via searchRead (if _ref is set and step 1 didn't match)
 * 3. Create mode (if neither step found a match)
 *
 * When step 2 finds a record but step 1 didn't, the resource is marked
 * for "adoption" — the apply step will write the external ID to ir.model.data.
 */
export async function resolveLookups(
  resources: ResourceDefinition[],
  policies: ModelPolicy[],
  client: ResolveClient
): Promise<ResolvedState> {
  // -------------------------------------------------------------------------
  // Step 0: Validate — no duplicate external IDs
  // -------------------------------------------------------------------------

  const seenExternalIds = new Map<string, string>(); // externalId → model
  for (const res of resources) {
    if (res.externalId) {
      if (seenExternalIds.has(res.externalId)) {
        throw new Error(
          `Duplicate external ID '${res.externalId}' — already used by ${seenExternalIds.get(res.externalId)}`
        );
      }
      seenExternalIds.set(res.externalId, res.model);
    }
  }

  // -------------------------------------------------------------------------
  // Step 1: Batch-fetch all external ID records from ir.model.data
  // -------------------------------------------------------------------------

  // Group external IDs by module prefix for efficient batch fetching
  const moduleGroups = new Map<string, string[]>(); // module → [name, ...]
  for (const res of resources) {
    if (!res.externalId) continue;
    const { module, name } = parseExternalId(res.externalId);
    if (!moduleGroups.has(module)) moduleGroups.set(module, []);
    moduleGroups.get(module)!.push(name);
  }

  // Fetch all ir.model.data records for each module prefix
  // Result: externalId string → { res_id, model }
  const externalIdMap = new Map<string, { res_id: number; model: string }>();

  for (const [module, names] of moduleGroups) {
    debug('fetching ir.model.data for module=%s (%d names)', module, names.length);
    const records = await client.searchRead<{
      id: number;
      module: string;
      name: string;
      model: string;
      res_id: number;
    }>(
      'ir.model.data',
      [
        ['module', '=', module],
        ['name', 'in', names],
      ],
      {
        fields: ['module', 'name', 'model', 'res_id'],
      }
    );

    for (const rec of records) {
      const fullId = `${rec.module}.${rec.name}`;
      externalIdMap.set(fullId, { res_id: rec.res_id, model: rec.model });
    }
  }

  debug('external ID cache: %d entries', externalIdMap.size);

  // -------------------------------------------------------------------------
  // Step 2: Collect all _ref lookup pairs (for resources not resolved by external ID)
  // -------------------------------------------------------------------------

  const lookupMap = new Map<string, { model: string; domain: RawDomain }>();

  // We need to know which resources need _ref resolution
  // (those with externalId that wasn't found, or those without externalId)
  for (const res of resources) {
    // If external ID resolved, skip _ref collection
    if (res.externalId && externalIdMap.has(res.externalId)) {
      continue;
    }

    // Collect _ref lookup
    if (res.ref) {
      const raw = domainToTuples(res.ref.domain);
      const key = lookupKey(res.ref.model, raw);
      if (!lookupMap.has(key)) {
        lookupMap.set(key, { model: res.ref.model, domain: raw });
      }
    }

    // Collect field-level lookups
    for (const value of Object.values(res.values)) {
      if (isLookupRef(value)) {
        const raw = domainToTuples(value.domain);
        const key = lookupKey(value.model, raw);
        if (!lookupMap.has(key)) {
          lookupMap.set(key, { model: value.model, domain: raw });
        }
      }
    }
  }

  // Also collect field-level lookups from externally-resolved resources
  // (they still need field lookups resolved)
  for (const res of resources) {
    if (!(res.externalId && externalIdMap.has(res.externalId))) continue;
    for (const value of Object.values(res.values)) {
      if (isLookupRef(value)) {
        const raw = domainToTuples(value.domain);
        const key = lookupKey(value.model, raw);
        if (!lookupMap.has(key)) {
          lookupMap.set(key, { model: value.model, domain: raw });
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Step 3: Batch-fetch all _ref lookups
  // -------------------------------------------------------------------------

  const resultMap = new Map<string, Array<{ id: number; [k: string]: unknown }>>();

  for (const [key, { model, domain }] of lookupMap) {
    debug('searchRead %s %o', model, domain);
    const records = await client.searchRead<{ id: number }>(model, domain, { fields: ['id'] });
    resultMap.set(key, records as Array<{ id: number }>);
  }

  // -------------------------------------------------------------------------
  // Step 4: Build resolved resources (3-step fallback per resource)
  // -------------------------------------------------------------------------

  // Track resolved IDs by externalId so children can look up their parent's ID
  const resolvedByExternalId = new Map<string, number>();

  const resolvedResources: ResolvedResource[] = [];

  for (const res of resources) {
    let mode: 'create' | 'update' = 'create';
    let resolvedId: number | null = null;
    let needsAdoption = false;

    // --- Step 1: External ID resolution ---
    if (res.externalId) {
      const entry = externalIdMap.get(res.externalId);
      if (entry) {
        // Validate model matches
        if (entry.model !== res.model) {
          throw new Error(
            `External ID '${res.externalId}' points to ${entry.model} #${entry.res_id}, ` +
              `but resource declares model ${res.model}`
          );
        }
        mode = 'update';
        resolvedId = entry.res_id;
        debug('external ID %s → update id=%d', res.externalId, resolvedId);
      }
    }

    // --- Step 2: _ref fallback (only if external ID didn't resolve) ---
    if (resolvedId === null && res.ref) {
      // If child has parentScope, resolve the parent ID and augment the domain
      let scopedRef = res.ref;
      if (res.parentScope) {
        const parentId = resolveParentId(
          res.parentScope,
          externalIdMap,
          resolvedByExternalId,
          resultMap
        );
        if (parentId !== null) {
          const baseDomain = domainToTuples(res.ref.domain);
          const scopedDomain: RawDomain = [
            ...baseDomain,
            [res.parentScope.inverseField, '=', parentId],
          ];
          scopedRef = { __type: 'lookup' as const, model: res.ref.model, domain: scopedDomain };
          debug('scoped _ref to parent via %s=%d', res.parentScope.inverseField, parentId);
        } else {
          // Parent not found — child _ref can't be scoped, skip lookup entirely
          debug('parent not resolved — child _ref will fall through to create');
          scopedRef = null as any; // skip _ref resolution
        }
      }

      if (scopedRef) {
        const raw = domainToTuples(scopedRef.domain);
        const key = lookupKey(scopedRef.model, raw);

        // Scoped refs need fresh queries (not from the batch cache)
        let records: Array<{ id: number }>;
        if (res.parentScope) {
          debug('searchRead (scoped) %s %o', scopedRef.model, raw);
          records = await client.searchRead<{ id: number }>(scopedRef.model, raw, {
            fields: ['id'],
          });
        } else {
          records = (resultMap.get(key) ?? []) as Array<{ id: number }>;
        }

        if (records.length > 0) {
          mode = 'update';
          resolvedId = records[0].id;
          debug('_ref %s → update id=%d', fmtLookup(scopedRef), resolvedId);

          // If the resource has an externalId but it wasn't found in ir.model.data,
          // this record needs adoption (external ID will be written on apply)
          if (res.externalId) {
            needsAdoption = true;
            debug('will adopt external ID %s for id=%d', res.externalId, resolvedId);
          }
        } else {
          mode = 'create';
          debug('_ref %s → create (not found)', fmtLookup(scopedRef));
        }
      }
    }

    // --- Step 3: Create mode (no match found) ---
    // mode defaults to 'create' if neither step found anything

    // --- Resolve field-level lookups ---
    const resolvedValues: Record<string, unknown> = {};

    for (const [field, value] of Object.entries(res.values)) {
      if (isLookupRef(value)) {
        const raw = domainToTuples(value.domain);
        const key = lookupKey(value.model, raw);
        const records = resultMap.get(key) ?? [];

        if (records.length === 0) {
          throw new Error(
            `${fmtLookup(value)} found nothing — cannot resolve field '${field}' on ${res.model}`
          );
        }
        if (records.length > 1) {
          throw new Error(
            `${fmtLookup(value)} matched ${records.length} records, expected exactly 1 — field '${field}' on ${res.model}`
          );
        }

        resolvedValues[field] = records[0].id;
        debug('field %s.%s → id=%d', res.model, field, records[0].id);
      } else {
        resolvedValues[field] = value;
      }
    }

    // Track resolved ID by externalId so children can scope to this parent
    if (res.externalId && resolvedId !== null) {
      resolvedByExternalId.set(res.externalId, resolvedId);
    }

    resolvedResources.push({
      original: res,
      model: res.model,
      mode,
      resolvedId,
      resolvedValues,
      ...(res.externalId ? { externalId: res.externalId } : {}),
      ...(needsAdoption ? { needsAdoption: true } : {}),
    });
  }

  return { resources: resolvedResources, policies };
}

// ---------------------------------------------------------------------------
// Parent scope resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a parent's record ID from available sources.
 *
 * Tries in order:
 * 1. Parent's externalId in ir.model.data (from batch fetch)
 * 2. Parent's externalId from already-resolved resources (current pass)
 * 3. Parent's _ref from batch lookup cache
 */
function resolveParentId(
  scope: { parentExternalId?: string; parentRef?: LookupRef },
  externalIdMap: Map<string, { res_id: number; model: string }>,
  resolvedByExternalId: Map<string, number>,
  resultMap: Map<string, Array<{ id: number; [k: string]: unknown }>>
): number | null {
  // Try externalId first
  if (scope.parentExternalId) {
    const entry = externalIdMap.get(scope.parentExternalId);
    if (entry) return entry.res_id;

    const resolved = resolvedByExternalId.get(scope.parentExternalId);
    if (resolved !== undefined) return resolved;
  }

  // Try parent _ref from batch cache
  if (scope.parentRef) {
    const raw = domainToTuples(scope.parentRef.domain);
    const key = lookupKey(scope.parentRef.model, raw);
    const records = resultMap.get(key);
    if (records && records.length > 0) return records[0].id;
  }

  return null;
}
