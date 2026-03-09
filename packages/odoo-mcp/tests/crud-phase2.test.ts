import { describe, expect, it, vi } from 'vitest';
import type { OdooClient } from '@marcfargas/odoo-client';
import type { AuditWriter } from '../src/audit';
import { MAX_RESPONSE_BYTES } from '../src/limits';
import { DEFAULT_POLICY, type PolicyRule } from '../src/policy';
import { createCrudTools, type CrudToolContext, type ToolDefinition } from '../src/tools/crud';

const READ_WRITE_POLICY: PolicyRule[] = [{ model: '*', ops: ['read', 'write'] }];

function getTool(ctx: CrudToolContext, name: string): ToolDefinition {
  const tool = createCrudTools(ctx).find((t) => t.name === name);
  if (!tool) throw new Error(`Tool not found: ${name}`);
  return tool;
}

function getErrorText(result: Awaited<ReturnType<ToolDefinition['handler']>>): string {
  return (result.content?.[0] as { text?: string })?.text ?? '';
}

function makeCtx(overrides?: Partial<CrudToolContext>) {
  const client = {
    read: vi.fn().mockResolvedValue([{ id: 1, name: 'Test' }]),
    create: vi.fn().mockResolvedValue(42),
    write: vi.fn().mockResolvedValue(true),
    searchRead: vi.fn().mockResolvedValue([]),
    searchCount: vi.fn().mockResolvedValue(0),
  };

  const audit = { log: vi.fn().mockResolvedValue(undefined) };

  const ctx: CrudToolContext = {
    client: client as unknown as OdooClient,
    getPolicy: () => DEFAULT_POLICY,
    audit: audit as unknown as AuditWriter,
    userLogin: 'admin',
    ...overrides,
  };

  return { ctx, client, audit };
}

describe('Phase 2 CRUD tools', () => {
  describe('odoo_get', () => {
    it('returns records on valid call', async () => {
      const { ctx } = makeCtx();
      const tool = getTool(ctx, 'odoo_get');

      const result = await tool.handler({
        model: 'res.partner',
        ids: [1, 2],
        fields: ['id', 'name'],
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toEqual({ records: [{ id: 1, name: 'Test' }] });
    });

    it('returns VALIDATION_ERROR when ids are missing or not an array', async () => {
      const { ctx } = makeCtx();
      const tool = getTool(ctx, 'odoo_get');

      const missing = await tool.handler({ model: 'res.partner' });
      const wrongType = await tool.handler({ model: 'res.partner', ids: '1,2' });

      expect(getErrorText(missing)).toContain('VALIDATION_ERROR:');
      expect(getErrorText(wrongType)).toContain('VALIDATION_ERROR:');
    });

    it('returns VALIDATION_ERROR when ids contain non-positive integers', async () => {
      const { ctx } = makeCtx();
      const tool = getTool(ctx, 'odoo_get');

      const result = await tool.handler({ model: 'res.partner', ids: [1, 0, 3] });

      expect(getErrorText(result)).toContain('VALIDATION_ERROR:');
    });

    it('returns VALIDATION_ERROR when ids exceed 200', async () => {
      const { ctx } = makeCtx();
      const tool = getTool(ctx, 'odoo_get');

      const ids = Array.from({ length: 201 }, (_, i) => i + 1);
      const result = await tool.handler({ model: 'res.partner', ids });

      expect(getErrorText(result).startsWith('VALIDATION_ERROR:')).toBe(true);
    });

    it('returns POLICY_DENIED when read policy blocks model', async () => {
      const { ctx } = makeCtx({ getPolicy: () => [] });
      const tool = getTool(ctx, 'odoo_get');

      const result = await tool.handler({ model: 'res.partner', ids: [1] });

      expect(getErrorText(result)).toContain('POLICY_DENIED:');
    });

    it('returns OVERSIZE when payload is too large', async () => {
      const { ctx, client } = makeCtx();
      const tool = getTool(ctx, 'odoo_get');

      client.read.mockResolvedValue([{ id: 1, blob: 'x'.repeat(MAX_RESPONSE_BYTES) }]);
      const result = await tool.handler({ model: 'res.partner', ids: [1] });

      expect(getErrorText(result)).toContain('OVERSIZE:');
    });
  });

  describe('odoo_create', () => {
    it('returns created id and writes audit log on valid call', async () => {
      const { ctx, audit } = makeCtx({ getPolicy: () => READ_WRITE_POLICY });
      const tool = getTool(ctx, 'odoo_create');

      const result = await tool.handler({ model: 'res.partner', values: { name: 'New Partner' } });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toEqual({ id: 42 });
      expect(audit.log).toHaveBeenCalledTimes(1);
    });

    it('returns VALIDATION_ERROR when values are missing or empty', async () => {
      const { ctx } = makeCtx({ getPolicy: () => READ_WRITE_POLICY });
      const tool = getTool(ctx, 'odoo_create');

      const missing = await tool.handler({ model: 'res.partner' });
      const empty = await tool.handler({ model: 'res.partner', values: {} });

      expect(getErrorText(missing)).toContain('VALIDATION_ERROR:');
      expect(getErrorText(empty)).toContain('VALIDATION_ERROR:');
    });

    it('returns POLICY_DENIED when write policy blocks model', async () => {
      const { ctx } = makeCtx();
      const tool = getTool(ctx, 'odoo_create');

      const result = await tool.handler({ model: 'res.partner', values: { name: 'X' } });

      expect(getErrorText(result)).toContain('POLICY_DENIED:');
    });

    it('maps Odoo client create errors through formatMcpError', async () => {
      const { ctx, client } = makeCtx({ getPolicy: () => READ_WRITE_POLICY });
      const tool = getTool(ctx, 'odoo_create');

      client.create.mockRejectedValue(new Error('create exploded'));
      const result = await tool.handler({ model: 'res.partner', values: { name: 'X' } });

      expect(getErrorText(result)).toContain('RPC_ERROR:');
    });
  });

  describe('odoo_write', () => {
    it('returns success + updated count and writes audit log on valid call', async () => {
      const { ctx, audit } = makeCtx({ getPolicy: () => READ_WRITE_POLICY });
      const tool = getTool(ctx, 'odoo_write');

      const result = await tool.handler({
        model: 'res.partner',
        ids: [1, 2],
        values: { email: 'new@example.com' },
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toEqual({ success: true, updated: 2 });
      expect(audit.log).toHaveBeenCalledTimes(1);
    });

    it('returns VALIDATION_ERROR when ids are missing', async () => {
      const { ctx } = makeCtx({ getPolicy: () => READ_WRITE_POLICY });
      const tool = getTool(ctx, 'odoo_write');

      const result = await tool.handler({ model: 'res.partner', values: { name: 'X' } });

      expect(getErrorText(result)).toContain('VALIDATION_ERROR:');
    });

    it('returns VALIDATION_ERROR when ids exceed 200', async () => {
      const { ctx } = makeCtx({ getPolicy: () => READ_WRITE_POLICY });
      const tool = getTool(ctx, 'odoo_write');

      const ids = Array.from({ length: 201 }, (_, i) => i + 1);
      const result = await tool.handler({ model: 'res.partner', ids, values: { name: 'X' } });

      expect(getErrorText(result)).toContain('VALIDATION_ERROR:');
    });

    it('returns VALIDATION_ERROR when values are missing or empty', async () => {
      const { ctx } = makeCtx({ getPolicy: () => READ_WRITE_POLICY });
      const tool = getTool(ctx, 'odoo_write');

      const missing = await tool.handler({ model: 'res.partner', ids: [1] });
      const empty = await tool.handler({ model: 'res.partner', ids: [1], values: {} });

      expect(getErrorText(missing)).toContain('VALIDATION_ERROR:');
      expect(getErrorText(empty)).toContain('VALIDATION_ERROR:');
    });

    it('returns POLICY_DENIED when write policy blocks model', async () => {
      const { ctx } = makeCtx();
      const tool = getTool(ctx, 'odoo_write');

      const result = await tool.handler({ model: 'res.partner', ids: [1], values: { name: 'X' } });

      expect(getErrorText(result)).toContain('POLICY_DENIED:');
    });
  });
});
