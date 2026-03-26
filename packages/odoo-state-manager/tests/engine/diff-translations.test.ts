import { describe, it, expect, vi } from 'vitest';
import { diffResources } from '../../src/engine/diff';
import type { ResolvedState, ResolvedResource } from '../../src/engine/types';
import type { OdooField } from '@marcfargas/odoo-introspection';

function makeClient(records: Record<string, Record<number, Record<string, unknown>>>) {
  return {
    read: vi.fn(
      async (
        model: string,
        ids: number[],
        _fields?: string[],
        context?: Record<string, unknown>
      ) => {
        const lang = context?.lang as string | undefined;
        const key = lang ? `${model}:${lang}` : model;
        const data = records[key] ?? records[model] ?? {};
        return ids.map((id) => ({ id, ...(data[id] ?? {}) }));
      }
    ),
  };
}

function makeIntrospector(fieldsMap: Record<string, OdooField[]> = {}) {
  return {
    getFields: vi.fn(async (model: string) => fieldsMap[model] ?? []),
  };
}

describe('diffResources with translations', () => {
  it('diffs translations per language for update mode resources', async () => {
    const resource: ResolvedResource = {
      original: {} as any,
      model: 'mail.template',
      mode: 'update',
      resolvedId: 10,
      resolvedValues: { subject: 'Hola' },
      translations: {
        entries: [{ field: 'subject', lang: 'en_UK', value: 'Hello!' }],
      },
    };

    const resolved: ResolvedState = { resources: [resource], policies: [] };

    const client = makeClient({
      'mail.template': { 10: { subject: 'Hola' } },
      'mail.template:en_UK': { 10: { subject: 'Hello' } },
    });

    const fields: OdooField[] = [
      {
        id: 1,
        name: 'subject',
        field_description: 'Subject',
        ttype: 'char',
        required: false,
        readonly: false,
        relation: '',
        help: '',
        selection: [],
        compute: '',
        model: 'mail.template',
      },
    ];

    const introspector = makeIntrospector({ 'mail.template': fields });

    const results = await diffResources(resolved, client, introspector);

    expect(results).toHaveLength(1);
    expect(results[0].changes).toEqual([]);
    expect(results[0].translationChanges).toEqual([
      { field: 'subject', lang: 'en_UK', desired: 'Hello!', actual: 'Hello' },
    ]);
    expect(results[0].hasChanges).toBe(true);
  });

  it('reports no changes when translations match', async () => {
    const resource: ResolvedResource = {
      original: {} as any,
      model: 'mail.template',
      mode: 'update',
      resolvedId: 10,
      resolvedValues: { subject: 'Hola' },
      translations: {
        entries: [{ field: 'subject', lang: 'en_UK', value: 'Hello' }],
      },
    };

    const resolved: ResolvedState = { resources: [resource], policies: [] };

    const client = makeClient({
      'mail.template': { 10: { subject: 'Hola' } },
      'mail.template:en_UK': { 10: { subject: 'Hello' } },
    });

    const fields: OdooField[] = [
      {
        id: 1,
        name: 'subject',
        field_description: 'Subject',
        ttype: 'char',
        required: false,
        readonly: false,
        relation: '',
        help: '',
        selection: [],
        compute: '',
        model: 'mail.template',
      },
    ];

    const introspector = makeIntrospector({ 'mail.template': fields });
    const results = await diffResources(resolved, client, introspector);

    expect(results[0].hasChanges).toBe(false);
    expect(results[0].translationChanges).toEqual([]);
  });

  it('includes translation changes for create mode resources', async () => {
    const resource: ResolvedResource = {
      original: {} as any,
      model: 'mail.template',
      mode: 'create',
      resolvedId: null,
      resolvedValues: { subject: 'Hola' },
      translations: {
        entries: [{ field: 'subject', lang: 'en_UK', value: 'Hello' }],
      },
    };

    const resolved: ResolvedState = { resources: [resource], policies: [] };
    const client = makeClient({});
    const introspector = makeIntrospector({});

    const results = await diffResources(resolved, client, introspector);
    expect(results[0].hasChanges).toBe(true);
    expect(results[0].translationChanges).toEqual([]);
  });
});
