"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const properties_1 = require("../../src/tools/properties");
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
const createMockSession = (clientMethods = {}) => {
    const mockClient = {
        read: vitest_1.vi.fn().mockResolvedValue([{ lead_properties: sampleRawProperties }]),
        write: vitest_1.vi.fn().mockResolvedValue(true),
        searchRead: vitest_1.vi.fn().mockResolvedValue([]),
        ...clientMethods,
    };
    const mockSession = {
        isAuthenticated: () => true,
        getClient: () => mockClient,
    };
    return { session: mockSession, client: mockClient };
};
(0, vitest_1.describe)('Properties Tools', () => {
    (0, vitest_1.describe)('handleReadProperties', () => {
        (0, vitest_1.it)('returns properties in both formats by default', async () => {
            const { session } = createMockSession();
            const result = await (0, properties_1.handleReadProperties)(session, {
                model: 'crm.lead',
                id: 1,
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.raw).toHaveLength(3);
            (0, vitest_1.expect)(result.simple).toEqual({
                priority: 'high',
                score: 85,
                requires_approval: true,
            });
        });
        (0, vitest_1.it)('returns only raw format when specified', async () => {
            const { session } = createMockSession();
            const result = await (0, properties_1.handleReadProperties)(session, {
                model: 'crm.lead',
                id: 1,
                format: 'raw',
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.raw).toBeDefined();
            (0, vitest_1.expect)(result.simple).toBeUndefined();
        });
        (0, vitest_1.it)('returns only simple format when specified', async () => {
            const { session } = createMockSession();
            const result = await (0, properties_1.handleReadProperties)(session, {
                model: 'crm.lead',
                id: 1,
                format: 'simple',
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.raw).toBeUndefined();
            (0, vitest_1.expect)(result.simple).toBeDefined();
        });
        (0, vitest_1.it)('uses provided property field', async () => {
            const { session, client } = createMockSession({
                read: vitest_1.vi.fn().mockResolvedValue([{ custom_props: [] }]),
            });
            await (0, properties_1.handleReadProperties)(session, {
                model: 'custom.model',
                id: 1,
                property_field: 'custom_props',
            });
            (0, vitest_1.expect)(client.read).toHaveBeenCalledWith('custom.model', [1], ['custom_props']);
        });
        (0, vitest_1.it)('returns error when no properties field found', async () => {
            const { session } = createMockSession({
                searchRead: vitest_1.vi.fn().mockResolvedValue([]), // No properties field found
            });
            const result = await (0, properties_1.handleReadProperties)(session, {
                model: 'res.partner', // No known mapping
                id: 1,
            });
            (0, vitest_1.expect)(result.success).toBe(false);
            (0, vitest_1.expect)(result.message).toContain('No properties field found');
        });
    });
    (0, vitest_1.describe)('handleUpdateProperties', () => {
        (0, vitest_1.it)('performs safe read-modify-write', async () => {
            const { session, client } = createMockSession();
            const result = await (0, properties_1.handleUpdateProperties)(session, {
                model: 'crm.lead',
                id: 1,
                updates: { priority: 'low', new_field: 'value' },
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.updated_properties).toEqual([
                'priority',
                'new_field',
            ]);
            // Should merge with existing values
            (0, vitest_1.expect)(client.write).toHaveBeenCalledWith('crm.lead', [1], {
                lead_properties: {
                    priority: 'low',
                    score: 85,
                    requires_approval: true,
                    new_field: 'value',
                },
            });
        });
        (0, vitest_1.it)('preserves existing values not in updates', async () => {
            const { session, client } = createMockSession();
            await (0, properties_1.handleUpdateProperties)(session, {
                model: 'crm.lead',
                id: 1,
                updates: { score: 100 },
            });
            (0, vitest_1.expect)(client.write).toHaveBeenCalledWith('crm.lead', [1], {
                lead_properties: vitest_1.expect.objectContaining({
                    priority: 'high',
                    requires_approval: true,
                    score: 100,
                }),
            });
        });
    });
    (0, vitest_1.describe)('handleFindPropertiesField', () => {
        (0, vitest_1.it)('returns known mapping for crm.lead', async () => {
            const { session } = createMockSession();
            const result = await (0, properties_1.handleFindPropertiesField)(session, {
                model: 'crm.lead',
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.has_properties).toBe(true);
            (0, vitest_1.expect)(result.property_field).toBe('lead_properties');
            (0, vitest_1.expect)(result.definition_model).toBe('crm.team');
            (0, vitest_1.expect)(result.definition_field).toBe('lead_properties_definition');
        });
        (0, vitest_1.it)('returns known mapping for project.task', async () => {
            const { session } = createMockSession();
            const result = await (0, properties_1.handleFindPropertiesField)(session, {
                model: 'project.task',
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.has_properties).toBe(true);
            (0, vitest_1.expect)(result.property_field).toBe('task_properties');
        });
        (0, vitest_1.it)('queries ir.model.fields for unknown models', async () => {
            const { session, client } = createMockSession({
                searchRead: vitest_1.vi.fn().mockResolvedValue([{ name: 'custom_properties' }]),
            });
            const result = await (0, properties_1.handleFindPropertiesField)(session, {
                model: 'custom.model',
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.has_properties).toBe(true);
            (0, vitest_1.expect)(result.property_field).toBe('custom_properties');
            (0, vitest_1.expect)(client.searchRead).toHaveBeenCalledWith('ir.model.fields', [
                ['model', '=', 'custom.model'],
                ['ttype', '=', 'properties'],
            ], vitest_1.expect.any(Object));
        });
        (0, vitest_1.it)('returns no properties when field not found', async () => {
            const { session } = createMockSession({
                searchRead: vitest_1.vi.fn().mockResolvedValue([]),
            });
            const result = await (0, properties_1.handleFindPropertiesField)(session, {
                model: 'res.partner',
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.has_properties).toBe(false);
        });
    });
    (0, vitest_1.describe)('handleGetPropertyDefinitions', () => {
        (0, vitest_1.it)('returns definitions from parent model', async () => {
            const definitions = [
                { name: 'priority', string: 'Priority', type: 'selection' },
                { name: 'score', string: 'Score', type: 'integer' },
            ];
            const { session } = createMockSession({
                read: vitest_1.vi.fn().mockResolvedValue([{ lead_properties_definition: definitions }]),
            });
            const result = await (0, properties_1.handleGetPropertyDefinitions)(session, {
                model: 'crm.lead',
                parent_id: 1,
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.definitions).toEqual(definitions);
            (0, vitest_1.expect)(result.definition_model).toBe('crm.team');
        });
        (0, vitest_1.it)('requires parent_id', async () => {
            const { session } = createMockSession();
            const result = await (0, properties_1.handleGetPropertyDefinitions)(session, {
                model: 'crm.lead',
            });
            (0, vitest_1.expect)(result.success).toBe(false);
            (0, vitest_1.expect)(result.message).toContain('parent_id required');
        });
        (0, vitest_1.it)('returns error for unknown model', async () => {
            const { session } = createMockSession();
            const result = await (0, properties_1.handleGetPropertyDefinitions)(session, {
                model: 'unknown.model',
                parent_id: 1,
            });
            (0, vitest_1.expect)(result.success).toBe(false);
            (0, vitest_1.expect)(result.message).toContain('No property definition mapping known');
        });
    });
    (0, vitest_1.describe)('handleSetPropertyDefinitions', () => {
        (0, vitest_1.it)('sets definitions in replace mode', async () => {
            const { session, client } = createMockSession();
            const newDefinitions = [{ name: 'status', string: 'Status', type: 'selection' }];
            const result = await (0, properties_1.handleSetPropertyDefinitions)(session, {
                definition_model: 'crm.team',
                definition_id: 1,
                definitions: newDefinitions,
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(client.write).toHaveBeenCalledWith('crm.team', [1], {
                lead_properties_definition: newDefinitions,
            });
        });
        (0, vitest_1.it)('merges definitions in merge mode', async () => {
            const existingDefinitions = [
                { name: 'priority', string: 'Priority', type: 'selection' },
                { name: 'score', string: 'Score', type: 'integer' },
            ];
            const { session, client } = createMockSession({
                read: vitest_1.vi.fn().mockResolvedValue([{ lead_properties_definition: existingDefinitions }]),
            });
            const newDefinitions = [
                { name: 'priority', string: 'Updated Priority', type: 'selection' },
                { name: 'new_field', string: 'New Field', type: 'char' },
            ];
            const result = await (0, properties_1.handleSetPropertyDefinitions)(session, {
                definition_model: 'crm.team',
                definition_id: 1,
                definitions: newDefinitions,
                mode: 'merge',
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.property_count).toBe(3);
            // Should have merged: updated priority, kept score, added new_field
            (0, vitest_1.expect)(client.write).toHaveBeenCalledWith('crm.team', [1], vitest_1.expect.objectContaining({
                lead_properties_definition: vitest_1.expect.arrayContaining([
                    vitest_1.expect.objectContaining({ name: 'priority', string: 'Updated Priority' }),
                    vitest_1.expect.objectContaining({ name: 'score' }),
                    vitest_1.expect.objectContaining({ name: 'new_field' }),
                ]),
            }));
        });
        (0, vitest_1.it)('validates property types', async () => {
            const { session } = createMockSession();
            const result = await (0, properties_1.handleSetPropertyDefinitions)(session, {
                definition_model: 'crm.team',
                definition_id: 1,
                definitions: [
                    // @ts-expect-error Testing invalid type
                    { name: 'test', string: 'Test', type: 'invalid_type' },
                ],
            });
            (0, vitest_1.expect)(result.success).toBe(false);
        });
    });
});
//# sourceMappingURL=properties.test.js.map