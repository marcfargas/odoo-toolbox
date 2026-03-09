import { describe, expect, it, vi } from 'vitest';
import type { OdooClient } from '@marcfargas/odoo-client';
import type { IrModelInfo, IrModuleInfo, McpCache } from '../src/cache';
import { DEFAULT_POLICY, type PolicyRule } from '../src/policy';
import { createDiscoveryTools, type DiscoveryToolContext } from '../src/tools/discovery';
import type { ToolDefinition } from '../src/tools/crud';

const READ_WRITE_POLICY: PolicyRule[] = [{ model: '*', ops: ['read', 'write'] }];

function getTool(ctx: DiscoveryToolContext, name: string): ToolDefinition {
  const tool = createDiscoveryTools(ctx).find((t) => t.name === name);
  if (!tool) throw new Error(`Tool not found: ${name}`);
  return tool;
}

function getErrorText(result: Awaited<ReturnType<ToolDefinition['handler']>>): string {
  return (result.content?.[0] as { text?: string })?.text ?? '';
}

function makeCtx(overrides?: Partial<DiscoveryToolContext>) {
  const client = {
    call: vi.fn(),
    searchRead: vi.fn(),
  };

  const cache = {
    getIrModels: vi.fn().mockResolvedValue([]),
    getIrModules: vi.fn().mockResolvedValue([]),
    getSchema: vi.fn(),
  };

  const ctx: DiscoveryToolContext = {
    client: client as unknown as OdooClient,
    getPolicy: () => DEFAULT_POLICY,
    cache: cache as unknown as McpCache,
    ...overrides,
  };

  return { ctx, client, cache };
}

function model(id: number, modelName: string, name: string, modules = ''): IrModelInfo {
  return { id, model: modelName, name, modules };
}

function moduleInfo(id: number, name: string, shortdesc: string, summary: string): IrModuleInfo {
  return { id, name, shortdesc, summary, category_id: false };
}

describe('Phase 2 discovery tools', () => {
  describe('odoo_discover', () => {
    it('returns VALIDATION_ERROR when query is empty', async () => {
      const { ctx } = makeCtx();
      const tool = getTool(ctx, 'odoo_discover');

      const result = await tool.handler({ query: '   ' });

      expect(getErrorText(result)).toContain('VALIDATION_ERROR:');
    });

    it('scores exact model match as 100 and ranks it first', async () => {
      const { ctx, cache } = makeCtx();
      const tool = getTool(ctx, 'odoo_discover');

      cache.getIrModels.mockResolvedValue([
        model(1, 'sale.order', 'Sales Order', 'sale'),
        model(2, 'sale.order.line', 'Sales Order Line', 'sale'),
      ]);
      cache.getIrModules.mockResolvedValue([moduleInfo(1, 'sale', 'Sales', 'order management')]);

      const result = await tool.handler({ query: 'sale.order', limit: 10 });
      const response = result.structuredContent as {
        results: Array<{ model: string; score: number }>;
      };

      expect(result.isError).toBeFalsy();
      expect(response.results[0]).toMatchObject({ model: 'sale.order', score: 100 });
    });

    it('scores model-name contains query as 60', async () => {
      const { ctx, cache } = makeCtx();
      const tool = getTool(ctx, 'odoo_discover');

      cache.getIrModels.mockResolvedValue([model(1, 'res.partner', 'Contact')]);
      cache.getIrModules.mockResolvedValue([]);

      const result = await tool.handler({ query: 'partner' });
      const response = result.structuredContent as {
        results: Array<{ model: string; score: number }>;
      };

      expect(response.results).toHaveLength(1);
      expect(response.results[0]).toMatchObject({ model: 'res.partner', score: 60 });
    });

    it('scores description contains query as 40', async () => {
      const { ctx, cache } = makeCtx();
      const tool = getTool(ctx, 'odoo_discover');

      cache.getIrModels.mockResolvedValue([model(1, 'account.move', 'Customer Invoice')]);
      cache.getIrModules.mockResolvedValue([]);

      const result = await tool.handler({ query: 'invoice' });
      const response = result.structuredContent as {
        results: Array<{ model: string; score: number }>;
      };

      expect(response.results[0]).toMatchObject({ model: 'account.move', score: 40 });
    });

    it('scores module blurb contains query as 20', async () => {
      const { ctx, cache } = makeCtx();
      const tool = getTool(ctx, 'odoo_discover');

      cache.getIrModels.mockResolvedValue([model(1, 'sale.order', 'Sales Order', 'sale')]);
      cache.getIrModules.mockResolvedValue([
        moduleInfo(1, 'sale', 'Sales', 'invoices stuff'),
        moduleInfo(2, 'crm', 'CRM', 'leads'),
      ]);

      const result = await tool.handler({ query: 'invoices' });
      const response = result.structuredContent as {
        results: Array<{ model: string; score: number }>;
      };

      expect(response.results[0]).toMatchObject({ model: 'sale.order', score: 20 });
    });

    it('adds model+description scores (60 + 40 = 100)', async () => {
      const { ctx, cache } = makeCtx();
      const tool = getTool(ctx, 'odoo_discover');

      cache.getIrModels.mockResolvedValue([model(1, 'sale.order', 'Sales Order')]);
      cache.getIrModules.mockResolvedValue([]);

      const result = await tool.handler({ query: 'sale' });
      const response = result.structuredContent as {
        results: Array<{ model: string; score: number }>;
      };

      expect(response.results[0]).toMatchObject({ model: 'sale.order', score: 100 });
    });

    it('excludes results below threshold (score < 20)', async () => {
      const { ctx, cache } = makeCtx();
      const tool = getTool(ctx, 'odoo_discover');

      cache.getIrModels.mockResolvedValue([
        model(1, 'sale.order', 'Sales Order', 'sale'),
        model(2, 'stock.picking', 'Transfers', 'stock'),
      ]);
      cache.getIrModules.mockResolvedValue([moduleInfo(1, 'sale', 'Sales', 'invoices stuff')]);

      const result = await tool.handler({ query: 'invoices' });
      const response = result.structuredContent as {
        results: Array<{ model: string; score: number }>;
      };

      expect(response.results).toHaveLength(1);
      expect(response.results[0]).toMatchObject({ model: 'sale.order', score: 20 });
    });

    it('respects limit parameter', async () => {
      const { ctx, cache } = makeCtx();
      const tool = getTool(ctx, 'odoo_discover');

      cache.getIrModels.mockResolvedValue([
        model(1, 'sale.order', 'Sales Order'),
        model(2, 'sale.order.line', 'Sales Order Line'),
        model(3, 'sale.report', 'Sales Report'),
      ]);
      cache.getIrModules.mockResolvedValue([]);

      const result = await tool.handler({ query: 'sale', limit: 2 });
      const response = result.structuredContent as {
        results: Array<{ model: string; score: number }>;
      };

      expect(response.results).toHaveLength(2);
    });
  });

  describe('odoo_model_info', () => {
    it('returns normalized field schema for a model', async () => {
      const { ctx, cache, client } = makeCtx({ getPolicy: () => READ_WRITE_POLICY });
      const tool = getTool(ctx, 'odoo_model_info');

      cache.getSchema.mockImplementation(async (_model: string, fetcher: () => Promise<unknown>) =>
        fetcher()
      );
      client.call.mockResolvedValue({
        name: {
          type: 'char',
          string: 'Name',
          required: true,
          readonly: false,
          help: 'Display name',
        },
        partner_id: {
          type: 'many2one',
          string: 'Partner',
          required: false,
          readonly: false,
          help: '',
          relation: 'res.partner',
        },
      });

      const result = await tool.handler({ model: 'sale.order' });
      const response = result.structuredContent as {
        model: string;
        fields: Array<{ name: string; type: string; string: string; required: boolean }>;
      };

      expect(result.isError).toBeFalsy();
      expect(response.model).toBe('sale.order');
      expect(response.fields).toEqual([
        {
          name: 'name',
          type: 'char',
          string: 'Name',
          required: true,
          readonly: false,
          help: 'Display name',
          selection: undefined,
          relation: undefined,
        },
        {
          name: 'partner_id',
          type: 'many2one',
          string: 'Partner',
          required: false,
          readonly: false,
          help: '',
          selection: undefined,
          relation: 'res.partner',
        },
      ]);
    });

    it('returns POLICY_DENIED when model read is blocked', async () => {
      const { ctx } = makeCtx({ getPolicy: () => [] });
      const tool = getTool(ctx, 'odoo_model_info');

      const result = await tool.handler({ model: 'sale.order' });

      expect(getErrorText(result)).toContain('POLICY_DENIED:');
    });
  });
});
