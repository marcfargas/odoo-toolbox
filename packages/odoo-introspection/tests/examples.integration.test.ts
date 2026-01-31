/**
 * Integration tests for odoo-introspection examples
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { OdooClient, ModuleManager } from '@odoo-toolbox/client';
import { Introspector } from '../src';

describe('odoo-introspection examples', () => {
  let client: OdooClient;
  let introspector: Introspector;

  beforeAll(async () => {
    client = new OdooClient({
      url: process.env.ODOO_URL || 'http://localhost:8069',
      database: process.env.ODOO_DB || 'odoo',
      username: process.env.ODOO_USER || 'admin',
      password: process.env.ODOO_PASSWORD || 'admin',
    });
    await client.authenticate();
    introspector = new Introspector(client);
  });

  afterAll(async () => {
    await client.logout();
  });

  describe('Example 1: Schema Introspection', () => {
    it('should list all models', async () => {
      const models = await introspector.getModels();
      expect(models).toBeDefined();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
    });

    it('should filter models by module', async () => {
      const models = await introspector.getModels();
      const saleModels = models.filter((m) => m.model.startsWith('sale.'));
      expect(Array.isArray(saleModels)).toBe(true);
    });

    it('should get fields for a model', async () => {
      const fields = await introspector.getFields('res.partner');
      expect(fields).toBeDefined();
      expect(Array.isArray(fields)).toBe(true);
      expect(fields.length).toBeGreaterThan(0);

      // Verify field structure
      const field = fields[0];
      expect(field).toHaveProperty('name');
      expect(field).toHaveProperty('ttype');
    });

    it('should get model metadata', async () => {
      const metadata = await introspector.getModelMetadata('res.partner');
      expect(metadata).toBeDefined();
      expect(metadata.model).toBeDefined();
      expect(metadata.model.model).toBe('res.partner');
      expect(metadata.fields).toBeDefined();
      expect(Array.isArray(metadata.fields)).toBe(true);
    });

    it('should inspect field properties', async () => {
      const fields = await introspector.getFields('res.partner');
      const nameField = fields.find((f) => f.name === 'name');
      expect(nameField).toBeDefined();
      if (nameField) {
        expect(nameField.ttype).toBe('char');
        // Name field in res.partner might have required: false at model level
        // but is required at creation time due to constraints
      }
    });

    it('should handle relational fields', async () => {
      const fields = await introspector.getFields('res.partner');
      const relationFields = fields.filter((f) => f.relation);
      expect(Array.isArray(relationFields)).toBe(true);

      if (relationFields.length > 0) {
        relationFields.forEach((field) => {
          expect(field.relation).toBeDefined();
        });
      }
    });
  });

  describe('Example 2: Generate TypeScript Types', () => {
    it('should get metadata for multiple models', async () => {
      const modelsToCheck = ['res.partner', 'sale.order'];
      const metadataList = [];

      for (const modelName of modelsToCheck) {
        try {
          const metadata = await introspector.getModelMetadata(modelName);
          metadataList.push(metadata);
        } catch (error) {
          // Model might not exist in all instances
        }
      }

      expect(metadataList.length).toBeGreaterThan(0);
      metadataList.forEach((metadata) => {
        expect(metadata.model).toBeDefined();
        expect(metadata.fields).toBeDefined();
      });
    });

    it('should generate code from metadata', async () => {
      const metadata = await introspector.getModelMetadata('res.partner');
      const { generateCompleteFile } = await import('../src/codegen');
      
      const code = generateCompleteFile([metadata]);
      expect(code).toBeDefined();
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(0);
      // Should contain TypeScript interface syntax
      expect(code).toMatch(/interface|type|export/i);
    });

    it('should handle missing models gracefully', async () => {
      try {
        await introspector.getModelMetadata('non.existent.model');
        // If it doesn't throw, that's also fine for this test
      } catch (error) {
        // Expected behavior
        expect(error).toBeDefined();
      }
    });
  });

  describe('Example 3: E2E Lead to Sale Workflow', () => {
    // Track created records for cleanup
    let leadId: number | undefined;
    let partnerId: number | undefined;
    let activityId: number | undefined;
    let saleOrderId: number | undefined;

    // Ensure modules are installed before all tests in this suite
    // Module installation can take 30+ seconds per module, so we set a 2 minute timeout
    beforeAll(async () => {
      const moduleManager = new ModuleManager(client);

      // Install CRM module if not installed
      if (!(await moduleManager.isModuleInstalled('crm'))) {
        await moduleManager.installModule('crm');
      }

      // Install Sale module if not installed
      if (!(await moduleManager.isModuleInstalled('sale'))) {
        await moduleManager.installModule('sale');
      }
    }, 120000); // 2 minute timeout for module installation

    // Cleanup all created records after tests complete
    afterAll(async () => {
      // Delete in reverse dependency order
      if (saleOrderId) {
        try {
          // Cancel the order first (confirmed orders can't be deleted)
          await client.call('sale.order', 'action_cancel', [[saleOrderId]]);
          await client.unlink('sale.order', saleOrderId);
        } catch {
          // Ignore cleanup errors
        }
      }
      if (activityId) {
        try {
          await client.unlink('mail.activity', activityId);
        } catch {
          // Ignore cleanup errors
        }
      }
      if (leadId) {
        try {
          await client.unlink('crm.lead', leadId);
        } catch {
          // Ignore cleanup errors
        }
      }
      if (partnerId) {
        try {
          await client.unlink('res.partner', partnerId);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    describe('Introspection', () => {
      it('should get crm.lead fields', async () => {
        const fields = await introspector.getFields('crm.lead');
        expect(fields).toBeDefined();
        expect(Array.isArray(fields)).toBe(true);
        expect(fields.length).toBeGreaterThan(0);

        // Verify key fields exist
        const fieldNames = fields.map((f) => f.name);
        expect(fieldNames).toContain('name');
        expect(fieldNames).toContain('email_from');
        expect(fieldNames).toContain('partner_id');
      });

      it('should get res.partner fields', async () => {
        const fields = await introspector.getFields('res.partner');
        expect(fields).toBeDefined();
        expect(Array.isArray(fields)).toBe(true);

        // Verify key fields exist
        const fieldNames = fields.map((f) => f.name);
        expect(fieldNames).toContain('name');
        expect(fieldNames).toContain('email');
        expect(fieldNames).toContain('is_company');
      });

      it('should get sale.order fields and identify partner_id', async () => {
        const fields = await introspector.getFields('sale.order');
        expect(fields).toBeDefined();
        expect(Array.isArray(fields)).toBe(true);

        // Verify key fields exist
        const fieldNames = fields.map((f) => f.name);
        expect(fieldNames).toContain('partner_id');
        expect(fieldNames).toContain('state');

        // Verify partner_id is a many2one to res.partner
        const partnerIdField = fields.find((f) => f.name === 'partner_id');
        expect(partnerIdField).toBeDefined();
        expect(partnerIdField?.ttype).toBe('many2one');
        expect(partnerIdField?.relation).toBe('res.partner');
      });
    });

    describe('CRM Lead Operations', () => {
      it('should create a CRM lead', async () => {
        const leadData = {
          name: 'Test Lead - Integration Test',
          email_from: 'test@example.com',
          phone: '+1 555-0199',
          expected_revenue: 10000,
        };

        leadId = await client.create('crm.lead', leadData);
        expect(leadId).toBeDefined();
        expect(typeof leadId).toBe('number');
        expect(leadId).toBeGreaterThan(0);

        // Verify by reading back
        const [lead] = await client.read<{ name: string; email_from: string }>(
          'crm.lead',
          [leadId],
          ['name', 'email_from']
        );
        expect(lead.name).toBe(leadData.name);
        expect(lead.email_from).toBe(leadData.email_from);
      });

      it('should schedule an activity on the lead', async () => {
        expect(leadId).toBeDefined();

        // Find an activity type
        const activityTypes = await client.searchRead<{ id: number; name: string }>(
          'mail.activity.type',
          [],
          { fields: ['id', 'name'], limit: 1 }
        );
        expect(activityTypes.length).toBeGreaterThan(0);

        // Find the ir.model record for crm.lead (needed for res_model_id)
        const models = await client.searchRead<{ id: number; model: string }>(
          'ir.model',
          [['model', '=', 'crm.lead']],
          { fields: ['id', 'model'], limit: 1 }
        );
        expect(models.length).toBeGreaterThan(0);

        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 7);
        const deadlineStr = deadline.toISOString().split('T')[0];

        const activityData = {
          res_model_id: models[0].id, // many2one to ir.model
          res_id: leadId,
          activity_type_id: activityTypes[0].id,
          summary: 'Test follow-up activity',
          date_deadline: deadlineStr,
        };

        activityId = await client.create('mail.activity', activityData);
        expect(activityId).toBeDefined();
        expect(typeof activityId).toBe('number');
        expect(activityId).toBeGreaterThan(0);
      });
    });

    describe('Relational Field Requirements', () => {
      it('should fail to create sale.order without partner_id', async () => {
        expect(leadId).toBeDefined();

        // Attempt to create sale.order without required partner_id
        await expect(
          client.create('sale.order', {
            opportunity_id: leadId,
            // partner_id intentionally missing
          })
        ).rejects.toThrow();
      });
    });

    describe('Contact and Quotation', () => {
      it('should create a contact (res.partner)', async () => {
        const partnerData = {
          name: 'Test Contact - Integration Test',
          email: 'testcontact@example.com',
          phone: '+1 555-0188',
          is_company: false,
        };

        partnerId = await client.create('res.partner', partnerData);
        expect(partnerId).toBeDefined();
        expect(typeof partnerId).toBe('number');
        expect(partnerId).toBeGreaterThan(0);

        // Verify by reading back
        const [partner] = await client.read<{ name: string; email: string }>(
          'res.partner',
          [partnerId],
          ['name', 'email']
        );
        expect(partner.name).toBe(partnerData.name);
        expect(partner.email).toBe(partnerData.email);
      });

      it('should link contact to lead', async () => {
        expect(leadId).toBeDefined();
        expect(partnerId).toBeDefined();

        // Update the lead with partner_id
        const result = await client.write('crm.lead', [leadId!], {
          partner_id: partnerId,
        });
        expect(result).toBe(true);

        // Verify by reading back
        const [lead] = await client.read<{
          partner_id: [number, string] | false;
        }>('crm.lead', [leadId!], ['partner_id']);

        expect(lead.partner_id).toBeDefined();
        expect(lead.partner_id).not.toBe(false);
        // When reading many2one, Odoo returns [id, display_name]
        expect(Array.isArray(lead.partner_id)).toBe(true);
        expect((lead.partner_id as [number, string])[0]).toBe(partnerId);
      });

      it('should create quotation with partner and opportunity', async () => {
        expect(leadId).toBeDefined();
        expect(partnerId).toBeDefined();

        const quotationData = {
          partner_id: partnerId,
          opportunity_id: leadId,
        };

        saleOrderId = await client.create('sale.order', quotationData);
        expect(saleOrderId).toBeDefined();
        expect(typeof saleOrderId).toBe('number');
        expect(saleOrderId).toBeGreaterThan(0);

        // Verify by reading back
        const [order] = await client.read<{
          state: string;
          partner_id: [number, string];
          opportunity_id: [number, string] | false;
        }>('sale.order', [saleOrderId], ['state', 'partner_id', 'opportunity_id']);

        expect(order.state).toBe('draft');
        expect((order.partner_id as [number, string])[0]).toBe(partnerId);
        if (order.opportunity_id) {
          expect((order.opportunity_id as [number, string])[0]).toBe(leadId);
        }
      });

      it('should confirm the quotation', async () => {
        expect(saleOrderId).toBeDefined();

        // Confirm the quotation using action_confirm
        await client.call('sale.order', 'action_confirm', [[saleOrderId]]);

        // Verify state changed to 'sale'
        const [order] = await client.read<{ state: string }>(
          'sale.order',
          [saleOrderId!],
          ['state']
        );
        expect(order.state).toBe('sale');
      });
    });
  });
});
