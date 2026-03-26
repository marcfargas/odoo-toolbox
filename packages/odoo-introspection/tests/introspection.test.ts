import { describe, it, expect } from 'vitest';
import type { OdooField } from '../src/introspection/types';

describe('OdooField extended attributes', () => {
  it('accepts sanitize attributes for html fields', () => {
    const field: OdooField = {
      id: 1,
      name: 'body_html',
      field_description: 'Body',
      ttype: 'html',
      required: false,
      readonly: false,
      relation: '',
      help: '',
      selection: [],
      compute: '',
      model: 'mail.template',
      sanitize: true,
      sanitize_tags: true,
      sanitize_attributes: true,
      sanitize_style: false,
      sanitize_form: true,
      sanitize_overridable: false,
      strip_style: false,
      strip_classes: false,
      translate: false,
    };
    expect(field.sanitize).toBe(true);
    expect(field.sanitize_style).toBe(false);
    expect(field.translate).toBe(false);
  });

  it('accepts translate attribute for char fields', () => {
    const field: OdooField = {
      id: 2,
      name: 'name',
      field_description: 'Name',
      ttype: 'char',
      required: true,
      readonly: false,
      relation: '',
      help: '',
      selection: [],
      compute: '',
      model: 'res.partner',
      translate: true,
    };
    expect(field.translate).toBe(true);
    expect(field.sanitize).toBeUndefined();
  });

  it('works without extended attributes (backward compat)', () => {
    const field: OdooField = {
      id: 3,
      name: 'name',
      field_description: 'Name',
      ttype: 'char',
      required: true,
      readonly: false,
      relation: '',
      help: '',
      selection: [],
      compute: '',
      model: 'res.partner',
    };
    expect(field.translate).toBeUndefined();
  });
});
