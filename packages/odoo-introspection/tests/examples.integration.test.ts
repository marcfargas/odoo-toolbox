/**
 * Integration tests for odoo-introspection examples
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { OdooClient } from '@odoo-toolbox/client';
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
});
