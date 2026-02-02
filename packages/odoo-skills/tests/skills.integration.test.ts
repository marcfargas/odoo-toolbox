/**
 * Integration tests for SKILL examples
 *
 * These tests validate that SKILL examples execute correctly
 * against a live Odoo instance.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { OdooClient, ModuleManager } from '@odoo-toolbox/client';
import { skillRegistry } from '../src/registry';

// Test configuration from environment
const config = {
  url: process.env.ODOO_URL || 'http://localhost:8069',
  database: process.env.ODOO_DB || 'odoo',
  username: process.env.ODOO_USER || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
};

describe('SKILL Integration Tests', () => {
  let client: OdooClient;
  let moduleManager: ModuleManager;

  beforeAll(async () => {
    client = new OdooClient(config);
    await client.authenticate();
    moduleManager = new ModuleManager(client);
  });

  afterAll(async () => {
    await client.logout();
  });

  describe('Elementary SKILLs', () => {
    describe('odoo-connect', () => {
      it('should successfully authenticate', async () => {
        const testClient = new OdooClient(config);
        await testClient.authenticate();

        const sessionInfo = testClient.getSessionInfo();
        expect(sessionInfo).toBeDefined();
        expect(sessionInfo?.uid).toBeGreaterThan(0);

        await testClient.logout();
      });
    });

    describe('odoo-introspect', () => {
      it('should list models', async () => {
        const models = await client.searchRead(
          'ir.model',
          [['transient', '=', false]],
          { fields: ['model', 'name'], limit: 10 }
        );

        expect(models.length).toBeGreaterThan(0);
        expect(models[0]).toHaveProperty('model');
        expect(models[0]).toHaveProperty('name');
      });

      it('should get fields for a model', async () => {
        const fields = await client.searchRead(
          'ir.model.fields',
          [['model', '=', 'res.partner']],
          { fields: ['name', 'ttype', 'field_description'], limit: 10 }
        );

        expect(fields.length).toBeGreaterThan(0);
        expect(fields[0]).toHaveProperty('name');
        expect(fields[0]).toHaveProperty('ttype');
      });
    });

    describe('odoo-search-fields', () => {
      it('should search fields by pattern', async () => {
        const fields = await client.searchRead(
          'ir.model.fields',
          [['name', 'ilike', 'email']],
          { fields: ['name', 'model', 'ttype'], limit: 10 }
        );

        expect(fields.length).toBeGreaterThan(0);
        expect(fields.every((f) => f.name.toLowerCase().includes('email'))).toBe(
          true
        );
      });
    });

    describe('odoo-explore-modules', () => {
      it('should list installed modules', async () => {
        const modules = await client.searchRead(
          'ir.module.module',
          [['state', '=', 'installed']],
          { fields: ['name', 'shortdesc'], limit: 10 }
        );

        expect(modules.length).toBeGreaterThan(0);
        // 'base' should always be installed
        const baseModule = modules.find((m) => m.name === 'base');
        expect(baseModule).toBeDefined();
      });
    });
  });

  describe('User SKILLs', () => {
    // These require CRM module
    describe('odoo-create-lead', () => {
      beforeAll(async () => {
        // Ensure CRM is installed
        if (!(await moduleManager.isModuleInstalled('crm'))) {
          await moduleManager.installModule('crm');
        }
      }, 120000);

      it('should create and delete a lead', async () => {
        const leadId = await client.create('crm.lead', {
          name: 'Test Lead - SKILL Integration',
          email_from: 'test@example.com',
          expected_revenue: 10000,
        });

        expect(leadId).toBeGreaterThan(0);

        // Verify lead exists
        const [lead] = await client.read('crm.lead', [leadId], ['name', 'stage_id']);
        expect(lead.name).toBe('Test Lead - SKILL Integration');

        // Cleanup
        await client.unlink('crm.lead', leadId);
      });
    });

    describe('odoo-search-partners', () => {
      it('should search for partners', async () => {
        const partners = await client.searchRead(
          'res.partner',
          [],
          { fields: ['name', 'email', 'is_company'], limit: 5 }
        );

        expect(partners.length).toBeGreaterThan(0);
        expect(partners[0]).toHaveProperty('name');
      });

      it('should filter companies', async () => {
        const companies = await client.searchRead(
          'res.partner',
          [['is_company', '=', true]],
          { fields: ['name'], limit: 5 }
        );

        expect(companies.every((c) => c.is_company === true)).toBe(true);
      });
    });
  });

  describe('Admin SKILLs', () => {
    describe('odoo-install-module', () => {
      it('should check module installation status', async () => {
        const isBaseInstalled = await moduleManager.isModuleInstalled('base');
        expect(isBaseInstalled).toBe(true);
      });

      it('should get module info', async () => {
        const modules = await client.searchRead(
          'ir.module.module',
          [['name', '=', 'base']],
          { fields: ['name', 'shortdesc', 'state', 'installed_version'] }
        );

        expect(modules.length).toBe(1);
        expect(modules[0].state).toBe('installed');
      });
    });

    describe('odoo-manage-properties', () => {
      beforeAll(async () => {
        // Ensure CRM is installed for properties testing
        if (!(await moduleManager.isModuleInstalled('crm'))) {
          await moduleManager.installModule('crm');
        }
      }, 120000);

      it('should read properties definition from CRM team', async () => {
        const teams = await client.searchRead('crm.team', [], {
          fields: ['name', 'lead_properties_definition'],
          limit: 1,
        });

        expect(teams.length).toBeGreaterThan(0);
        // lead_properties_definition should exist (may be empty array)
        expect(teams[0]).toHaveProperty('lead_properties_definition');
      });
    });
  });

  describe('SKILL Registry Validation', () => {
    it('should have all required skills registered', () => {
      const requiredSkills = [
        'odoo-connect',
        'odoo-introspect',
        'odoo-search-fields',
        'odoo-explore-modules',
        'odoo-create-lead',
        'odoo-search-partners',
        'odoo-install-module',
        'odoo-manage-properties',
      ];

      for (const skillId of requiredSkills) {
        const skill = skillRegistry.get(skillId);
        expect(skill).toBeDefined();
      }
    });

    it('should have valid odooModels that exist', async () => {
      const allModels = await client.searchRead(
        'ir.model',
        [],
        { fields: ['model'] }
      );
      const modelNames = new Set(allModels.map((m) => m.model));

      // Check elementary skills (don't require additional modules)
      const elementarySkills = skillRegistry.getByLevel('elementary');

      for (const skill of elementarySkills) {
        for (const modelName of skill.odooModels) {
          expect(modelNames.has(modelName)).toBe(true);
        }
      }
    });
  });
});
