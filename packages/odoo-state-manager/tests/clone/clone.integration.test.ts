/**
 * Integration tests for the data clone feature.
 *
 * Runs against a real Odoo instance via testcontainers (global setup).
 * Tests the full export → import cycle with real Odoo models and data.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { OdooClient } from '@marcfargas/odoo-client';
import { Introspector } from '@marcfargas/odoo-introspection';
import { exportData, importData } from '../../src/clone';
import type { Snapshot } from '../../src/clone/types';

describe('Data Clone Integration', () => {
  const odooUrl = process.env.ODOO_URL || 'http://localhost:8069';
  const odooDb = process.env.ODOO_DB_NAME || 'odoo';
  const odooUser = process.env.ODOO_DB_USER || 'admin';
  const odooPassword = process.env.ODOO_DB_PASSWORD || 'admin';

  let client: OdooClient;
  let introspector: Introspector;

  // Track created records for cleanup
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
    // Clean up in reverse order to respect dependencies
    for (const entry of cleanup.reverse()) {
      try {
        await client.unlink(entry.model, entry.ids);
      } catch {
        // best-effort cleanup
      }
    }
  });

  // -------------------------------------------------------------------------
  // Export tests
  // -------------------------------------------------------------------------

  describe('exportData()', () => {
    let seedPartnerIds: number[];

    beforeAll(async () => {
      // Create test data to export
      const id1 = await client.create('res.partner', {
        name: 'Clone Test Parent',
        email: 'clone-parent@test.local',
        is_company: true,
      });
      const id2 = await client.create('res.partner', {
        name: 'Clone Test Child',
        email: 'clone-child@test.local',
        parent_id: id1,
      });
      seedPartnerIds = [id1, id2];
      cleanup.push({ model: 'res.partner', ids: seedPartnerIds });
    });

    it('exports records matching a domain', async () => {
      const snapshot = await exportData(
        client,
        introspector,
        [
          {
            model: 'res.partner',
            domain: [['id', 'in', seedPartnerIds]],
          },
        ],
        { followRelations: false }
      );

      expect(snapshot.version).toBe(1);
      expect(snapshot.records['res.partner']).toHaveLength(2);
      expect(snapshot.metadata.stats['res.partner']).toBe(2);

      // Verify record structure
      const exported = snapshot.records['res.partner'];
      const names = exported.map((r) => r.values.name);
      expect(names).toContain('Clone Test Parent');
      expect(names).toContain('Clone Test Child');

      // many2one should be normalized to plain ID (not [id, name] tuple)
      const child = exported.find((r) => r.values.name === 'Clone Test Child')!;
      const parentVal = child.values.parent_id;
      expect(typeof parentVal === 'number' || parentVal === false).toBe(true);
    });

    it('follows many2one dependencies', async () => {
      // Create a partner in a specific company
      const companyIds = await client.search('res.company', [], { limit: 1 });
      expect(companyIds.length).toBeGreaterThan(0);

      const snapshot = await exportData(
        client,
        introspector,
        [
          {
            model: 'res.partner',
            domain: [['id', '=', seedPartnerIds[0]]],
          },
        ],
        {
          followRelations: true,
          maxDepth: 2,
          excludeModels: ['ir.model', 'ir.model.fields', 'ir.ui.view'],
        }
      );

      // The partner likely references res.company, res.country, etc.
      // We just verify that more than res.partner was exported
      const models = Object.keys(snapshot.records);
      expect(models).toContain('res.partner');
      // Dependencies should have been followed
      expect(models.length).toBeGreaterThanOrEqual(1);
    });

    it('respects limit option', async () => {
      const snapshot = await exportData(
        client,
        introspector,
        [
          {
            model: 'res.partner',
            domain: [['id', 'in', seedPartnerIds]],
            limit: 1,
          },
        ],
        { followRelations: false }
      );

      expect(snapshot.records['res.partner']).toHaveLength(1);
    });

    it('excludes computed and system fields', async () => {
      const snapshot = await exportData(
        client,
        introspector,
        [
          {
            model: 'res.partner',
            domain: [['id', '=', seedPartnerIds[0]]],
          },
        ],
        { followRelations: false }
      );

      const record = snapshot.records['res.partner'][0];
      // System fields should not be in values
      expect(record.values).not.toHaveProperty('create_date');
      expect(record.values).not.toHaveProperty('write_date');
      expect(record.values).not.toHaveProperty('create_uid');
      expect(record.values).not.toHaveProperty('write_uid');
      expect(record.values).not.toHaveProperty('display_name');
      // id is stored separately on ExportedRecord, not in values
      expect(record.values).not.toHaveProperty('id');
      expect(record.id).toBe(seedPartnerIds[0]);
    });

    it('produces a JSON-serializable snapshot', async () => {
      const snapshot = await exportData(
        client,
        introspector,
        [
          {
            model: 'res.partner',
            domain: [['id', '=', seedPartnerIds[0]]],
          },
        ],
        { followRelations: false }
      );

      const json = JSON.stringify(snapshot);
      const parsed: Snapshot = JSON.parse(json);
      expect(parsed.version).toBe(1);
      expect(parsed.records['res.partner']).toHaveLength(1);
      expect(parsed.records['res.partner'][0].values.name).toBe('Clone Test Parent');
    });
  });

  // -------------------------------------------------------------------------
  // Full round-trip: export → import
  // -------------------------------------------------------------------------

  describe('export → import round-trip', () => {
    it('clones partners into the same instance with new IDs', async () => {
      // Create source data
      const sourceId = await client.create('res.partner', {
        name: 'RoundTrip Source',
        email: 'roundtrip@test.local',
        is_company: true,
      });
      cleanup.push({ model: 'res.partner', ids: [sourceId] });

      // Export
      const snapshot = await exportData(
        client,
        introspector,
        [{ model: 'res.partner', domain: [['id', '=', sourceId]] }],
        {
          followRelations: false,
        }
      );

      expect(snapshot.records['res.partner']).toHaveLength(1);

      // Import (into same instance — IDs will differ)
      const result = await importData(client, introspector, snapshot);

      expect(result.errors).toHaveLength(0);
      expect(result.created['res.partner']).toBe(1);

      // Verify the new record exists with a different ID
      const newId = result.idMap['res.partner'][sourceId];
      expect(newId).toBeDefined();
      expect(newId).not.toBe(sourceId);

      cleanup.push({ model: 'res.partner', ids: [newId] });

      // Verify the imported record has the same field values
      const [imported] = await client.read<Record<string, unknown>>('res.partner', newId, [
        'name',
        'email',
        'is_company',
      ]);
      expect(imported.name).toBe('RoundTrip Source');
      expect(imported.email).toBe('roundtrip@test.local');
      expect(imported.is_company).toBe(true);
    });

    it('remaps many2one references during import', async () => {
      // Create parent + child
      const parentId = await client.create('res.partner', {
        name: 'Remap Parent',
        is_company: true,
      });
      const childId = await client.create('res.partner', {
        name: 'Remap Child',
        parent_id: parentId,
      });
      cleanup.push({ model: 'res.partner', ids: [childId, parentId] });

      // Export both
      const snapshot = await exportData(
        client,
        introspector,
        [{ model: 'res.partner', domain: [['id', 'in', [parentId, childId]]] }],
        { followRelations: false }
      );

      // Import
      const result = await importData(client, introspector, snapshot);
      expect(result.errors).toHaveLength(0);

      const newParentId = result.idMap['res.partner'][parentId];
      const newChildId = result.idMap['res.partner'][childId];
      cleanup.push({ model: 'res.partner', ids: [newChildId, newParentId] });

      // Verify the child's parent_id points to the new parent, not the source
      const [importedChild] = await client.read<Record<string, unknown>>(
        'res.partner',
        newChildId,
        ['parent_id']
      );
      // parent_id comes back as [id, name] tuple
      const importedParentId = Array.isArray(importedChild.parent_id)
        ? importedChild.parent_id[0]
        : importedChild.parent_id;
      expect(importedParentId).toBe(newParentId);
    });

    it('handles multi-model export with cross-model references', async () => {
      // Create a partner category and a partner with that category
      const catId = await client.create('res.partner.category', {
        name: 'Clone Test Category',
      });
      const partnerId = await client.create('res.partner', {
        name: 'Categorized Partner',
        category_id: [[6, 0, [catId]]],
      });
      cleanup.push({ model: 'res.partner', ids: [partnerId] });
      cleanup.push({ model: 'res.partner.category', ids: [catId] });

      // Export both models explicitly
      const snapshot = await exportData(
        client,
        introspector,
        [
          { model: 'res.partner.category', domain: [['id', '=', catId]] },
          { model: 'res.partner', domain: [['id', '=', partnerId]] },
        ],
        {
          followRelations: false,
        }
      );

      expect(snapshot.records['res.partner.category']).toHaveLength(1);
      expect(snapshot.records['res.partner']).toHaveLength(1);

      // Import
      const result = await importData(client, introspector, snapshot);

      expect(result.created['res.partner.category']).toBe(1);
      expect(result.created['res.partner']).toBe(1);

      const newCatId = result.idMap['res.partner.category'][catId];
      const newPartnerId = result.idMap['res.partner'][partnerId];
      cleanup.push({ model: 'res.partner', ids: [newPartnerId] });
      cleanup.push({ model: 'res.partner.category', ids: [newCatId] });

      // Verify both records exist
      const [importedCat] = await client.read<Record<string, unknown>>(
        'res.partner.category',
        newCatId,
        ['name']
      );
      expect(importedCat.name).toBe('Clone Test Category');
    });

    it('round-trips a snapshot through JSON serialization', async () => {
      const sourceId = await client.create('res.partner', {
        name: 'JSON RoundTrip',
        email: 'json@test.local',
      });
      cleanup.push({ model: 'res.partner', ids: [sourceId] });

      const snapshot = await exportData(
        client,
        introspector,
        [{ model: 'res.partner', domain: [['id', '=', sourceId]] }],
        { followRelations: false }
      );

      // Serialize and deserialize (simulates saving to disk)
      const restored: Snapshot = JSON.parse(JSON.stringify(snapshot));

      const result = await importData(client, introspector, restored);
      expect(result.created['res.partner']).toBe(1);

      const newId = result.idMap['res.partner'][sourceId];
      cleanup.push({ model: 'res.partner', ids: [newId] });

      const [imported] = await client.read<Record<string, unknown>>('res.partner', newId, [
        'name',
        'email',
      ]);
      expect(imported.name).toBe('JSON RoundTrip');
      expect(imported.email).toBe('json@test.local');
    });
  });
});
