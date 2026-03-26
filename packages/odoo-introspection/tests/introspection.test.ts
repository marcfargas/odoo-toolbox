import { describe, it, expect, vi } from 'vitest';
import type { OdooField } from '../src/introspection/types';
import { Introspector } from '../src/introspection/introspect';

function makeClient(
  fieldsGetResult: Record<string, Record<string, unknown>> = {},
  searchReadResult: any[] = []
) {
  return {
    searchRead: vi.fn().mockResolvedValue(searchReadResult),
    call: vi.fn().mockResolvedValue(fieldsGetResult),
  } as any;
}

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

describe('Introspector.getFieldAttributes', () => {
  it('calls fields_get and returns sanitize/translate attributes', async () => {
    const client = makeClient({
      body_html: {
        type: 'html',
        sanitize: true,
        sanitize_tags: true,
        sanitize_attributes: true,
        sanitize_style: false,
        sanitize_form: true,
        sanitize_overridable: false,
        strip_style: false,
        strip_classes: false,
        translate: false,
      },
      name: {
        type: 'char',
        translate: true,
      },
      active: {
        type: 'boolean',
        translate: false,
      },
    });

    const introspector = new Introspector(client);
    const attrs = await introspector.getFieldAttributes('mail.template');

    expect(client.call).toHaveBeenCalledWith('mail.template', 'fields_get', [], {
      attributes: [
        'type',
        'sanitize',
        'sanitize_tags',
        'sanitize_attributes',
        'sanitize_style',
        'sanitize_form',
        'sanitize_overridable',
        'strip_style',
        'strip_classes',
        'translate',
      ],
    });

    expect(attrs.get('body_html')).toEqual({
      sanitize: true,
      sanitize_tags: true,
      sanitize_attributes: true,
      sanitize_style: false,
      sanitize_form: true,
      sanitize_overridable: false,
      strip_style: false,
      strip_classes: false,
      translate: false,
    });

    expect(attrs.get('name')).toEqual({ translate: true });
    expect(attrs.get('active')).toEqual({ translate: false });
  });

  it('caches fields_get results per model', async () => {
    const client = makeClient({ name: { type: 'char', translate: true } });
    const introspector = new Introspector(client);

    await introspector.getFieldAttributes('res.partner');
    await introspector.getFieldAttributes('res.partner');

    expect(client.call).toHaveBeenCalledTimes(1);
  });

  it('returns empty map for models with no fields_get data', async () => {
    const client = makeClient({});
    const introspector = new Introspector(client);
    const attrs = await introspector.getFieldAttributes('empty.model');
    expect(attrs.size).toBe(0);
  });
});
