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
 * Walk all resources, collect every LookupRef, batch-fetch via searchRead,
 * then return a ResolvedState with resolved IDs and field values.
 */
export async function resolveLookups(
  resources: ResourceDefinition[],
  policies: ModelPolicy[],
  client: ResolveClient
): Promise<ResolvedState> {
  // -------------------------------------------------------------------------
  // Step 1: Collect all unique (model, domain) lookup pairs
  // -------------------------------------------------------------------------

  // Map from key → { model, rawDomain }
  const lookupMap = new Map<string, { model: string; domain: RawDomain }>();

  for (const res of resources) {
    // Check _ref
    if (res.ref) {
      const raw = domainToTuples(res.ref.domain);
      const key = lookupKey(res.ref.model, raw);
      if (!lookupMap.has(key)) {
        lookupMap.set(key, { model: res.ref.model, domain: raw });
      }
    }

    // Check field values
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
  // Step 2: Batch-fetch all unique lookups
  // -------------------------------------------------------------------------

  // Map from key → fetched records[]
  const resultMap = new Map<string, Array<{ id: number; [k: string]: unknown }>>();

  for (const [key, { model, domain }] of lookupMap) {
    debug('searchRead %s %o', model, domain);
    const records = await client.searchRead<{ id: number }>(model, domain, { fields: ['id'] });
    resultMap.set(key, records as Array<{ id: number }>);
  }

  // -------------------------------------------------------------------------
  // Step 3: Build resolved resources
  // -------------------------------------------------------------------------

  const resolvedResources: ResolvedResource[] = [];

  for (const res of resources) {
    // -- Resolve _ref → mode & resolvedId
    let mode: 'create' | 'update' = 'create';
    let resolvedId: number | null = null;

    if (res.ref) {
      const raw = domainToTuples(res.ref.domain);
      const key = lookupKey(res.ref.model, raw);
      const records = resultMap.get(key) ?? [];
      if (records.length > 0) {
        mode = 'update';
        resolvedId = records[0].id;
        debug('_ref %s → update id=%d', fmtLookup(res.ref), resolvedId);
      } else {
        mode = 'create';
        debug('_ref %s → create (not found)', fmtLookup(res.ref));
      }
    }

    // -- Resolve field-level lookups
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

    resolvedResources.push({
      original: res,
      model: res.model,
      mode,
      resolvedId,
      resolvedValues,
    });
  }

  return { resources: resolvedResources, policies };
}
