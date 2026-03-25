import { describe, it, expect } from 'vitest';
import type { OdooField } from '@marcfargas/odoo-introspection';
import {
  getExportableFields,
  extractMany2oneRefs,
  normalizeMany2oneId,
  normalizeRecord,
  getSelfReferentialFields,
} from '../../src/clone/fields';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeField(overrides: Partial<OdooField>): OdooField {
  return {
    id: 1,
    name: 'test_field',
    field_description: 'Test Field',
    ttype: 'char',
    required: false,
    readonly: false,
    model: 'res.partner',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// normalizeMany2oneId
// ---------------------------------------------------------------------------

describe('normalizeMany2oneId()', () => {
  it('extracts id from [id, name] tuple', () => {
    expect(normalizeMany2oneId([42, 'Acme Corp'])).toBe(42);
  });

  it('passes through plain numeric id', () => {
    expect(normalizeMany2oneId(42)).toBe(42);
  });

  it('returns null for false', () => {
    expect(normalizeMany2oneId(false)).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(normalizeMany2oneId(null)).toBeNull();
    expect(normalizeMany2oneId(undefined)).toBeNull();
  });

  it('returns null for zero', () => {
    expect(normalizeMany2oneId(0)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getExportableFields
// ---------------------------------------------------------------------------

describe('getExportableFields()', () => {
  it('includes regular writable fields', () => {
    const fields = [
      makeField({ name: 'name', ttype: 'char' }),
      makeField({ name: 'active', ttype: 'boolean' }),
    ];
    expect(getExportableFields(fields)).toEqual(['name', 'active']);
  });

  it('excludes system fields', () => {
    const fields = [
      makeField({ name: 'id', ttype: 'integer' }),
      makeField({ name: 'create_date', ttype: 'datetime' }),
      makeField({ name: 'write_uid', ttype: 'many2one' }),
      makeField({ name: 'display_name', ttype: 'char' }),
      makeField({ name: 'name', ttype: 'char' }),
    ];
    expect(getExportableFields(fields)).toEqual(['name']);
  });

  it('excludes computed fields', () => {
    const fields = [
      makeField({ name: 'name', ttype: 'char' }),
      makeField({ name: 'full_name', ttype: 'char', compute: '_compute_full_name' }),
    ];
    expect(getExportableFields(fields)).toEqual(['name']);
  });

  it('excludes one2many fields', () => {
    const fields = [
      makeField({ name: 'name', ttype: 'char' }),
      makeField({ name: 'child_ids', ttype: 'one2many', relation: 'res.partner' }),
    ];
    expect(getExportableFields(fields)).toEqual(['name']);
  });

  it('excludes binary fields by default', () => {
    const fields = [
      makeField({ name: 'name', ttype: 'char' }),
      makeField({ name: 'image_128', ttype: 'binary' }),
    ];
    expect(getExportableFields(fields)).toEqual(['name']);
  });

  it('includes binary fields when includeBinaryFields is true', () => {
    const fields = [
      makeField({ name: 'name', ttype: 'char' }),
      makeField({ name: 'image_128', ttype: 'binary' }),
    ];
    expect(getExportableFields(fields, { includeBinaryFields: true })).toEqual([
      'name',
      'image_128',
    ]);
  });

  it('excludes explicitly excluded fields', () => {
    const fields = [
      makeField({ name: 'name', ttype: 'char' }),
      makeField({ name: 'message_ids', ttype: 'many2many' }),
    ];
    expect(getExportableFields(fields, { excludeFields: ['message_ids'] })).toEqual(['name']);
  });

  it('excludes readonly fields', () => {
    const fields = [
      makeField({ name: 'name', ttype: 'char' }),
      makeField({ name: 'credit_limit', ttype: 'float', readonly: true }),
    ];
    expect(getExportableFields(fields)).toEqual(['name']);
  });

  it('excludes always-excluded mail/activity fields', () => {
    const fields = [
      makeField({ name: 'name', ttype: 'char' }),
      makeField({ name: 'message_follower_ids', ttype: 'many2many' }),
      makeField({ name: 'message_partner_ids', ttype: 'many2many' }),
      makeField({ name: 'activity_ids', ttype: 'one2many' }),
      makeField({ name: 'message_ids', ttype: 'one2many' }),
    ];
    expect(getExportableFields(fields)).toEqual(['name']);
  });

  it('keeps many2one and many2many fields', () => {
    const fields = [
      makeField({ name: 'partner_id', ttype: 'many2one', relation: 'res.partner' }),
      makeField({ name: 'tag_ids', ttype: 'many2many', relation: 'res.partner.category' }),
    ];
    const result = getExportableFields(fields);
    expect(result).toEqual(['partner_id', 'tag_ids']);
  });
});

// ---------------------------------------------------------------------------
// extractMany2oneRefs
// ---------------------------------------------------------------------------

describe('extractMany2oneRefs()', () => {
  it('extracts refs from many2one fields', () => {
    const fields = [
      makeField({ name: 'partner_id', ttype: 'many2one', relation: 'res.partner' }),
      makeField({ name: 'name', ttype: 'char' }),
    ];
    const record = { partner_id: [42, 'Acme'], name: 'Test' };
    const refs = extractMany2oneRefs(record, fields);
    expect(refs).toEqual([{ model: 'res.partner', id: 42 }]);
  });

  it('skips false/null many2one values', () => {
    const fields = [makeField({ name: 'parent_id', ttype: 'many2one', relation: 'res.partner' })];
    const record = { parent_id: false };
    expect(extractMany2oneRefs(record, fields)).toEqual([]);
  });

  it('handles numeric many2one values', () => {
    const fields = [makeField({ name: 'partner_id', ttype: 'many2one', relation: 'res.partner' })];
    const record = { partner_id: 7 };
    expect(extractMany2oneRefs(record, fields)).toEqual([{ model: 'res.partner', id: 7 }]);
  });

  it('ignores fields without relation', () => {
    const fields = [
      makeField({ name: 'partner_id', ttype: 'many2one' }), // no relation
    ];
    const record = { partner_id: [42, 'Acme'] };
    expect(extractMany2oneRefs(record, fields)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// normalizeRecord
// ---------------------------------------------------------------------------

describe('normalizeRecord()', () => {
  it('normalizes many2one tuples to plain ids', () => {
    const fields = [
      makeField({ name: 'partner_id', ttype: 'many2one', relation: 'res.partner' }),
      makeField({ name: 'name', ttype: 'char' }),
    ];
    const record = { partner_id: [42, 'Acme'], name: 'Test' };
    const result = normalizeRecord(record, fields);
    expect(result).toEqual({ partner_id: 42, name: 'Test' });
  });

  it('normalizes false many2one to false', () => {
    const fields = [makeField({ name: 'parent_id', ttype: 'many2one', relation: 'res.partner' })];
    const record = { parent_id: false };
    const result = normalizeRecord(record, fields);
    expect(result).toEqual({ parent_id: false });
  });

  it('does not mutate the input', () => {
    const fields = [makeField({ name: 'partner_id', ttype: 'many2one', relation: 'res.partner' })];
    const record = { partner_id: [42, 'Acme'] };
    normalizeRecord(record, fields);
    expect(record.partner_id).toEqual([42, 'Acme']);
  });
});

// ---------------------------------------------------------------------------
// getSelfReferentialFields
// ---------------------------------------------------------------------------

describe('getSelfReferentialFields()', () => {
  it('identifies self-referential many2one fields', () => {
    const fields = [
      makeField({
        name: 'parent_id',
        ttype: 'many2one',
        relation: 'res.partner',
        model: 'res.partner',
      }),
      makeField({
        name: 'company_id',
        ttype: 'many2one',
        relation: 'res.company',
        model: 'res.partner',
      }),
      makeField({ name: 'name', ttype: 'char', model: 'res.partner' }),
    ];
    expect(getSelfReferentialFields('res.partner', fields)).toEqual(['parent_id']);
  });

  it('returns empty array when no self-refs exist', () => {
    const fields = [makeField({ name: 'company_id', ttype: 'many2one', relation: 'res.company' })];
    expect(getSelfReferentialFields('res.partner', fields)).toEqual([]);
  });
});
