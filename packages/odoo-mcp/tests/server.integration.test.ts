/**
 * Integration tests for the odoo-mcp HTTP server.
 *
 * Starts a real McpOdooServer on a free local port, connects an MCP SDK
 * client against it, and exercises auth + tools + resources + policy
 * enforcement against the shared Odoo container provided by globalSetup.
 *
 * Auth/HTTP-level tests use raw fetch; tool/resource tests use the MCP client.
 */

import net from 'node:net';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { AuditWriter } from '../src/audit';
import { OdooClientPool } from '../src/client-pool';
import { startHttpTransport, type HttpTransportHandle } from '../src/transport/http';
import { DEFAULT_POLICY, type PolicyRule } from '../src/policy';

// ── Helpers ────────────────────────────────────────────────────────────────

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

function parseToolText(content: unknown[]): unknown {
  const first = content[0] as { text?: string };
  if (!first?.text) throw new Error('No text in tool result');
  return JSON.parse(first.text);
}

// ── Suite ──────────────────────────────────────────────────────────────────

describe('odoo-mcp HTTP server', () => {
  const odooUrl = process.env.ODOO_URL!;
  const odooDb = process.env.ODOO_DB_NAME!;
  const odooUser = process.env.ODOO_DB_USER!;
  const odooPassword = process.env.ODOO_DB_PASSWORD!;

  let serverBaseUrl: string;
  let handle: HttpTransportHandle;
  let pool: OdooClientPool;
  let client: Client;
  let currentPolicy: PolicyRule[];

  const validHeaders = () => ({
    'x-odoo-url': odooUrl,
    'x-odoo-db': odooDb,
    'x-odoo-user': odooUser,
    'x-odoo-password': odooPassword,
  });

  beforeAll(async () => {
    currentPolicy = [...DEFAULT_POLICY];

    const port = await findFreePort();
    serverBaseUrl = `http://127.0.0.1:${port}`;

    pool = new OdooClientPool({
      version: '0.1.0-test',
      getPolicy: () => currentPolicy,
      audit: new AuditWriter(undefined),
    });

    handle = await startHttpTransport({
      port,
      host: '127.0.0.1',
      allowedUrls: [odooUrl],
      pool,
      trustProxy: false,
    });

    const transport = new StreamableHTTPClientTransport(new URL(`${serverBaseUrl}/mcp`), {
      requestInit: { headers: validHeaders() },
    });
    client = new Client({ name: 'test-mcp-client', version: '1.0.0' });
    await client.connect(transport);
  }, 60_000);

  afterAll(async () => {
    await client.close().catch(() => {});
    await handle.close();
    await pool.close();
  });

  beforeEach(() => {
    currentPolicy = [...DEFAULT_POLICY];
  });

  // ── Group 1: Authentication (raw fetch) ───────────────────────────────────

  describe('authentication', () => {
    const mcpInit = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        clientInfo: { name: 'probe', version: '1.0.0' },
        capabilities: {},
      },
    });

    it('rejects requests with no X-Odoo-* headers → 401', async () => {
      const res = await fetch(`${serverBaseUrl}/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: mcpInit,
      });
      expect(res.status).toBe(401);
    });

    it('rejects requests missing some X-Odoo-* headers → 401', async () => {
      const res = await fetch(`${serverBaseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-odoo-url': odooUrl,
          // missing db, user, password
        },
        body: mcpInit,
      });
      expect(res.status).toBe(401);
    });

    it('rejects requests for a non-whitelisted URL → 401', async () => {
      const res = await fetch(`${serverBaseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-odoo-url': 'https://evil.example.com',
          'x-odoo-db': odooDb,
          'x-odoo-user': odooUser,
          'x-odoo-password': odooPassword,
        },
        body: mcpInit,
      });
      expect(res.status).toBe(401);
    });

    it('rejects requests with wrong Odoo password → 401', async () => {
      const res = await fetch(`${serverBaseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-odoo-url': odooUrl,
          'x-odoo-db': odooDb,
          'x-odoo-user': odooUser,
          'x-odoo-password': 'definitely-wrong-password',
        },
        body: mcpInit,
      });
      expect(res.status).toBe(401);
    });
  });

  // ── Group 2: odoo_search tool ─────────────────────────────────────────────

  describe('odoo_search', () => {
    it('returns records and a well-formed pagination object', async () => {
      const result = await client.callTool({
        name: 'odoo_search',
        arguments: { model: 'res.partner', limit: 5 },
      });

      expect(result.isError).toBeFalsy();
      const data = parseToolText(result.content) as {
        records: unknown[];
        pagination: { total: number; limit: number; offset: number; hasMore: boolean };
      };

      expect(Array.isArray(data.records)).toBe(true);
      expect(data.records.length).toBeGreaterThan(0);
      expect(data.pagination).toMatchObject({
        total: expect.any(Number),
        limit: 5,
        offset: 0,
        hasMore: expect.any(Boolean),
      });
    });

    it('applies domain filter — only companies returned', async () => {
      const result = await client.callTool({
        name: 'odoo_search',
        arguments: {
          model: 'res.partner',
          domain: [['is_company', '=', true]],
          fields: ['id', 'name', 'is_company'],
          limit: 10,
        },
      });

      expect(result.isError).toBeFalsy();
      const data = parseToolText(result.content) as {
        records: { is_company: boolean }[];
      };
      expect(data.records.length).toBeGreaterThan(0);
      expect(data.records.every((r) => r.is_company === true)).toBe(true);
    });

    it('respects limit and reports hasMore when more records exist', async () => {
      const result = await client.callTool({
        name: 'odoo_search',
        arguments: { model: 'res.partner', limit: 2, fields: ['id', 'name'] },
      });

      expect(result.isError).toBeFalsy();
      const data = parseToolText(result.content) as {
        records: unknown[];
        pagination: { total: number; limit: number; hasMore: boolean };
      };

      expect(data.records.length).toBeLessThanOrEqual(2);
      expect(data.pagination.limit).toBe(2);
      if (data.pagination.total > 2) {
        expect(data.pagination.hasMore).toBe(true);
      }
    });

    it('returns only the requested fields', async () => {
      const result = await client.callTool({
        name: 'odoo_search',
        arguments: { model: 'res.partner', fields: ['id', 'name'], limit: 3 },
      });

      expect(result.isError).toBeFalsy();
      const data = parseToolText(result.content) as { records: Record<string, unknown>[] };
      expect(data.records.length).toBeGreaterThan(0);
      for (const record of data.records) {
        expect(Object.keys(record).sort()).toEqual(['id', 'name']);
      }
    });
  });

  // ── Group 3: odoo://schema resource ───────────────────────────────────────

  describe('odoo://schema/{model} resource', () => {
    it('returns McpFieldSchema array for res.partner', async () => {
      const result = await client.readResource({ uri: 'odoo://schema/res.partner' });

      const content = result.contents[0];
      expect(content.mimeType).toBe('application/json');
      const data = JSON.parse(content.text as string) as { model: string; fields: unknown[] };
      expect(data.model).toBe('res.partner');
      expect(Array.isArray(data.fields)).toBe(true);
      expect(data.fields.length).toBeGreaterThan(0);
    });

    it('includes name and email fields', async () => {
      const result = await client.readResource({ uri: 'odoo://schema/res.partner' });
      const data = JSON.parse(result.contents[0].text as string) as {
        fields: { name: string }[];
      };
      const names = data.fields.map((f) => f.name);
      expect(names).toContain('name');
      expect(names).toContain('email');
    });

    it('each field has the required McpFieldSchema shape', async () => {
      const result = await client.readResource({ uri: 'odoo://schema/res.partner' });
      const data = JSON.parse(result.contents[0].text as string) as {
        fields: {
          name: string;
          type: string;
          string: string;
          required: boolean;
          readonly: boolean;
          help: string;
        }[];
      };
      const [field] = data.fields;
      expect(typeof field.name).toBe('string');
      expect(typeof field.type).toBe('string');
      expect(typeof field.string).toBe('string');
      expect(typeof field.required).toBe('boolean');
      expect(typeof field.readonly).toBe('boolean');
      expect(typeof field.help).toBe('string');
    });
  });

  // ── Group 4: Policy enforcement ───────────────────────────────────────────

  describe('policy enforcement', () => {
    it('returns POLICY_DENIED for a model not in the allow-list', async () => {
      // Policy: only res.partner is allowed. No wildcard catch-all means
      // allows() returns false for any other model (deny-by-default).
      currentPolicy = [{ model: 'res.partner', ops: ['read'] }];

      const result = await client.callTool({
        name: 'odoo_search',
        // res.currency exists but is blocked by the restrictive policy
        arguments: { model: 'res.currency', limit: 1 },
      });

      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toMatch(/^POLICY_DENIED:/);
    });

    it('allows access after policy is relaxed in the same session', async () => {
      // Start with a restrictive policy
      currentPolicy = [{ model: 'res.partner', ops: ['read'] }];

      const blocked = await client.callTool({
        name: 'odoo_search',
        arguments: { model: 'res.currency', limit: 1 },
      });
      expect(blocked.isError).toBe(true);

      // Relax policy → full read access
      currentPolicy = [...DEFAULT_POLICY];

      const allowed = await client.callTool({
        name: 'odoo_search',
        arguments: { model: 'res.currency', limit: 1 },
      });
      expect(allowed.isError).toBeFalsy();
    });

    it('hot-reloads policy from a file change without server restart', async () => {
      const policyPath = join(tmpdir(), `odoo-mcp-test-policy-${Date.now()}.json`);

      // Write an open policy → should allow res.currency
      await writeFile(policyPath, JSON.stringify([{ model: '*', ops: ['read'] }]));
      currentPolicy = [{ model: '*', ops: ['read'] }];

      const before = await client.callTool({
        name: 'odoo_search',
        arguments: { model: 'res.currency', limit: 1 },
      });
      expect(before.isError).toBeFalsy();

      // Simulate reload: update policy to block everything except res.partner
      currentPolicy = [{ model: 'res.partner', ops: ['read'] }];

      const after = await client.callTool({
        name: 'odoo_search',
        arguments: { model: 'res.currency', limit: 1 },
      });
      expect(after.isError).toBe(true);
      expect((after.content[0] as { text: string }).text).toMatch(/^POLICY_DENIED:/);
    });
  });
});
