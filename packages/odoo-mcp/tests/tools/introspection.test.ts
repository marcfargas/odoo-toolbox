/**
 * Unit tests for introspection tools.
 *
 * Tests cover:
 * - Get models
 * - Get fields
 * - Get model metadata
 * - Generate TypeScript types
 * - Input validation
 * - Error handling
 */

import { describe, it, expect, vi } from 'vitest';
import {
  handleGetModels,
  handleGetFields,
  handleGetModelMetadata,
  handleGenerateTypes,
} from '../../src/tools/introspection';
import { SessionManager } from '../../src/session/session-manager';

// Mock introspection module
vi.mock('@odoo-toolbox/introspection', () => ({
  CodeGenerator: class MockCodeGenerator {
    async generate() {
      return '// Generated TypeScript\nexport interface ResPartner {}';
    }
  },
  generateCompleteFile: () => 'export interface ResPartner {}',
  generateHelperTypes: () => '// Helper types',
}));

// Create mock session with mock introspector
const createMockSession = (introspectorMethods: Record<string, any> = {}) => {
  const mockIntrospector = {
    getModels: vi.fn().mockResolvedValue([
      { model: 'res.partner', name: 'Contact', transient: false, id: 1 },
      { model: 'res.users', name: 'Users', transient: false, id: 2 },
    ]),
    getFields: vi.fn().mockResolvedValue([
      { name: 'name', ttype: 'char', required: true, readonly: false, id: 1, model: 'res.partner' },
      {
        name: 'email',
        ttype: 'char',
        required: false,
        readonly: false,
        id: 2,
        model: 'res.partner',
      },
    ]),
    getModelMetadata: vi.fn().mockResolvedValue({
      model: { model: 'res.partner', name: 'Contact', transient: false, id: 1 },
      fields: [
        {
          name: 'name',
          ttype: 'char',
          required: true,
          readonly: false,
          id: 1,
          model: 'res.partner',
        },
      ],
    }),
    ...introspectorMethods,
  };

  const mockClient = {};

  const mockSession = {
    getIntrospector: vi.fn().mockReturnValue(mockIntrospector),
    getClient: vi.fn().mockReturnValue(mockClient),
    isAuthenticated: vi.fn().mockReturnValue(true),
  };

  return { session: mockSession as unknown as SessionManager, introspector: mockIntrospector };
};

describe('Introspection Tools', () => {
  describe('handleGetModels', () => {
    it('returns list of models', async () => {
      const { session } = createMockSession();

      const result = await handleGetModels(session, {});

      expect(result.success).toBe(true);
      expect((result as any).models).toHaveLength(2);
      expect((result as any).count).toBe(2);
      expect((result as any).models[0].model).toBe('res.partner');
    });

    it('passes includeTransient option', async () => {
      const { session, introspector } = createMockSession();

      await handleGetModels(session, { includeTransient: true });

      expect(introspector.getModels).toHaveBeenCalledWith(
        expect.objectContaining({ includeTransient: true })
      );
    });

    it('passes modules filter', async () => {
      const { session, introspector } = createMockSession();

      await handleGetModels(session, { modules: ['sale', 'project'] });

      expect(introspector.getModels).toHaveBeenCalledWith(
        expect.objectContaining({ modules: ['sale', 'project'] })
      );
    });

    it('passes bypassCache option', async () => {
      const { session, introspector } = createMockSession();

      await handleGetModels(session, { bypassCache: true });

      expect(introspector.getModels).toHaveBeenCalledWith(
        expect.objectContaining({ bypassCache: true })
      );
    });
  });

  describe('handleGetFields', () => {
    it('returns fields for model', async () => {
      const { session } = createMockSession();

      const result = await handleGetFields(session, { model: 'res.partner' });

      expect(result.success).toBe(true);
      expect((result as any).fields).toHaveLength(2);
      expect((result as any).fields[0].name).toBe('name');
    });

    it('returns error for empty model', async () => {
      const { session } = createMockSession();

      const result = await handleGetFields(session, { model: '' });

      expect(result.success).toBe(false);
      expect((result as any).error.code).toBe('INVALID_INPUT');
    });

    it('passes bypassCache option', async () => {
      const { session, introspector } = createMockSession();

      await handleGetFields(session, { model: 'res.partner', bypassCache: true });

      expect(introspector.getFields).toHaveBeenCalledWith(
        'res.partner',
        expect.objectContaining({ bypassCache: true })
      );
    });
  });

  describe('handleGetModelMetadata', () => {
    it('returns model with fields', async () => {
      const { session } = createMockSession();

      const result = await handleGetModelMetadata(session, { model: 'res.partner' });

      expect(result.success).toBe(true);
      expect((result as any).metadata.model.model).toBe('res.partner');
      expect((result as any).metadata.fields).toHaveLength(1);
    });

    it('includes field count in message', async () => {
      const { session } = createMockSession();

      const result = await handleGetModelMetadata(session, { model: 'res.partner' });

      expect(result.message).toContain('1 fields');
    });
  });

  describe('handleGenerateTypes', () => {
    it('generates TypeScript for all models', async () => {
      const { session } = createMockSession();

      const result = await handleGenerateTypes(session, {});

      expect(result.success).toBe(true);
      expect((result as any).typescript).toContain('interface');
    });

    it('generates TypeScript for specific models', async () => {
      const { session, introspector } = createMockSession();

      const result = await handleGenerateTypes(session, { models: ['res.partner'] });

      expect(result.success).toBe(true);
      expect((result as any).modelCount).toBe(1);
      expect(introspector.getModelMetadata).toHaveBeenCalledWith('res.partner');
    });

    it('passes includeTransient option', async () => {
      const { session } = createMockSession();

      const result = await handleGenerateTypes(session, { includeTransient: true });

      expect(result.success).toBe(true);
    });
  });
});
