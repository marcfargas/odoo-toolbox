/**
 * Data import — replay exported records into a target Odoo instance.
 *
 * Records are created in topological order (dependencies first) with
 * many2one foreign keys remapped from source IDs to newly created target IDs.
 *
 * Self-referential many2one fields (e.g., partner.parent_id, task.parent_id)
 * are handled with a two-pass approach: create with the field nulled, then
 * update in a second pass once all records of that model exist.
 */

import createDebug from 'debug';
import type { OdooClient } from '@marcfargas/odoo-client';
import type { Introspector, OdooField } from '@marcfargas/odoo-introspection';

import { buildDependencyGraph, topologicalSort } from '../engine/introspect';
import type { Snapshot, ImportOptions, ImportResult, ExportedRecord } from './types';
import { getSelfReferentialFields, normalizeMany2oneId } from './fields';

const debug = createDebug('odoo-state-manager:clone:import');

/**
 * Import a snapshot into a target Odoo instance.
 *
 * @param client - OdooClient connected to the target instance
 * @param introspector - Introspector for the target instance
 * @param snapshot - Previously exported snapshot
 * @param options - Import options
 * @returns Import result with ID mappings and stats
 */
export async function importData(
  client: OdooClient,
  introspector: Introspector,
  snapshot: Snapshot,
  options: ImportOptions = {}
): Promise<ImportResult> {
  const { onConflict = 'skip' } = options;

  const models = Object.keys(snapshot.records);
  if (models.length === 0) {
    return { idMap: {}, created: {}, skipped: {}, errors: [] };
  }

  // Build dependency graph and sort
  const graph = await buildDependencyGraph(models, introspector);
  const sorted = topologicalSort(graph);

  // Include models that weren't in the graph (no many2one deps discovered)
  const sortedSet = new Set(sorted);
  for (const model of models) {
    if (!sortedSet.has(model)) {
      sorted.push(model);
    }
  }

  debug('import order: %o', sorted);

  // Per-model field metadata cache
  const fieldCache = new Map<string, OdooField[]>();
  async function getFields(model: string): Promise<OdooField[]> {
    let fields = fieldCache.get(model);
    if (!fields) {
      fields = await introspector.getFields(model);
      fieldCache.set(model, fields);
    }
    return fields;
  }

  // State
  const idMap: Record<string, Record<number, number>> = {};
  const created: Record<string, number> = {};
  const skipped: Record<string, number> = {};
  const errors: ImportResult['errors'] = [];

  // Deferred self-ref updates: { model, targetId, field, sourceRefId }
  const deferredUpdates: Array<{
    model: string;
    targetId: number;
    updates: Record<string, number>;
  }> = [];

  // -------------------------------------------------------------------------
  // Phase 1: Create records in topological order
  // -------------------------------------------------------------------------

  for (const model of sorted) {
    const records = snapshot.records[model];
    if (!records || records.length === 0) continue;

    const fields = await getFields(model);
    const selfRefFields = getSelfReferentialFields(model, fields);
    const m2oFields = fields.filter((f) => f.ttype === 'many2one' && f.relation);

    debug(
      'importing %d records into %s (self-ref fields: %o)',
      records.length,
      model,
      selfRefFields
    );

    idMap[model] = {};
    created[model] = 0;
    skipped[model] = 0;

    for (const record of records) {
      try {
        const values = remapValues(record.values, m2oFields, selfRefFields, idMap);
        const deferredFields = extractDeferredSelfRefs(record, selfRefFields, idMap, model);

        const newId = await client.create(model, values);
        idMap[model][record.id] = newId;
        created[model]++;

        // Queue self-ref updates for phase 2
        if (Object.keys(deferredFields).length > 0) {
          deferredUpdates.push({ model, targetId: newId, updates: deferredFields });
        }

        debug('created %s #%d → #%d', model, record.id, newId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        debug('failed to create %s #%d: %s', model, record.id, message);

        if (onConflict === 'error') {
          throw new Error(`Failed to import ${model} #${record.id}: ${message}`);
        }

        errors.push({ model, sourceId: record.id, error: message });
        skipped[model]++;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Phase 2: Patch self-referential fields
  // -------------------------------------------------------------------------

  if (deferredUpdates.length > 0) {
    debug('patching %d deferred self-referential updates', deferredUpdates.length);

    for (const { model, targetId, updates } of deferredUpdates) {
      // Remap the deferred source IDs to target IDs
      const remapped: Record<string, number | false> = {};
      for (const [field, sourceId] of Object.entries(updates)) {
        const targetRefId = idMap[model]?.[sourceId];
        remapped[field] = targetRefId ?? false;
      }

      try {
        await client.write(model, targetId, remapped);
        debug('patched %s #%d self-refs: %o', model, targetId, remapped);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        debug('failed to patch %s #%d: %s', model, targetId, message);
        errors.push({ model, sourceId: targetId, error: `self-ref patch: ${message}` });
      }
    }
  }

  debug('import complete: created=%o, skipped=%o, errors=%d', created, skipped, errors.length);

  return { idMap, created, skipped, errors };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Remap many2one values in a record from source IDs to target IDs.
 * Self-referential fields are nulled out (handled in phase 2).
 */
function remapValues(
  values: Record<string, unknown>,
  m2oFields: OdooField[],
  selfRefFields: string[],
  idMap: Record<string, Record<number, number>>
): Record<string, unknown> {
  const selfRefSet = new Set(selfRefFields);
  const result: Record<string, unknown> = { ...values };

  for (const field of m2oFields) {
    const value = result[field.name];
    if (value === undefined) continue;

    // Null out self-referential fields (phase 2)
    if (selfRefSet.has(field.name)) {
      result[field.name] = false;
      continue;
    }

    // Remap to target ID
    const sourceId = normalizeMany2oneId(value);
    if (sourceId !== null && field.relation) {
      const targetId = idMap[field.relation]?.[sourceId];
      // If we have a mapping, use it. If not, the referenced record wasn't
      // exported — null out the field to avoid referencing a nonexistent ID.
      result[field.name] = targetId ?? false;
    }
  }

  return result;
}

/**
 * Extract self-referential field values that need deferred update.
 * Returns a map of field name → source ID (to be remapped after all
 * records of this model are created).
 */
function extractDeferredSelfRefs(
  record: ExportedRecord,
  selfRefFields: string[],
  _idMap: Record<string, Record<number, number>>,
  _model: string
): Record<string, number> {
  const deferred: Record<string, number> = {};

  for (const fieldName of selfRefFields) {
    const value = record.values[fieldName];
    const sourceId = normalizeMany2oneId(value);
    if (sourceId !== null) {
      deferred[fieldName] = sourceId;
    }
  }

  return deferred;
}
