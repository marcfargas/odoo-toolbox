/**
 * Meta-Skills Documentation Tests: 04-patterns/
 *
 * These tests validate that the code examples in the meta-skills documentation
 * actually work against a real Odoo instance.
 *
 * Philosophy: "If the code examples work correctly, the documentation is correct."
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { OdooClient, ModuleManager } from '@odoo-toolbox/client';
import {
  PropertiesDefinition,
  PropertiesWriteFormat,
  getPropertyValue,
  propertiesToWriteFormat,
} from '@odoo-toolbox/client';
import {
  getTestConfig,
  uniqueTestName,
  cleanupTestRecords,
} from '../../../tests/helpers/odoo-instance';

describe('Meta-Skills: 04-patterns/', () => {
  let client: OdooClient;
  let moduleManager: ModuleManager;
  const createdRecords: Array<{ model: string; id: number }> = [];

  beforeAll(async () => {
    const config = getTestConfig();
    client = new OdooClient({
      url: config.url,
      database: config.database,
      username: config.username,
      password: config.password,
    });

    await client.authenticate();
    moduleManager = new ModuleManager(client);
  }, 30000);

  afterAll(async () => {
    // Cleanup created records in reverse order
    for (const { model, id } of createdRecords.reverse()) {
      try {
        await client.unlink(model, id);
      } catch {
        // Ignore cleanup errors
      }
    }
    await client.logout();
  });

  describe('crud-operations.md', () => {
    describe('Create patterns', () => {
      it('should create a record with required fields', async () => {
        // Pattern from crud-operations.md: Basic create
        const id = await client.create('res.partner', {
          name: uniqueTestName('Meta-Skills Test Partner'),
        });

        expect(id).toBeGreaterThan(0);
        createdRecords.push({ model: 'res.partner', id });
      });

      it('should create with Many2One relation (pass just the ID)', async () => {
        // Pattern from crud-operations.md: Create with relations
        // Many2One: Pass just the ID
        const parentId = await client.create('res.partner', {
          name: uniqueTestName('Parent Company'),
          is_company: true,
        });
        createdRecords.push({ model: 'res.partner', id: parentId });

        const childId = await client.create('res.partner', {
          name: uniqueTestName('Child Contact'),
          parent_id: parentId, // Just the ID, not [id, name]
        });
        createdRecords.push({ model: 'res.partner', id: childId });

        // Verify the relation was created
        const [child] = await client.read('res.partner', [childId], [
          'parent_id',
        ]);
        expect(child.parent_id).toBeDefined();
        expect(child.parent_id[0]).toBe(parentId); // Read returns [id, name]
      });
    });

    describe('Read patterns', () => {
      it('should read relational fields as [id, name] tuples', async () => {
        // Pattern from crud-operations.md: Reading relational fields
        // Many2One returns [id, display_name] or false
        const partnerId = await client.create('res.partner', {
          name: uniqueTestName('Partner with Company'),
          is_company: true,
        });
        createdRecords.push({ model: 'res.partner', id: partnerId });

        const [partner] = await client.read('res.partner', [partnerId], [
          'name',
          'company_id',
        ]);

        // company_id is Many2One - should be [id, name] or false
        if (partner.company_id) {
          expect(Array.isArray(partner.company_id)).toBe(true);
          expect(partner.company_id.length).toBe(2);
        }
      });
    });

    describe('Update patterns', () => {
      it('should update using safe read-modify-write pattern', async () => {
        // Pattern from crud-operations.md: Safe update pattern
        const partnerId = await client.create('res.partner', {
          name: uniqueTestName('Partner for Update'),
          phone: '123-456-7890',
        });
        createdRecords.push({ model: 'res.partner', id: partnerId });

        // Read current values
        const [record] = await client.read('res.partner', [partnerId], [
          'name',
          'phone',
        ]);

        // Modify and write
        await client.write('res.partner', partnerId, {
          phone: '999-888-7777',
        });

        // Verify
        const [updated] = await client.read('res.partner', [partnerId], [
          'phone',
        ]);
        expect(updated.phone).toBe('999-888-7777');
      });
    });

    describe('Upsert pattern', () => {
      it('should implement upsert (create or update)', async () => {
        // Pattern from crud-operations.md: Upsert pattern
        async function upsert(
          model: string,
          domain: any[],
          values: Record<string, any>
        ): Promise<{ id: number; created: boolean }> {
          const existing = await client.search(model, domain, { limit: 1 });

          if (existing.length > 0) {
            await client.write(model, existing[0], values);
            return { id: existing[0], created: false };
          } else {
            const id = await client.create(model, values);
            return { id, created: true };
          }
        }

        const testEmail = `upsert_test_${Date.now()}@example.com`;

        // First call creates
        const result1 = await upsert(
          'res.partner',
          [['email', '=', testEmail]],
          { name: 'Upsert Test', email: testEmail, phone: '111' }
        );
        expect(result1.created).toBe(true);
        createdRecords.push({ model: 'res.partner', id: result1.id });

        // Second call updates
        const result2 = await upsert(
          'res.partner',
          [['email', '=', testEmail]],
          { name: 'Upsert Test Updated', email: testEmail, phone: '222' }
        );
        expect(result2.created).toBe(false);
        expect(result2.id).toBe(result1.id);

        // Verify update
        const [partner] = await client.read('res.partner', [result1.id], [
          'phone',
        ]);
        expect(partner.phone).toBe('222');
      });
    });

    describe('Delete patterns', () => {
      it('should delete a record', async () => {
        // Pattern from crud-operations.md: Basic delete
        const id = await client.create('res.partner', {
          name: uniqueTestName('Partner to Delete'),
        });

        await client.unlink('res.partner', id);

        // Verify deletion
        const results = await client.search('res.partner', [['id', '=', id]], { limit: 1 });
        expect(results.length).toBe(0);
      });
    });
  });

  describe('search-patterns.md', () => {
    let testPartnerIds: number[] = [];

    beforeAll(async () => {
      // Create test data for search tests
      for (let i = 0; i < 5; i++) {
        const id = await client.create('res.partner', {
          name: uniqueTestName(`Search Test Partner ${i}`),
          email: `search_test_${Date.now()}_${i}@example.com`,
        });
        testPartnerIds.push(id);
        createdRecords.push({ model: 'res.partner', id });
      }
    });

    describe('searchRead patterns', () => {
      it('should use searchRead with fields, limit, and order', async () => {
        // Pattern from search-patterns.md: searchRead with options
        const partners = await client.searchRead(
          'res.partner',
          [['name', 'ilike', 'Search Test Partner']],
          {
            fields: ['name', 'email'],
            limit: 10,
            offset: 0,
            order: 'name asc',
          }
        );

        expect(partners.length).toBeGreaterThan(0);
        expect(partners[0]).toHaveProperty('name');
        expect(partners[0]).toHaveProperty('email');
      });
    });

    describe('Pagination patterns', () => {
      it('should paginate through results', async () => {
        // Pattern from search-patterns.md: Pagination
        const pageSize = 2;
        let offset = 0;
        let allRecords: any[] = [];

        // First page
        const page1 = await client.searchRead(
          'res.partner',
          [['name', 'ilike', 'Search Test Partner']],
          { fields: ['name'], limit: pageSize, offset: offset }
        );
        allRecords = allRecords.concat(page1);
        offset += pageSize;

        // Second page
        const page2 = await client.searchRead(
          'res.partner',
          [['name', 'ilike', 'Search Test Partner']],
          { fields: ['name'], limit: pageSize, offset: offset }
        );
        allRecords = allRecords.concat(page2);

        expect(allRecords.length).toBeGreaterThanOrEqual(4);
      });
    });

    describe('searchCount pattern', () => {
      it('should count matching records efficiently', async () => {
        // Pattern from search-patterns.md: Use search_count for counting
        // Note: OdooClient doesn't have searchCount, so we use call() directly
        const count = await client.call<number>('res.partner', 'search_count', [
          [['name', 'ilike', 'Search Test Partner']],
        ]);

        expect(count).toBeGreaterThanOrEqual(5);
      });
    });
  });

  describe('properties.md - CRITICAL', () => {
    let teamId: number;
    let leadId: number;
    const isCrmInstalled = { value: false };

    beforeAll(async () => {
      // Check if CRM is installed (required for properties tests)
      isCrmInstalled.value = await moduleManager.isModuleInstalled('crm');

      if (!isCrmInstalled.value) {
        console.log('CRM module not installed - skipping properties tests');
        return;
      }

      // Get a CRM team
      const teams = await client.searchRead('crm.team', [], { limit: 1 });
      if (teams.length === 0) {
        throw new Error('No CRM teams found');
      }
      teamId = teams[0].id;

      // Define test properties
      const propertiesDefinition: PropertiesDefinition = [
        {
          name: 'test_priority',
          string: 'Test Priority',
          type: 'selection',
          selection: [
            ['low', 'Low'],
            ['medium', 'Medium'],
            ['high', 'High'],
          ],
        },
        {
          name: 'test_score',
          string: 'Test Score',
          type: 'integer',
        },
        {
          name: 'test_active',
          string: 'Test Active',
          type: 'boolean',
        },
      ];

      await client.write('crm.team', teamId, {
        lead_properties_definition: propertiesDefinition,
      });

      // Create test lead with properties
      leadId = await client.create('crm.lead', {
        name: uniqueTestName('Meta-Skills Properties Test Lead'),
        team_id: teamId,
        lead_properties: {
          test_priority: 'high',
          test_score: 85,
          test_active: true,
        },
      });
      createdRecords.push({ model: 'crm.lead', id: leadId });
    }, 60000);

    afterAll(async () => {
      // Cleanup is handled by the main afterAll
    });

    describe('Read/Write Asymmetry', () => {
      it.skipIf(!isCrmInstalled.value)(
        'should read properties in array format with metadata',
        async () => {
          // Pattern from properties.md: Read format
          const [lead] = await client.read('crm.lead', [leadId], [
            'lead_properties',
          ]);

          // Read format: array of {name, type, string, value}
          expect(Array.isArray(lead.lead_properties)).toBe(true);
          expect(lead.lead_properties.length).toBeGreaterThan(0);

          const priorityProp = lead.lead_properties.find(
            (p: any) => p.name === 'test_priority'
          );
          expect(priorityProp).toBeDefined();
          expect(priorityProp.type).toBe('selection');
          expect(priorityProp.string).toBe('Test Priority');
          expect(priorityProp.value).toBe('high');
        }
      );

      it.skipIf(!isCrmInstalled.value)(
        'should write properties in simple key-value format',
        async () => {
          // Pattern from properties.md: Write format
          await client.write('crm.lead', leadId, {
            lead_properties: {
              test_priority: 'medium',
              test_score: 90,
              test_active: true,
            },
          });

          const [lead] = await client.read('crm.lead', [leadId], [
            'lead_properties',
          ]);
          const priority = getPropertyValue(
            lead.lead_properties,
            'test_priority'
          );
          expect(priority).toBe('medium');
        }
      );
    });

    describe('Full Replacement Behavior - CRITICAL WARNING', () => {
      it.skipIf(!isCrmInstalled.value)(
        'should LOSE data with partial write (proves documentation warning is correct)',
        async () => {
          // CRITICAL: This test proves the documented warning is accurate
          // Pattern from properties.md: "When you write properties, Odoo REPLACES ALL property values"

          // First, set all properties to known values
          await client.write('crm.lead', leadId, {
            lead_properties: {
              test_priority: 'high',
              test_score: 85,
              test_active: true,
            },
          });

          // WRONG WAY: Partial write - only update priority
          // This WILL clear other properties!
          await client.write('crm.lead', leadId, {
            lead_properties: { test_priority: 'critical' },
          });

          // Verify other values are now false/cleared
          const [lead] = await client.read('crm.lead', [leadId], [
            'lead_properties',
          ]);
          const score = getPropertyValue(lead.lead_properties, 'test_score');
          const active = getPropertyValue(lead.lead_properties, 'test_active');

          // These assertions prove the documentation warning is correct!
          expect(score).toBeFalsy(); // Lost!
          expect(active).toBeFalsy(); // Lost!
        }
      );

      it.skipIf(!isCrmInstalled.value)(
        'should preserve values with read-modify-write pattern (documented correct approach)',
        async () => {
          // Pattern from properties.md: Correct way to update properties

          // Reset values
          await client.write('crm.lead', leadId, {
            lead_properties: {
              test_priority: 'high',
              test_score: 85,
              test_active: true,
            },
          });

          // CORRECT WAY: Read first
          const [lead] = await client.read('crm.lead', [leadId], [
            'lead_properties',
          ]);
          const props = propertiesToWriteFormat(lead.lead_properties);

          // Modify only what we need
          props.test_priority = 'low';

          // Write ALL properties back
          await client.write('crm.lead', leadId, { lead_properties: props });

          // Verify ALL values are preserved
          const [updated] = await client.read('crm.lead', [leadId], [
            'lead_properties',
          ]);
          expect(getPropertyValue(updated.lead_properties, 'test_priority')).toBe(
            'low'
          );
          expect(getPropertyValue(updated.lead_properties, 'test_score')).toBe(
            85
          ); // Preserved!
          expect(getPropertyValue(updated.lead_properties, 'test_active')).toBe(
            true
          ); // Preserved!
        }
      );
    });

    describe('Helper functions', () => {
      it.skipIf(!isCrmInstalled.value)(
        'should use propertiesToWriteFormat helper',
        async () => {
          // Pattern from properties.md: Using helper functions
          const [lead] = await client.read('crm.lead', [leadId], [
            'lead_properties',
          ]);

          const writeFormat = propertiesToWriteFormat(lead.lead_properties);

          // Write format should be simple key-value object
          expect(typeof writeFormat).toBe('object');
          expect(writeFormat).toHaveProperty('test_priority');
          expect(writeFormat).toHaveProperty('test_score');
          expect(writeFormat).toHaveProperty('test_active');
        }
      );

      it.skipIf(!isCrmInstalled.value)(
        'should use getPropertyValue helper',
        async () => {
          // First set known values
          await client.write('crm.lead', leadId, {
            lead_properties: {
              test_priority: 'high',
              test_score: 42,
              test_active: true,
            },
          });

          const [lead] = await client.read('crm.lead', [leadId], [
            'lead_properties',
          ]);

          // Pattern from properties.md: Extract specific value
          const score = getPropertyValue(lead.lead_properties, 'test_score');
          expect(score).toBe(42);

          // Non-existent property returns undefined
          const nonExistent = getPropertyValue(
            lead.lead_properties,
            'non_existent'
          );
          expect(nonExistent).toBeUndefined();
        }
      );
    });
  });

  describe('modules.md', () => {
    it('should check if a module is installed', async () => {
      // Pattern from modules.md: Checking module installation
      const hasCRM = await moduleManager.isModuleInstalled('crm');

      // crm may or may not be installed, but the call should work
      expect(typeof hasCRM).toBe('boolean');
    });

    it('should list installed modules', async () => {
      // Pattern from modules.md: Listing installed modules
      const installed = await client.searchRead(
        'ir.module.module',
        [['state', '=', 'installed']],
        {
          fields: ['name', 'shortdesc', 'state'],
          order: 'name asc',
        }
      );

      expect(installed.length).toBeGreaterThan(0);
      expect(installed[0]).toHaveProperty('name');
      expect(installed[0]).toHaveProperty('state');
      expect(installed[0].state).toBe('installed');
    });
  });
});
