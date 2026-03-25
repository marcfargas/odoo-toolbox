/**
 * Integration tests for external ID support.
 *
 * Tests the full resolution → plan → apply cycle with external IDs
 * against a real Odoo instance via testcontainers.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { OdooClient } from '@marcfargas/odoo-client';
import { Introspector } from '@marcfargas/odoo-introspection';
import { resource } from '../../src/dsl/resource';
import { lookup } from '../../src/dsl/lookup';
import { resolveLookups } from '../../src/engine/resolve';
import { diffResources } from '../../src/engine/diff';
import { generatePlan } from '../../src/engine/plan';
import { applyPlan } from '../../src/engine/apply';
import { buildDependencyGraph } from '../../src/engine/introspect';

describe('External ID Integration', () => {
  const odooUrl = process.env.ODOO_URL || 'http://localhost:8069';
  const odooDb = process.env.ODOO_DB_NAME || 'odoo';
  const odooUser = process.env.ODOO_DB_USER || 'admin';
  const odooPassword = process.env.ODOO_DB_PASSWORD || 'admin';

  let client: OdooClient;
  let introspector: Introspector;

  // Track records for cleanup
  const cleanup: Array<{ model: string; ids: number[] }> = [];

  beforeAll(async () => {
    client = new OdooClient({
      url: odooUrl,
      database: odooDb,
      username: odooUser,
      password: odooPassword,
    });
    await client.authenticate();
    introspector = new Introspector(client);
  });

  afterAll(async () => {
    // Clean up ir.model.data entries first, then records
    for (const entry of cleanup.reverse()) {
      try {
        if (entry.model === 'ir.model.data') {
          await client.unlink('ir.model.data', entry.ids);
        }
      } catch {
        // best-effort
      }
    }
    for (const entry of cleanup.reverse()) {
      try {
        if (entry.model !== 'ir.model.data') {
          await client.unlink(entry.model, entry.ids);
        }
      } catch {
        // best-effort
      }
    }
  });

  it('creates a record with external ID and writes ir.model.data', async () => {
    const extId = `__test__.extid_create_${Date.now()}`;
    const res = resource('res.partner.category', extId, {
      name: `ExtID Test Category ${Date.now()}`,
    });

    // Resolve
    const resolved = await resolveLookups([res], [], client as any);
    expect(resolved.resources[0].mode).toBe('create');
    expect(resolved.resources[0].externalId).toBe(extId);

    // Diff
    const diffs = await diffResources(resolved, client as any, introspector);
    expect(diffs[0].hasChanges).toBe(true);

    // Plan
    const models = ['res.partner.category'];
    const depGraph = await buildDependencyGraph(models, introspector);
    const plan = generatePlan(diffs, depGraph, resolved, []);

    expect(plan.summary.creates).toBe(1);

    // Apply
    const result = await applyPlan(plan, client as any);
    expect(result.succeeded).toBeGreaterThan(0);

    // Find the created record ID
    const createResult = result.results.find(
      (r) => r.operation.type === 'create' && r.operation.model === 'res.partner.category'
    );
    expect(createResult).toBeDefined();
    const newId = createResult!.id!;
    cleanup.push({ model: 'res.partner.category', ids: [newId] });

    // Verify ir.model.data entry was written
    const { module, name } = parseExtId(extId);
    const irEntries = await client.searchRead<{ id: number; res_id: number }>(
      'ir.model.data',
      [
        ['module', '=', module],
        ['name', '=', name],
      ],
      { fields: ['res_id'] }
    );
    expect(irEntries).toHaveLength(1);
    expect(irEntries[0].res_id).toBe(newId);
    cleanup.push({ model: 'ir.model.data', ids: [irEntries[0].id] });
  });

  it('resolves existing record via external ID on second run', async () => {
    const extId = `__test__.extid_resolve_${Date.now()}`;
    const categoryName = `ExtID Resolve Test ${Date.now()}`;

    // First run: create
    const res1 = resource('res.partner.category', extId, { name: categoryName });
    const resolved1 = await resolveLookups([res1], [], client as any);
    const diffs1 = await diffResources(resolved1, client as any, introspector);
    const depGraph = await buildDependencyGraph(['res.partner.category'], introspector);
    const plan1 = generatePlan(diffs1, depGraph, resolved1, []);
    const result1 = await applyPlan(plan1, client as any);

    const createResult = result1.results.find(
      (r) => r.operation.type === 'create' && r.operation.model === 'res.partner.category'
    );
    const createdId = createResult!.id!;
    cleanup.push({ model: 'res.partner.category', ids: [createdId] });

    // Clean up ir.model.data later
    const { module, name } = parseExtId(extId);
    const irEntries = await client.searchRead<{ id: number }>('ir.model.data', [
      ['module', '=', module],
      ['name', '=', name],
    ]);
    cleanup.push({ model: 'ir.model.data', ids: [irEntries[0].id] });

    // Second run: should resolve via external ID (update mode, no changes)
    const res2 = resource('res.partner.category', extId, { name: categoryName });
    const resolved2 = await resolveLookups([res2], [], client as any);

    expect(resolved2.resources[0].mode).toBe('update');
    expect(resolved2.resources[0].resolvedId).toBe(createdId);
    expect(resolved2.resources[0].needsAdoption).toBeFalsy();

    // Diff should show no changes
    const diffs2 = await diffResources(resolved2, client as any, introspector);
    expect(diffs2[0].hasChanges).toBe(false);
  });

  it('adopts existing record when _ref matches but external ID missing', async () => {
    // Create a record manually (no external ID)
    const categoryName = `ExtID Adopt Test ${Date.now()}`;
    const manualId = await client.create('res.partner.category', { name: categoryName });
    cleanup.push({ model: 'res.partner.category', ids: [manualId] });

    const extId = `__test__.extid_adopt_${Date.now()}`;

    // Define resource with both externalId and _ref
    const res = resource('res.partner.category', extId, {
      _ref: lookup('res.partner.category', { name: categoryName }),
      name: categoryName,
    });

    // Resolve: should find via _ref and mark for adoption
    const resolved = await resolveLookups([res], [], client as any);
    expect(resolved.resources[0].mode).toBe('update');
    expect(resolved.resources[0].resolvedId).toBe(manualId);
    expect(resolved.resources[0].needsAdoption).toBe(true);

    // Plan should include an adopt operation
    const diffs = await diffResources(resolved, client as any, introspector);
    const depGraph = await buildDependencyGraph(['res.partner.category'], introspector);
    const plan = generatePlan(diffs, depGraph, resolved, []);

    const adoptOps = plan.operations.filter((op) => op.type === 'adopt');
    expect(adoptOps).toHaveLength(1);
    expect(adoptOps[0].externalId).toBe(extId);

    // Apply the adopt
    const result = await applyPlan(plan, client as any);
    expect(result.succeeded).toBeGreaterThan(0);

    // Verify ir.model.data was written
    const { module, name } = parseExtId(extId);
    const irEntries = await client.searchRead<{ id: number; res_id: number }>(
      'ir.model.data',
      [
        ['module', '=', module],
        ['name', '=', name],
      ],
      { fields: ['res_id'] }
    );
    expect(irEntries).toHaveLength(1);
    expect(irEntries[0].res_id).toBe(manualId);
    cleanup.push({ model: 'ir.model.data', ids: [irEntries[0].id] });

    // Third run: should now resolve via external ID (no adoption needed)
    const res3 = resource('res.partner.category', extId, { name: categoryName });
    const resolved3 = await resolveLookups([res3], [], client as any);
    expect(resolved3.resources[0].mode).toBe('update');
    expect(resolved3.resources[0].resolvedId).toBe(manualId);
    expect(resolved3.resources[0].needsAdoption).toBeFalsy();
  });
});

function parseExtId(extId: string): { module: string; name: string } {
  const dot = extId.indexOf('.');
  return { module: extId.substring(0, dot), name: extId.substring(dot + 1) };
}
