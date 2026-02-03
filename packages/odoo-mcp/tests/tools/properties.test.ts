/**
 * Unit tests for properties tools.
 *
 * Tests cover:
 * - Read properties
 * - Update properties (safe read-modify-write)
 * - Find properties field
 * - Get property definitions
 * - Set property definitions
 */

import { describe, it, expect, vi } from 'vitest';
import {
  handleReadProperties,
  handleUpdateProperties,
  handleFindPropertiesField,
  handleGetPropertyDefinitions,
  handleSetPropertyDefinitions,
} from '../../src/tools/properties';
import { SessionManager } from '../../src/session/session-manager';

// Sample property data in Odoo's read format
const sampleRawProperties = [
  {
    name: 'priority',
    type: 'selection',
    string: 'Priority',
    value: 'high',
    selection: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
    ],
  },
  {
    name: 'score',
    type: 'integer',
    string: 'Score',
    value: 85,
  },
  {
    name: 'requires_approval',
    type: 'boolean',
    string: 'Requires Approval',
    value: true,
  },
];

// Create mock session with mock client
const createMockSession = (clientMethods: Record<string, unknown> = {}) => {
  const mockClient = {
    read: vi.fn().mockResolvedValue([{ lead_properties: sampleRawProperties }]),
    write: vi.fn().mockResolvedValue(true),
    searchRead: vi.fn().mockResolvedValue([]),
    ...clientMethods,
  };

  const mockSession = {
    isAuthenticated: () => true,
    getClient: () => mockClient,
  };

  return { session: mockSession as unknown as SessionManager, client: mockClient };
};

describe('Properties Tools', () => {
  describe('handleReadProperties', () => {
    it('returns properties in both formats by default', async () => {
      const { session } = createMockSession();

      const result = await handleReadProperties(session, {
        model: 'crm.lead',
        id: 1,
      });

      expect(result.success).toBe(true);
      expect((result as { raw: unknown[] }).raw).toHaveLength(3);
      expect((result as { simple: Record<string, unknown> }).simple).toEqual({
        priority: 'high',
        score: 85,
        requires_approval: true,
      });
    });

    it('returns only raw format when specified', async () => {
      const { session } = createMockSession();

      const result = await handleReadProperties(session, {
        model: 'crm.lead',
        id: 1,
        format: 'raw',
      });

      expect(result.success).toBe(true);
      expect((result as { raw: unknown[] }).raw).toBeDefined();
      expect((result as { simple?: unknown }).simple).toBeUndefined();
    });

    it('returns only simple format when specified', async () => {
      const { session } = createMockSession();

      const result = await handleReadProperties(session, {
        model: 'crm.lead',
        id: 1,
        format: 'simple',
      });

      expect(result.success).toBe(true);
      expect((result as { raw?: unknown }).raw).toBeUndefined();
      expect((result as { simple: Record<string, unknown> }).simple).toBeDefined();
    });

    it('uses provided property field', async () => {
      const { session, client } = createMockSession({
        read: vi.fn().mockResolvedValue([{ custom_props: [] }]),
      });

      await handleReadProperties(session, {
        model: 'custom.model',
        id: 1,
        property_field: 'custom_props',
      });

      expect(client.read).toHaveBeenCalledWith('custom.model', [1], ['custom_props']);
    });

    it('returns error when no properties field found', async () => {
      const { session } = createMockSession({
        searchRead: vi.fn().mockResolvedValue([]), // No properties field found
      });

      const result = await handleReadProperties(session, {
        model: 'res.partner', // No known mapping
        id: 1,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('No properties field found');
    });
  });

  describe('handleUpdateProperties', () => {
    it('performs safe read-modify-write', async () => {
      const { session, client } = createMockSession();

      const result = await handleUpdateProperties(session, {
        model: 'crm.lead',
        id: 1,
        updates: { priority: 'low', new_field: 'value' },
      });

      expect(result.success).toBe(true);
      expect((result as { updated_properties: string[] }).updated_properties).toEqual([
        'priority',
        'new_field',
      ]);

      // Should merge with existing values
      expect(client.write).toHaveBeenCalledWith('crm.lead', [1], {
        lead_properties: {
          priority: 'low',
          score: 85,
          requires_approval: true,
          new_field: 'value',
        },
      });
    });

    it('preserves existing values not in updates', async () => {
      const { session, client } = createMockSession();

      await handleUpdateProperties(session, {
        model: 'crm.lead',
        id: 1,
        updates: { score: 100 },
      });

      expect(client.write).toHaveBeenCalledWith('crm.lead', [1], {
        lead_properties: expect.objectContaining({
          priority: 'high',
          requires_approval: true,
          score: 100,
        }),
      });
    });
  });

  describe('handleFindPropertiesField', () => {
    it('returns known mapping for crm.lead', async () => {
      const { session } = createMockSession();

      const result = await handleFindPropertiesField(session, {
        model: 'crm.lead',
      });

      expect(result.success).toBe(true);
      expect((result as { has_properties: boolean }).has_properties).toBe(true);
      expect((result as { property_field: string }).property_field).toBe('lead_properties');
      expect((result as { definition_model: string }).definition_model).toBe('crm.team');
      expect((result as { definition_field: string }).definition_field).toBe(
        'lead_properties_definition'
      );
    });

    it('returns known mapping for project.task', async () => {
      const { session } = createMockSession();

      const result = await handleFindPropertiesField(session, {
        model: 'project.task',
      });

      expect(result.success).toBe(true);
      expect((result as { has_properties: boolean }).has_properties).toBe(true);
      expect((result as { property_field: string }).property_field).toBe('task_properties');
    });

    it('queries ir.model.fields for unknown models', async () => {
      const { session, client } = createMockSession({
        searchRead: vi.fn().mockResolvedValue([{ name: 'custom_properties' }]),
      });

      const result = await handleFindPropertiesField(session, {
        model: 'custom.model',
      });

      expect(result.success).toBe(true);
      expect((result as { has_properties: boolean }).has_properties).toBe(true);
      expect((result as { property_field: string }).property_field).toBe('custom_properties');
      expect(client.searchRead).toHaveBeenCalledWith(
        'ir.model.fields',
        [
          ['model', '=', 'custom.model'],
          ['ttype', '=', 'properties'],
        ],
        expect.any(Object)
      );
    });

    it('returns no properties when field not found', async () => {
      const { session } = createMockSession({
        searchRead: vi.fn().mockResolvedValue([]),
      });

      const result = await handleFindPropertiesField(session, {
        model: 'res.partner',
      });

      expect(result.success).toBe(true);
      expect((result as { has_properties: boolean }).has_properties).toBe(false);
    });
  });

  describe('handleGetPropertyDefinitions', () => {
    it('returns definitions from parent model', async () => {
      const definitions = [
        { name: 'priority', string: 'Priority', type: 'selection' },
        { name: 'score', string: 'Score', type: 'integer' },
      ];

      const { session } = createMockSession({
        read: vi.fn().mockResolvedValue([{ lead_properties_definition: definitions }]),
      });

      const result = await handleGetPropertyDefinitions(session, {
        model: 'crm.lead',
        parent_id: 1,
      });

      expect(result.success).toBe(true);
      expect((result as { definitions: unknown[] }).definitions).toEqual(definitions);
      expect((result as { definition_model: string }).definition_model).toBe('crm.team');
    });

    it('requires parent_id', async () => {
      const { session } = createMockSession();

      const result = await handleGetPropertyDefinitions(session, {
        model: 'crm.lead',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('parent_id required');
    });

    it('returns error for unknown model', async () => {
      const { session } = createMockSession();

      const result = await handleGetPropertyDefinitions(session, {
        model: 'unknown.model',
        parent_id: 1,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('No property definition mapping known');
    });
  });

  describe('handleSetPropertyDefinitions', () => {
    it('sets definitions in replace mode', async () => {
      const { session, client } = createMockSession();

      const newDefinitions = [{ name: 'status', string: 'Status', type: 'selection' as const }];

      const result = await handleSetPropertyDefinitions(session, {
        definition_model: 'crm.team',
        definition_id: 1,
        definitions: newDefinitions,
      });

      expect(result.success).toBe(true);
      expect(client.write).toHaveBeenCalledWith('crm.team', [1], {
        lead_properties_definition: newDefinitions,
      });
    });

    it('merges definitions in merge mode', async () => {
      const existingDefinitions = [
        { name: 'priority', string: 'Priority', type: 'selection' },
        { name: 'score', string: 'Score', type: 'integer' },
      ];

      const { session, client } = createMockSession({
        read: vi.fn().mockResolvedValue([{ lead_properties_definition: existingDefinitions }]),
      });

      const newDefinitions = [
        { name: 'priority', string: 'Updated Priority', type: 'selection' as const },
        { name: 'new_field', string: 'New Field', type: 'char' as const },
      ];

      const result = await handleSetPropertyDefinitions(session, {
        definition_model: 'crm.team',
        definition_id: 1,
        definitions: newDefinitions,
        mode: 'merge',
      });

      expect(result.success).toBe(true);
      expect((result as { property_count: number }).property_count).toBe(3);

      // Should have merged: updated priority, kept score, added new_field
      expect(client.write).toHaveBeenCalledWith(
        'crm.team',
        [1],
        expect.objectContaining({
          lead_properties_definition: expect.arrayContaining([
            expect.objectContaining({ name: 'priority', string: 'Updated Priority' }),
            expect.objectContaining({ name: 'score' }),
            expect.objectContaining({ name: 'new_field' }),
          ]),
        })
      );
    });

    it('validates property types', async () => {
      const { session } = createMockSession();

      const result = await handleSetPropertyDefinitions(session, {
        definition_model: 'crm.team',
        definition_id: 1,
        definitions: [
          // @ts-expect-error Testing invalid type
          { name: 'test', string: 'Test', type: 'invalid_type' },
        ],
      });

      expect(result.success).toBe(false);
    });
  });
});
