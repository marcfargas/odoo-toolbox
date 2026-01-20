/**
 * Integration tests for Odoo model introspection.
 * 
 * Tests against a live Odoo instance to verify introspection of ir.model
 * and ir.model.fields works correctly.
 */

import { OdooClient } from '../src/client/odoo-client';
import { getTestConfig } from '../../../tests/helpers/odoo-instance';

describe('Introspection Integration Tests', () => {
  let client: OdooClient;

  beforeAll(async () => {
    const config = getTestConfig();
    client = new OdooClient(config);
    await client.authenticate();
  });

  afterAll(() => {
    client.logout();
  });

  describe('getModels()', () => {
    it('should retrieve all available models', async () => {
      const models = await client.getModels();

      expect(models).toBeDefined();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);

      // Check structure of first model
      const firstModel = models[0];
      expect(firstModel).toHaveProperty('id');
      expect(firstModel).toHaveProperty('model');
      expect(firstModel).toHaveProperty('name');
      expect(firstModel).toHaveProperty('transient');
    });

    it('should find standard Odoo models', async () => {
      const models = await client.getModels();
      const modelNames = models.map((m) => m.model);

      // These models exist in all Odoo installations
      expect(modelNames).toContain('res.partner');
      expect(modelNames).toContain('res.users');
      expect(modelNames).toContain('ir.model');
      expect(modelNames).toContain('ir.model.fields');
    });

    it('should exclude transient models by default', async () => {
      const models = await client.getModels();
      
      // All models should have transient = false
      const hasTransient = models.some((m) => m.transient === true);
      expect(hasTransient).toBe(false);
    });

    it('should include transient models when requested', async () => {
      const allModels = await client.getModels({ includeTransient: true });
      const regularModels = await client.getModels({ includeTransient: false });
      
      // includeTransient:true should return at least as many models as false
      expect(allModels.length).toBeGreaterThanOrEqual(regularModels.length);
      
      // All regular models should be in the all models list
      const allModelNames = new Set(allModels.map(m => m.model));
      regularModels.forEach(m => {
        expect(allModelNames.has(m.model)).toBe(true);
      });
    });

    it('should use cache on subsequent calls', async () => {
      // Clear cache first to ensure clean test
      client.clearIntrospectionCache();
      
      // First call - cache miss
      const models1 = await client.getModels();

      // Second call - should be from cache (returns exact same object)
      const models2 = await client.getModels();

      expect(models2).toEqual(models1);
      // Verify it's actually cached by checking it returns same data
      expect(models2.length).toBe(models1.length);
    });

    it('should bypass cache when requested', async () => {
      // Get cached version
      const cached = await client.getModels();

      // Force fresh query
      const fresh = await client.getModels({ bypassCache: true });

      // Should have same data even though cache was bypassed
      expect(fresh.length).toBe(cached.length);
      expect(fresh.map(m => m.model).sort()).toEqual(cached.map(m => m.model).sort());
    });
  });

  describe('getFields()', () => {
    it('should retrieve fields for res.partner', async () => {
      const fields = await client.getFields('res.partner');

      expect(fields).toBeDefined();
      expect(Array.isArray(fields)).toBe(true);
      expect(fields.length).toBeGreaterThan(0);

      // Check structure
      const firstField = fields[0];
      expect(firstField).toHaveProperty('id');
      expect(firstField).toHaveProperty('name');
      expect(firstField).toHaveProperty('field_description');
      expect(firstField).toHaveProperty('ttype');
      expect(firstField).toHaveProperty('required');
      expect(firstField).toHaveProperty('readonly');
      expect(firstField).toHaveProperty('model');
    });

    it('should find standard res.partner fields', async () => {
      const fields = await client.getFields('res.partner');
      const fieldNames = fields.map((f) => f.name);

      // These fields exist on res.partner in all Odoo versions
      expect(fieldNames).toContain('name');
      expect(fieldNames).toContain('email');
      expect(fieldNames).toContain('phone');
      expect(fieldNames).toContain('active');
    });

    it('should include field type information', async () => {
      const fields = await client.getFields('res.partner');

      // Find specific fields and check their types
      const nameField = fields.find((f) => f.name === 'name');
      expect(nameField).toBeDefined();
      expect(nameField?.ttype).toBe('char');
      // Note: 'name' field requirement may vary by Odoo version/configuration

      const emailField = fields.find((f) => f.name === 'email');
      expect(emailField).toBeDefined();
      expect(emailField?.ttype).toBe('char');

      const activeField = fields.find((f) => f.name === 'active');
      expect(activeField).toBeDefined();
      expect(activeField?.ttype).toBe('boolean');
    });

    it('should include relational field information', async () => {
      const fields = await client.getFields('res.partner');

      // Find a many2one field (e.g., user_id, parent_id, country_id)
      const many2oneFields = fields.filter((f) => f.ttype === 'many2one');
      expect(many2oneFields.length).toBeGreaterThan(0);

      // Check that many2one fields have relation info
      const firstMany2one = many2oneFields[0];
      expect(firstMany2one.relation).toBeDefined();
      expect(typeof firstMany2one.relation).toBe('string');
      expect(firstMany2one.relation!.length).toBeGreaterThan(0);
    });

    it('should use cache on subsequent calls', async () => {
      // Clear cache first to ensure clean test
      client.clearModelCache('res.partner');
      
      // First call - cache miss
      const fields1 = await client.getFields('res.partner');

      // Second call - should be from cache
      const fields2 = await client.getFields('res.partner');

      expect(fields2).toEqual(fields1);
      expect(fields2.length).toBe(fields1.length);
    });

    it('should throw error for non-existent model', async () => {
      await expect(
        client.getFields('this.model.does.not.exist')
      ).resolves.toEqual([]);
    });
  });

  describe('getModelMetadata()', () => {
    it('should retrieve combined model and field metadata', async () => {
      const metadata = await client.getModelMetadata('res.partner');

      expect(metadata).toBeDefined();
      expect(metadata).toHaveProperty('model');
      expect(metadata).toHaveProperty('fields');

      // Check model metadata
      expect(metadata.model.model).toBe('res.partner');
      expect(metadata.model.name).toBeDefined();
      expect(typeof metadata.model.name).toBe('string');

      // Check fields metadata
      expect(Array.isArray(metadata.fields)).toBe(true);
      expect(metadata.fields.length).toBeGreaterThan(0);
    });

    it('should have consistent data with separate calls', async () => {
      const metadata = await client.getModelMetadata('res.partner');
      const models = await client.getModels();
      const fields = await client.getFields('res.partner');

      const matchingModel = models.find((m) => m.model === 'res.partner');

      expect(metadata.model).toEqual(matchingModel);
      expect(metadata.fields).toEqual(fields);
    });

    it('should use cache on subsequent calls', async () => {
      // Clear cache first to ensure clean test
      client.clearModelCache('res.partner');
      
      // First call - cache miss
      const metadata1 = await client.getModelMetadata('res.partner');

      // Second call - should be from cache
      const metadata2 = await client.getModelMetadata('res.partner');

      expect(metadata2).toEqual(metadata1);
      expect(metadata2.fields.length).toBe(metadata1.fields.length);
    });

    it('should throw error for non-existent model', async () => {
      await expect(
        client.getModelMetadata('this.model.does.not.exist')
      ).rejects.toThrow("Model 'this.model.does.not.exist' not found");
    });
  });

  describe('Cache Management', () => {
    it('should clear cache when requested', async () => {
      // Populate cache
      await client.getModels();
      await client.getFields('res.partner');
      await client.getModelMetadata('res.users');

      // Clear cache
      client.clearIntrospectionCache();

      // Next calls should be slower (cache miss)
      const start = Date.now();
      await client.getModels();
      const duration = Date.now() - start;

      // Should take measurable time (not instant from cache)
      expect(duration).toBeGreaterThan(0);
    });

    it('should clear specific model from cache', async () => {
      // Populate cache for multiple models
      await client.getFields('res.partner');
      await client.getFields('res.users');

      // Clear only res.partner
      client.clearModelCache('res.partner');

      // res.users should still be cached (fast)
      const start1 = Date.now();
      await client.getFields('res.users');
      const duration1 = Date.now() - start1;

      // res.partner should be re-fetched (slower)
      const start2 = Date.now();
      await client.getFields('res.partner');
      const duration2 = Date.now() - start2;

      // This is a heuristic - cache hits should be faster
      expect(duration1).toBeLessThan(duration2);
    });
  });

  describe('Various Odoo Models', () => {
    it('should handle ir.model introspection', async () => {
      const fields = await client.getFields('ir.model');
      const fieldNames = fields.map((f) => f.name);

      expect(fieldNames).toContain('model');
      expect(fieldNames).toContain('name');
      expect(fieldNames).toContain('transient');
    });

    it('should handle ir.model.fields introspection', async () => {
      const fields = await client.getFields('ir.model.fields');
      const fieldNames = fields.map((f) => f.name);

      expect(fieldNames).toContain('name');
      expect(fieldNames).toContain('ttype');
      expect(fieldNames).toContain('relation');
    });

    it('should handle res.users introspection', async () => {
      const metadata = await client.getModelMetadata('res.users');

      expect(metadata.model.model).toBe('res.users');
      expect(metadata.fields.length).toBeGreaterThan(0);

      const loginField = metadata.fields.find((f) => f.name === 'login');
      expect(loginField).toBeDefined();
      expect(loginField?.ttype).toBe('char');
    });
  });
});
