import { describe, expect, it, vi } from 'vitest';
import type { OdooClient } from '@marcfargas/odoo-client';
import type { McpCache } from '../src/cache';
import type { McpFieldSchema } from '../src/resources/schema';
import { DEFAULT_POLICY, type PolicyRule } from '../src/policy';
import { createNavigationTools, type NavigationToolContext } from '../src/tools/navigation';
import type { ToolDefinition } from '../src/tools/crud';

function getTool(ctx: NavigationToolContext, name: string): ToolDefinition {
  const tool = createNavigationTools(ctx).find((t) => t.name === name);
  if (!tool) throw new Error(`Tool not found: ${name}`);
  return tool;
}

function getErrorText(result: Awaited<ReturnType<ToolDefinition['handler']>>): string {
  return (result.content?.[0] as { text?: string })?.text ?? '';
}

function makeCtx(schema: McpFieldSchema[], policy: PolicyRule[] = DEFAULT_POLICY) {
  const client = {
    read: vi.fn(),
    call: vi.fn(),
  };

  const cache = {
    getSchema: vi.fn().mockResolvedValue(schema),
  };

  const ctx: NavigationToolContext = {
    client: client as unknown as OdooClient,
    cache: cache as unknown as McpCache,
    getPolicy: () => policy,
  };

  return { ctx, client, cache };
}

describe('odoo_get_related', () => {
  it('follows many2one tuple and returns target record', async () => {
    const { ctx, client } = makeCtx([
      {
        name: 'partner_id',
        type: 'many2one',
        relation: 'res.partner',
        string: 'Partner',
        required: false,
        readonly: false,
        help: '',
      },
    ]);
    const tool = getTool(ctx, 'odoo_get_related');

    client.read.mockImplementation(async (model: string) => {
      if (model === 'sale.order') return [{ partner_id: [42, 'Partner Name'] }];
      if (model === 'res.partner') return [{ id: 42, name: 'Partner Name' }];
      return [];
    });

    const result = await tool.handler({
      model: 'sale.order',
      id: 1,
      field: 'partner_id',
      fields: ['id', 'name'],
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      type: 'many2one',
      model: 'res.partner',
      record: { id: 42, name: 'Partner Name' },
    });
    expect(client.read).toHaveBeenCalledTimes(2);
  });

  it('returns record=null for many2one false value', async () => {
    const { ctx, client } = makeCtx([
      {
        name: 'partner_id',
        type: 'many2one',
        relation: 'res.partner',
        string: 'Partner',
        required: false,
        readonly: false,
        help: '',
      },
    ]);
    const tool = getTool(ctx, 'odoo_get_related');

    client.read.mockResolvedValue([{ partner_id: false }]);

    const result = await tool.handler({ model: 'sale.order', id: 1, field: 'partner_id' });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ type: 'many2one', record: null });
    expect(client.read).toHaveBeenCalledTimes(1);
  });

  it('returns one2many records and paginates with limit/offset slicing', async () => {
    const { ctx, client } = makeCtx([
      {
        name: 'order_line',
        type: 'one2many',
        relation: 'sale.order.line',
        string: 'Lines',
        required: false,
        readonly: false,
        help: '',
      },
    ]);
    const tool = getTool(ctx, 'odoo_get_related');

    client.read.mockImplementation(async (model: string, ids: number[]) => {
      if (model === 'sale.order') return [{ order_line: [10, 11, 12, 13] }];
      if (model === 'sale.order.line') {
        return ids.map((id) => ({ id, name: `Line ${id}` }));
      }
      return [];
    });

    const result = await tool.handler({
      model: 'sale.order',
      id: 1,
      field: 'order_line',
      fields: ['id', 'name'],
      limit: 2,
      offset: 1,
    });

    expect(result.isError).toBeFalsy();
    expect(client.read).toHaveBeenNthCalledWith(
      2,
      'sale.order.line',
      [11, 12],
      ['id', 'name'],
      undefined
    );
    expect(result.structuredContent).toEqual({
      type: 'one2many',
      model: 'sale.order.line',
      records: [
        { id: 11, name: 'Line 11' },
        { id: 12, name: 'Line 12' },
      ],
      pagination: {
        total: 4,
        offset: 1,
        limit: 2,
        hasMore: true,
      },
    });
  });

  it('returns many2many records with pagination shape', async () => {
    const { ctx, client } = makeCtx([
      {
        name: 'tag_ids',
        type: 'many2many',
        relation: 'crm.tag',
        string: 'Tags',
        required: false,
        readonly: false,
        help: '',
      },
    ]);
    const tool = getTool(ctx, 'odoo_get_related');

    client.read.mockImplementation(async (model: string, ids: number[]) => {
      if (model === 'crm.lead') return [{ tag_ids: [7, 8, 9] }];
      if (model === 'crm.tag') {
        return ids.map((id) => ({ id, name: `Tag ${id}` }));
      }
      return [];
    });

    const result = await tool.handler({ model: 'crm.lead', id: 1, field: 'tag_ids', limit: 2 });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      type: 'many2many',
      model: 'crm.tag',
      records: [
        { id: 7, name: 'Tag 7' },
        { id: 8, name: 'Tag 8' },
      ],
      pagination: {
        total: 3,
        offset: 0,
        limit: 2,
        hasMore: true,
      },
    });
  });

  it('returns empty records + pagination when one2many value is []', async () => {
    const { ctx, client } = makeCtx([
      {
        name: 'order_line',
        type: 'one2many',
        relation: 'sale.order.line',
        string: 'Lines',
        required: false,
        readonly: false,
        help: '',
      },
    ]);
    const tool = getTool(ctx, 'odoo_get_related');

    client.read.mockResolvedValue([{ order_line: [] }]);

    const result = await tool.handler({
      model: 'sale.order',
      id: 1,
      field: 'order_line',
      limit: 5,
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      type: 'one2many',
      model: 'sale.order.line',
      records: [],
      pagination: {
        total: 0,
        offset: 0,
        limit: 5,
        hasMore: false,
      },
    });
  });

  it('returns POLICY_DENIED when source model read is blocked', async () => {
    const { ctx } = makeCtx(
      [
        {
          name: 'partner_id',
          type: 'many2one',
          relation: 'res.partner',
          string: 'Partner',
          required: false,
          readonly: false,
          help: '',
        },
      ],
      []
    );
    const tool = getTool(ctx, 'odoo_get_related');

    const result = await tool.handler({ model: 'sale.order', id: 1, field: 'partner_id' });

    expect(getErrorText(result)).toContain('POLICY_DENIED:');
  });

  it('returns POLICY_DENIED when target model read is blocked', async () => {
    const policy: PolicyRule[] = [
      { model: 'sale.order', ops: ['read'] },
      { model: 'res.partner', ops: ['write'] },
      { model: '*', ops: ['read'] },
    ];

    const { ctx } = makeCtx(
      [
        {
          name: 'partner_id',
          type: 'many2one',
          relation: 'res.partner',
          string: 'Partner',
          required: false,
          readonly: false,
          help: '',
        },
      ],
      policy
    );
    const tool = getTool(ctx, 'odoo_get_related');

    const result = await tool.handler({ model: 'sale.order', id: 1, field: 'partner_id' });

    expect(getErrorText(result)).toContain('POLICY_DENIED:');
  });

  it('returns VALIDATION_ERROR when id is not a positive integer', async () => {
    const { ctx } = makeCtx([
      {
        name: 'partner_id',
        type: 'many2one',
        relation: 'res.partner',
        string: 'Partner',
        required: false,
        readonly: false,
        help: '',
      },
    ]);
    const tool = getTool(ctx, 'odoo_get_related');

    const result = await tool.handler({ model: 'sale.order', id: 0, field: 'partner_id' });

    expect(getErrorText(result)).toContain('VALIDATION_ERROR:');
  });

  it('returns VALIDATION_ERROR when field is not found in schema', async () => {
    const { ctx } = makeCtx([
      {
        name: 'partner_id',
        type: 'many2one',
        relation: 'res.partner',
        string: 'Partner',
        required: false,
        readonly: false,
        help: '',
      },
    ]);
    const tool = getTool(ctx, 'odoo_get_related');

    const result = await tool.handler({ model: 'sale.order', id: 1, field: 'missing_field' });

    expect(getErrorText(result)).toContain('VALIDATION_ERROR:');
  });

  it('returns VALIDATION_ERROR when field has no relation', async () => {
    const { ctx } = makeCtx([
      {
        name: 'name',
        type: 'char',
        string: 'Name',
        required: false,
        readonly: false,
        help: '',
      },
    ]);
    const tool = getTool(ctx, 'odoo_get_related');

    const result = await tool.handler({ model: 'sale.order', id: 1, field: 'name' });

    expect(getErrorText(result)).toContain('VALIDATION_ERROR:');
  });
});
