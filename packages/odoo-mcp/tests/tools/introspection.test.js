"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const introspection_1 = require("../../src/tools/introspection");
// Mock introspection module
vitest_1.vi.mock('@odoo-toolbox/introspection', () => ({
    CodeGenerator: class MockCodeGenerator {
        async generate() {
            return '// Generated TypeScript\nexport interface ResPartner {}';
        }
    },
    generateCompleteFile: () => 'export interface ResPartner {}',
    generateHelperTypes: () => '// Helper types',
}));
// Create mock session with mock introspector
const createMockSession = (introspectorMethods = {}) => {
    const mockIntrospector = {
        getModels: vitest_1.vi.fn().mockResolvedValue([
            { model: 'res.partner', name: 'Contact', transient: false, id: 1 },
            { model: 'res.users', name: 'Users', transient: false, id: 2 },
        ]),
        getFields: vitest_1.vi.fn().mockResolvedValue([
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
        getModelMetadata: vitest_1.vi.fn().mockResolvedValue({
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
        getIntrospector: vitest_1.vi.fn().mockReturnValue(mockIntrospector),
        getClient: vitest_1.vi.fn().mockReturnValue(mockClient),
        isAuthenticated: vitest_1.vi.fn().mockReturnValue(true),
    };
    return { session: mockSession, introspector: mockIntrospector };
};
(0, vitest_1.describe)('Introspection Tools', () => {
    (0, vitest_1.describe)('handleGetModels', () => {
        (0, vitest_1.it)('returns list of models', async () => {
            const { session } = createMockSession();
            const result = await (0, introspection_1.handleGetModels)(session, {});
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.models).toHaveLength(2);
            (0, vitest_1.expect)(result.count).toBe(2);
            (0, vitest_1.expect)(result.models[0].model).toBe('res.partner');
        });
        (0, vitest_1.it)('passes includeTransient option', async () => {
            const { session, introspector } = createMockSession();
            await (0, introspection_1.handleGetModels)(session, { includeTransient: true });
            (0, vitest_1.expect)(introspector.getModels).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ includeTransient: true }));
        });
        (0, vitest_1.it)('passes modules filter', async () => {
            const { session, introspector } = createMockSession();
            await (0, introspection_1.handleGetModels)(session, { modules: ['sale', 'project'] });
            (0, vitest_1.expect)(introspector.getModels).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ modules: ['sale', 'project'] }));
        });
        (0, vitest_1.it)('passes bypassCache option', async () => {
            const { session, introspector } = createMockSession();
            await (0, introspection_1.handleGetModels)(session, { bypassCache: true });
            (0, vitest_1.expect)(introspector.getModels).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ bypassCache: true }));
        });
    });
    (0, vitest_1.describe)('handleGetFields', () => {
        (0, vitest_1.it)('returns fields for model', async () => {
            const { session } = createMockSession();
            const result = await (0, introspection_1.handleGetFields)(session, { model: 'res.partner' });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.fields).toHaveLength(2);
            (0, vitest_1.expect)(result.fields[0].name).toBe('name');
        });
        (0, vitest_1.it)('returns error for empty model', async () => {
            const { session } = createMockSession();
            const result = await (0, introspection_1.handleGetFields)(session, { model: '' });
            (0, vitest_1.expect)(result.success).toBe(false);
            (0, vitest_1.expect)(result.error.code).toBe('INVALID_INPUT');
        });
        (0, vitest_1.it)('passes bypassCache option', async () => {
            const { session, introspector } = createMockSession();
            await (0, introspection_1.handleGetFields)(session, { model: 'res.partner', bypassCache: true });
            (0, vitest_1.expect)(introspector.getFields).toHaveBeenCalledWith('res.partner', vitest_1.expect.objectContaining({ bypassCache: true }));
        });
    });
    (0, vitest_1.describe)('handleGetModelMetadata', () => {
        (0, vitest_1.it)('returns model with fields', async () => {
            const { session } = createMockSession();
            const result = await (0, introspection_1.handleGetModelMetadata)(session, { model: 'res.partner' });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.metadata.model.model).toBe('res.partner');
            (0, vitest_1.expect)(result.metadata.fields).toHaveLength(1);
        });
        (0, vitest_1.it)('includes field count in message', async () => {
            const { session } = createMockSession();
            const result = await (0, introspection_1.handleGetModelMetadata)(session, { model: 'res.partner' });
            (0, vitest_1.expect)(result.message).toContain('1 fields');
        });
    });
    (0, vitest_1.describe)('handleGenerateTypes', () => {
        (0, vitest_1.it)('generates TypeScript for all models', async () => {
            const { session } = createMockSession();
            const result = await (0, introspection_1.handleGenerateTypes)(session, {});
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.typescript).toContain('interface');
        });
        (0, vitest_1.it)('generates TypeScript for specific models', async () => {
            const { session, introspector } = createMockSession();
            const result = await (0, introspection_1.handleGenerateTypes)(session, { models: ['res.partner'] });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.modelCount).toBe(1);
            (0, vitest_1.expect)(introspector.getModelMetadata).toHaveBeenCalledWith('res.partner');
        });
        (0, vitest_1.it)('passes includeTransient option', async () => {
            const { session } = createMockSession();
            const result = await (0, introspection_1.handleGenerateTypes)(session, { includeTransient: true });
            (0, vitest_1.expect)(result.success).toBe(true);
        });
    });
});
//# sourceMappingURL=introspection.test.js.map