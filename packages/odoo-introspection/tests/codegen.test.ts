/**
 * Unit tests for code generation modules.
 * 
 * Tests type mapping, field handling, and code formatting.
 */

import {
  mapFieldType,
  getFieldTypeExpression,
  isWritableField,
  generateFieldJSDoc,
} from '../src/codegen/type-mappers';
import {
  modelNameToInterfaceName,
  generateModelInterface,
  generateCompleteFile,
  generateHelperTypes,
} from '../src/codegen/formatter';
import { OdooField, ModelMetadata } from '../src/introspection/types';

describe('Type Mappers', () => {
  describe('mapFieldType', () => {
    it('maps primitive string types', () => {
      expect(mapFieldType({ ttype: 'char' } as OdooField)).toBe('string');
      expect(mapFieldType({ ttype: 'text' } as OdooField)).toBe('string');
      expect(mapFieldType({ ttype: 'html' } as OdooField)).toBe('string');
    });

    it('maps numeric types', () => {
      expect(mapFieldType({ ttype: 'integer' } as OdooField)).toBe('number');
      expect(mapFieldType({ ttype: 'float' } as OdooField)).toBe('number');
      expect(mapFieldType({ ttype: 'monetary' } as OdooField)).toBe('number');
    });

    it('maps boolean type', () => {
      expect(mapFieldType({ ttype: 'boolean' } as OdooField)).toBe('boolean');
    });

    it('maps date/time types to string (ISO format)', () => {
      expect(mapFieldType({ ttype: 'date' } as OdooField)).toBe('string');
      expect(mapFieldType({ ttype: 'datetime' } as OdooField)).toBe('string');
    });

    it('maps relational types', () => {
      expect(mapFieldType({ ttype: 'many2one' } as OdooField)).toBe('number');
      expect(mapFieldType({ ttype: 'one2many' } as OdooField)).toBe('number[]');
      expect(mapFieldType({ ttype: 'many2many' } as OdooField)).toBe('number[]');
    });

    it('maps special types', () => {
      expect(mapFieldType({ ttype: 'selection' } as OdooField)).toBe('string');
      expect(mapFieldType({ ttype: 'binary' } as OdooField)).toBe('string');
    });

    it('defaults to any for unknown types', () => {
      expect(mapFieldType({ ttype: 'unknown' } as OdooField)).toBe('any');
    });
  });

  describe('getFieldTypeExpression', () => {
    it('returns base type for required fields', () => {
      const field: OdooField = {
        name: 'name',
        field_description: 'Name',
        ttype: 'char',
        required: true,
        readonly: false,
        id: 1,
        model: 'res.partner',
      };
      expect(getFieldTypeExpression(field)).toBe('string');
    });

    it('adds undefined for optional fields', () => {
      const field: OdooField = {
        name: 'description',
        field_description: 'Description',
        ttype: 'text',
        required: false,
        readonly: false,
        id: 1,
        model: 'res.partner',
      };
      expect(getFieldTypeExpression(field)).toBe('string | undefined');
    });

    it('handles optional relational fields', () => {
      const field: OdooField = {
        name: 'partner_id',
        field_description: 'Partner',
        ttype: 'many2one',
        relation: 'res.partner',
        required: false,
        readonly: false,
        id: 1,
        model: 'sale.order',
      };
      expect(getFieldTypeExpression(field)).toBe('number | undefined');
    });

    it('handles required arrays', () => {
      const field: OdooField = {
        name: 'line_ids',
        field_description: 'Lines',
        ttype: 'one2many',
        relation: 'sale.order.line',
        required: true,
        readonly: false,
        id: 1,
        model: 'sale.order',
      };
      expect(getFieldTypeExpression(field)).toBe('number[]');
    });
  });

  describe('isWritableField', () => {
    it('excludes system fields', () => {
      const systemFields = ['id', 'create_date', 'create_uid', 'write_date', 'write_uid', '__last_update'];
      for (const fieldName of systemFields) {
        const field: OdooField = {
          name: fieldName,
          field_description: 'System',
          ttype: 'integer',
          required: false,
          readonly: false,
          id: 1,
          model: 'res.partner',
        };
        expect(isWritableField(field)).toBe(false);
      }
    });

    it('excludes readonly fields', () => {
      const field: OdooField = {
        name: 'total',
        field_description: 'Total',
        ttype: 'float',
        required: false,
        readonly: true,
        id: 1,
        model: 'sale.order',
      };
      expect(isWritableField(field)).toBe(false);
    });

    it('includes writable fields', () => {
      const field: OdooField = {
        name: 'name',
        field_description: 'Name',
        ttype: 'char',
        required: true,
        readonly: false,
        id: 1,
        model: 'res.partner',
      };
      expect(isWritableField(field)).toBe(true);
    });
  });

  describe('generateFieldJSDoc', () => {
    it('generates JSDoc with field description', () => {
      const field: OdooField = {
        name: 'name',
        field_description: 'Partner Name',
        ttype: 'char',
        required: true,
        readonly: false,
        id: 1,
        model: 'res.partner',
      };
      const doc = generateFieldJSDoc(field);
      expect(doc).toContain('Partner Name');
      expect(doc).toContain('@required');
    });

    it('includes help text if available', () => {
      const field: OdooField = {
        name: 'email',
        field_description: 'Email',
        ttype: 'char',
        required: false,
        readonly: false,
        help: 'Email address for communications',
        id: 1,
        model: 'res.partner',
      };
      const doc = generateFieldJSDoc(field);
      expect(doc).toContain('Email address for communications');
    });

    it('marks readonly fields', () => {
      const field: OdooField = {
        name: 'state',
        field_description: 'State',
        ttype: 'selection',
        required: false,
        readonly: true,
        compute: '_compute_state',
        id: 1,
        model: 'sale.order',
      };
      const doc = generateFieldJSDoc(field);
      expect(doc).toContain('@readonly');
    });

    it('includes relation for relational fields', () => {
      const field: OdooField = {
        name: 'partner_id',
        field_description: 'Customer',
        ttype: 'many2one',
        relation: 'res.partner',
        required: true,
        readonly: false,
        id: 1,
        model: 'sale.order',
      };
      const doc = generateFieldJSDoc(field);
      expect(doc).toContain('@relation res.partner');
    });
  });
});

describe('Code Formatter', () => {
  describe('modelNameToInterfaceName', () => {
    it('converts simple model names', () => {
      expect(modelNameToInterfaceName('res.partner')).toBe('ResPartner');
      expect(modelNameToInterfaceName('sale.order')).toBe('SaleOrder');
      expect(modelNameToInterfaceName('project.project')).toBe('ProjectProject');
    });

    it('handles multi-segment names', () => {
      expect(modelNameToInterfaceName('account.move.line')).toBe('AccountMoveLine');
      expect(modelNameToInterfaceName('stock.picking.type')).toBe('StockPickingType');
    });

    it('capitalizes each segment', () => {
      expect(modelNameToInterfaceName('ir.model')).toBe('IrModel');
      expect(modelNameToInterfaceName('web.unseen.notification')).toBe('WebUnseenNotification');
    });
  });

  describe('generateModelInterface', () => {
    it('generates interface with all fields', () => {
      const metadata: ModelMetadata = {
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

      const code = generateModelInterface(metadata);
      expect(code).toContain('export interface ResPartner');
      expect(code).toContain('id: number;');
      expect(code).toContain('name: string;');
      expect(code).toContain('email?: string | undefined;');
    });

    it('includes method signatures as comments', () => {
      const metadata: ModelMetadata = {
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

      const code = generateModelInterface(metadata);
      expect(code).toContain('// search(domain: any[]): Promise<number[]>');
      expect(code).toContain('// read(ids: number[], fields?: string[]): Promise<ResPartner[]>');
      expect(code).toContain('// create(values: Partial<ResPartner>): Promise<number>');
      expect(code).toContain('// write(ids: number[], values: Partial<ResPartner>): Promise<boolean>');
      expect(code).toContain('// unlink(ids: number[]): Promise<boolean>');
    });
  });

  describe('generateCompleteFile', () => {
    it('generates file header', () => {
      const code = generateCompleteFile([]);
      expect(code).toContain('Auto-generated TypeScript interfaces for Odoo models');
      expect(code).toContain('DO NOT edit manually');
      expect(code).toContain('npm run generate');
    });

    it('includes all model interfaces', () => {
      const metadata1: ModelMetadata = {
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

      const metadata2: ModelMetadata = {
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

      const code = generateCompleteFile([metadata1, metadata2]);
      expect(code).toContain('export interface ResPartner');
      expect(code).toContain('export interface SaleOrder');
      expect(code).toContain('export type { ResPartner }');
      expect(code).toContain('export type { SaleOrder }');
    });
  });

  describe('generateHelperTypes', () => {
    it('generates SearchOptions interface', () => {
      const code = generateHelperTypes();
      expect(code).toContain('export interface SearchOptions');
      expect(code).toContain('domain?: any[]');
      expect(code).toContain('order?: string');
      expect(code).toContain('limit?: number');
    });

    it('generates ReadOptions interface', () => {
      const code = generateHelperTypes();
      expect(code).toContain('export interface ReadOptions');
      expect(code).toContain('fields?: string[]');
      expect(code).toContain('context?: Record<string, any>');
    });

    it('generates operation options interfaces', () => {
      const code = generateHelperTypes();
      expect(code).toContain('export interface CreateOptions');
      expect(code).toContain('export interface WriteOptions');
      expect(code).toContain('export interface UnlinkOptions');
    });
  });
});
