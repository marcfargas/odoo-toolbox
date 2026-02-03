"use strict";
/**
 * Unit tests for code generation modules.
 *
 * Tests type mapping, field handling, and code formatting.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const type_mappers_1 = require("../src/codegen/type-mappers");
const formatter_1 = require("../src/codegen/formatter");
describe('Type Mappers', () => {
    describe('mapFieldType', () => {
        it('maps primitive string types', () => {
            expect((0, type_mappers_1.mapFieldType)({ ttype: 'char' })).toBe('string');
            expect((0, type_mappers_1.mapFieldType)({ ttype: 'text' })).toBe('string');
            expect((0, type_mappers_1.mapFieldType)({ ttype: 'html' })).toBe('string');
        });
        it('maps numeric types', () => {
            expect((0, type_mappers_1.mapFieldType)({ ttype: 'integer' })).toBe('number');
            expect((0, type_mappers_1.mapFieldType)({ ttype: 'float' })).toBe('number');
            expect((0, type_mappers_1.mapFieldType)({ ttype: 'monetary' })).toBe('number');
        });
        it('maps boolean type', () => {
            expect((0, type_mappers_1.mapFieldType)({ ttype: 'boolean' })).toBe('boolean');
        });
        it('maps date/time types to string (ISO format)', () => {
            expect((0, type_mappers_1.mapFieldType)({ ttype: 'date' })).toBe('string');
            expect((0, type_mappers_1.mapFieldType)({ ttype: 'datetime' })).toBe('string');
        });
        it('maps relational types', () => {
            expect((0, type_mappers_1.mapFieldType)({ ttype: 'many2one' })).toBe('number');
            expect((0, type_mappers_1.mapFieldType)({ ttype: 'one2many' })).toBe('number[]');
            expect((0, type_mappers_1.mapFieldType)({ ttype: 'many2many' })).toBe('number[]');
        });
        it('maps special types', () => {
            expect((0, type_mappers_1.mapFieldType)({ ttype: 'selection' })).toBe('string');
            expect((0, type_mappers_1.mapFieldType)({ ttype: 'binary' })).toBe('string');
        });
        it('defaults to any for unknown types', () => {
            expect((0, type_mappers_1.mapFieldType)({ ttype: 'unknown' })).toBe('any');
        });
    });
    describe('getFieldTypeExpression', () => {
        it('returns base type for required fields', () => {
            const field = {
                name: 'name',
                field_description: 'Name',
                ttype: 'char',
                required: true,
                readonly: false,
                id: 1,
                model: 'res.partner',
            };
            expect((0, type_mappers_1.getFieldTypeExpression)(field)).toBe('string');
        });
        it('adds undefined for optional fields', () => {
            const field = {
                name: 'description',
                field_description: 'Description',
                ttype: 'text',
                required: false,
                readonly: false,
                id: 1,
                model: 'res.partner',
            };
            expect((0, type_mappers_1.getFieldTypeExpression)(field)).toBe('string | undefined');
        });
        it('handles optional relational fields', () => {
            const field = {
                name: 'partner_id',
                field_description: 'Partner',
                ttype: 'many2one',
                relation: 'res.partner',
                required: false,
                readonly: false,
                id: 1,
                model: 'sale.order',
            };
            expect((0, type_mappers_1.getFieldTypeExpression)(field)).toBe('number | undefined');
        });
        it('handles required arrays', () => {
            const field = {
                name: 'line_ids',
                field_description: 'Lines',
                ttype: 'one2many',
                relation: 'sale.order.line',
                required: true,
                readonly: false,
                id: 1,
                model: 'sale.order',
            };
            expect((0, type_mappers_1.getFieldTypeExpression)(field)).toBe('number[]');
        });
    });
    describe('isWritableField', () => {
        it('excludes system fields', () => {
            const systemFields = [
                'id',
                'create_date',
                'create_uid',
                'write_date',
                'write_uid',
                '__last_update',
            ];
            for (const fieldName of systemFields) {
                const field = {
                    name: fieldName,
                    field_description: 'System',
                    ttype: 'integer',
                    required: false,
                    readonly: false,
                    id: 1,
                    model: 'res.partner',
                };
                expect((0, type_mappers_1.isWritableField)(field)).toBe(false);
            }
        });
        it('excludes readonly fields', () => {
            const field = {
                name: 'total',
                field_description: 'Total',
                ttype: 'float',
                required: false,
                readonly: true,
                id: 1,
                model: 'sale.order',
            };
            expect((0, type_mappers_1.isWritableField)(field)).toBe(false);
        });
        it('includes writable fields', () => {
            const field = {
                name: 'name',
                field_description: 'Name',
                ttype: 'char',
                required: true,
                readonly: false,
                id: 1,
                model: 'res.partner',
            };
            expect((0, type_mappers_1.isWritableField)(field)).toBe(true);
        });
    });
    describe('generateFieldJSDoc', () => {
        it('generates JSDoc with field description', () => {
            const field = {
                name: 'name',
                field_description: 'Partner Name',
                ttype: 'char',
                required: true,
                readonly: false,
                id: 1,
                model: 'res.partner',
            };
            const doc = (0, type_mappers_1.generateFieldJSDoc)(field);
            expect(doc).toContain('Partner Name');
            expect(doc).toContain('@required');
        });
        it('includes help text if available', () => {
            const field = {
                name: 'email',
                field_description: 'Email',
                ttype: 'char',
                required: false,
                readonly: false,
                help: 'Email address for communications',
                id: 1,
                model: 'res.partner',
            };
            const doc = (0, type_mappers_1.generateFieldJSDoc)(field);
            expect(doc).toContain('Email address for communications');
        });
        it('marks readonly fields', () => {
            const field = {
                name: 'state',
                field_description: 'State',
                ttype: 'selection',
                required: false,
                readonly: true,
                compute: '_compute_state',
                id: 1,
                model: 'sale.order',
            };
            const doc = (0, type_mappers_1.generateFieldJSDoc)(field);
            expect(doc).toContain('@readonly');
        });
        it('includes relation for relational fields', () => {
            const field = {
                name: 'partner_id',
                field_description: 'Customer',
                ttype: 'many2one',
                relation: 'res.partner',
                required: true,
                readonly: false,
                id: 1,
                model: 'sale.order',
            };
            const doc = (0, type_mappers_1.generateFieldJSDoc)(field);
            expect(doc).toContain('@relation res.partner');
        });
    });
});
describe('Code Formatter', () => {
    describe('modelNameToInterfaceName', () => {
        it('converts simple model names', () => {
            expect((0, formatter_1.modelNameToInterfaceName)('res.partner')).toBe('ResPartner');
            expect((0, formatter_1.modelNameToInterfaceName)('sale.order')).toBe('SaleOrder');
            expect((0, formatter_1.modelNameToInterfaceName)('project.project')).toBe('ProjectProject');
        });
        it('handles multi-segment names', () => {
            expect((0, formatter_1.modelNameToInterfaceName)('account.move.line')).toBe('AccountMoveLine');
            expect((0, formatter_1.modelNameToInterfaceName)('stock.picking.type')).toBe('StockPickingType');
        });
        it('capitalizes each segment', () => {
            expect((0, formatter_1.modelNameToInterfaceName)('ir.model')).toBe('IrModel');
            expect((0, formatter_1.modelNameToInterfaceName)('web.unseen.notification')).toBe('WebUnseenNotification');
        });
    });
    describe('generateModelInterface', () => {
        it('generates interface with all fields', () => {
            const metadata = {
                model: {
                    id: 1,
                    model: 'res.partner',
                    name: 'Contact',
                    transient: false,
                },
                fields: [
                    {
                        id: 1,
                        model: 'res.partner',
                        name: 'id',
                        field_description: 'ID',
                        ttype: 'integer',
                        required: true,
                        readonly: false,
                    },
                    {
                        id: 2,
                        model: 'res.partner',
                        name: 'name',
                        field_description: 'Name',
                        ttype: 'char',
                        required: true,
                        readonly: false,
                    },
                    {
                        id: 3,
                        model: 'res.partner',
                        name: 'email',
                        field_description: 'Email',
                        ttype: 'char',
                        required: false,
                        readonly: false,
                    },
                ],
            };
            const code = (0, formatter_1.generateModelInterface)(metadata);
            expect(code).toContain('export interface ResPartner');
            expect(code).toContain('id: number;');
            expect(code).toContain('name: string;');
            expect(code).toContain('email?: string | undefined;');
        });
        it('includes method signatures as comments', () => {
            const metadata = {
                model: {
                    id: 1,
                    model: 'res.partner',
                    name: 'Contact',
                    transient: false,
                },
                fields: [
                    {
                        id: 1,
                        model: 'res.partner',
                        name: 'id',
                        field_description: 'ID',
                        ttype: 'integer',
                        required: true,
                        readonly: false,
                    },
                ],
            };
            const code = (0, formatter_1.generateModelInterface)(metadata);
            expect(code).toContain('// search(domain: any[]): Promise<number[]>');
            expect(code).toContain('// read(ids: number[], fields?: string[]): Promise<ResPartner[]>');
            expect(code).toContain('// create(values: Partial<ResPartner>): Promise<number>');
            expect(code).toContain('// write(ids: number[], values: Partial<ResPartner>): Promise<boolean>');
            expect(code).toContain('// unlink(ids: number[]): Promise<boolean>');
        });
    });
    describe('generateCompleteFile', () => {
        it('generates file header', () => {
            const code = (0, formatter_1.generateCompleteFile)([]);
            expect(code).toContain('Auto-generated TypeScript interfaces for Odoo models');
            expect(code).toContain('DO NOT edit manually');
            expect(code).toContain('npm run generate');
        });
        it('includes all model interfaces', () => {
            const metadata1 = {
                model: { id: 1, model: 'res.partner', name: 'Contact', transient: false },
                fields: [
                    {
                        id: 1,
                        model: 'res.partner',
                        name: 'id',
                        field_description: 'ID',
                        ttype: 'integer',
                        required: true,
                        readonly: false,
                    },
                ],
            };
            const metadata2 = {
                model: { id: 2, model: 'sale.order', name: 'Order', transient: false },
                fields: [
                    {
                        id: 1,
                        model: 'sale.order',
                        name: 'id',
                        field_description: 'ID',
                        ttype: 'integer',
                        required: true,
                        readonly: false,
                    },
                ],
            };
            const code = (0, formatter_1.generateCompleteFile)([metadata1, metadata2]);
            expect(code).toContain('export interface ResPartner');
            expect(code).toContain('export interface SaleOrder');
            expect(code).toContain('export type { ResPartner }');
            expect(code).toContain('export type { SaleOrder }');
        });
    });
    describe('generateHelperTypes', () => {
        it('generates SearchOptions interface', () => {
            const code = (0, formatter_1.generateHelperTypes)();
            expect(code).toContain('export interface SearchOptions');
            expect(code).toContain('domain?: any[]');
            expect(code).toContain('order?: string');
            expect(code).toContain('limit?: number');
        });
        it('generates ReadOptions interface', () => {
            const code = (0, formatter_1.generateHelperTypes)();
            expect(code).toContain('export interface ReadOptions');
            expect(code).toContain('fields?: string[]');
            expect(code).toContain('context?: Record<string, any>');
        });
        it('generates operation options interfaces', () => {
            const code = (0, formatter_1.generateHelperTypes)();
            expect(code).toContain('export interface CreateOptions');
            expect(code).toContain('export interface WriteOptions');
            expect(code).toContain('export interface UnlinkOptions');
        });
    });
});
//# sourceMappingURL=codegen.test.js.map