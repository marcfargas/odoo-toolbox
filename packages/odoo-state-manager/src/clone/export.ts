/**
 * Data export — pull records from a source Odoo instance with transitive
 * many2one dependency resolution.
 *
 * The exporter performs a breadth-first crawl: starting from the user's
 * domain specs, it fetches records, discovers many2one references, and
 * queues referenced records for the next depth level. Each (model, id)
 * pair is fetched at most once.
 */

import createDebug from 'debug';
import type { OdooClient } from '@marcfargas/odoo-client';
import type { Introspector, OdooField } from '@marcfargas/odoo-introspection';

import type { DataDomain, ExportOptions, Snapshot, ExportedRecord } from './types';
import { getExportableFields, extractMany2oneRefs, normalizeRecord } from './fields';

const debug = createDebug('odoo-state-manager:clone:export');

/**
 * Export records from a source Odoo instance.
 *
 * Fetches records matching the given domain specs, optionally following
 * many2one references transitively to capture dependencies.
 *
 * @param client - OdooClient connected to the source instance
 * @param introspector - Introspector for the source instance
 * @param domains - What data to export
 * @param options - Export options
 * @returns A serializable snapshot of the exported data
 */
export async function exportData(
  client: OdooClient,
  introspector: Introspector,
  domains: DataDomain[],
  options: ExportOptions = {}
): Promise<Snapshot> {
  const {
    followRelations = true,
    maxDepth = 5,
    excludeModels = [],
    excludeFields = [],
    includeBinaryFields = false,
  } = options;

  const excludeModelSet = new Set(excludeModels);

  // Per-model caches
  const fieldCache = new Map<string, OdooField[]>();
  const exportableFieldCache = new Map<string, string[]>();

  // Deduplication: track which (model, id) pairs we've already fetched
  const seen = new Map<string, Set<number>>();

  // Result: model → ExportedRecord[]
  const records: Record<string, ExportedRecord[]> = {};

  /** Get (and cache) fields for a model */
  async function getFields(model: string): Promise<OdooField[]> {
    let fields = fieldCache.get(model);
    if (!fields) {
      fields = await introspector.getFields(model);
      fieldCache.set(model, fields);
    }
    return fields;
  }

  /** Get (and cache) exportable field names for a model */
  async function getExportFields(model: string): Promise<string[]> {
    let names = exportableFieldCache.get(model);
    if (!names) {
      const fields = await getFields(model);
      names = getExportableFields(fields, { excludeFields, includeBinaryFields });
      exportableFieldCache.set(model, names);
    }
    return names;
  }

  /** Mark an id as seen; returns true if it was new */
  function markSeen(model: string, id: number): boolean {
    let set = seen.get(model);
    if (!set) {
      set = new Set();
      seen.set(model, set);
    }
    if (set.has(id)) return false;
    set.add(id);
    return true;
  }

  /** Add an exported record to the result */
  function addRecord(model: string, rec: ExportedRecord): void {
    if (!records[model]) {
      records[model] = [];
    }
    records[model].push(rec);
  }

  // -------------------------------------------------------------------------
  // Phase 1: Fetch root records from domain specs
  // -------------------------------------------------------------------------

  // Queue for BFS dependency resolution: [{ model, ids }, ...]
  // Each entry is a batch of IDs to fetch at the next depth level
  let pendingRefs: Array<{ model: string; id: number }> = [];

  for (const spec of domains) {
    if (excludeModelSet.has(spec.model)) {
      debug('skipping excluded model %s', spec.model);
      continue;
    }

    const fieldNames = await getExportFields(spec.model);
    const fields = await getFields(spec.model);

    debug('fetching %s with domain %o (limit: %s)', spec.model, spec.domain, spec.limit ?? 'none');

    const rawRecords = await client.searchRead<Record<string, unknown>>(spec.model, spec.domain, {
      fields: fieldNames,
      limit: spec.limit,
    });

    debug('fetched %d records from %s', rawRecords.length, spec.model);

    for (const raw of rawRecords) {
      const id = raw.id as number;
      if (!markSeen(spec.model, id)) continue;

      const normalized = normalizeRecord(raw, fields);
      delete normalized.id; // stored separately in ExportedRecord
      addRecord(spec.model, { id, values: normalized });

      // Queue many2one references for dependency resolution
      if (followRelations) {
        const refs = extractMany2oneRefs(raw, fields);
        for (const ref of refs) {
          if (!excludeModelSet.has(ref.model) && markSeen(ref.model, ref.id)) {
            pendingRefs.push(ref);
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Phase 2: BFS dependency resolution
  // -------------------------------------------------------------------------

  for (let depth = 1; depth <= maxDepth && pendingRefs.length > 0; depth++) {
    debug('dependency resolution depth %d: %d pending refs', depth, pendingRefs.length);

    // Group pending refs by model for batch fetching
    const byModel = new Map<string, number[]>();
    for (const ref of pendingRefs) {
      let ids = byModel.get(ref.model);
      if (!ids) {
        ids = [];
        byModel.set(ref.model, ids);
      }
      ids.push(ref.id);
    }

    const nextPending: Array<{ model: string; id: number }> = [];

    for (const [model, ids] of byModel) {
      const fieldNames = await getExportFields(model);
      const fields = await getFields(model);

      debug('fetching %d dependency records from %s', ids.length, model);

      const rawRecords = await client.read<Record<string, unknown>>(model, ids, fieldNames);

      for (const raw of rawRecords) {
        const id = raw.id as number;

        const normalized = normalizeRecord(raw, fields);
        delete normalized.id;
        addRecord(model, { id, values: normalized });

        // Discover next level of dependencies
        if (followRelations) {
          const refs = extractMany2oneRefs(raw, fields);
          for (const ref of refs) {
            if (!excludeModelSet.has(ref.model) && markSeen(ref.model, ref.id)) {
              nextPending.push(ref);
            }
          }
        }
      }
    }

    pendingRefs = nextPending;
  }

  if (pendingRefs.length > 0) {
    debug(
      'maxDepth %d reached with %d unresolved refs — these will be nulled on import',
      maxDepth,
      pendingRefs.length
    );
  }

  // -------------------------------------------------------------------------
  // Build snapshot
  // -------------------------------------------------------------------------

  const stats: Record<string, number> = {};
  for (const [model, recs] of Object.entries(records)) {
    stats[model] = recs.length;
  }

  const snapshot: Snapshot = {
    version: 1,
    records,
    metadata: {
      exportedAt: new Date().toISOString(),
      domainSpecs: domains,
      stats,
    },
  };

  debug('export complete: %o', stats);
  return snapshot;
}
