/**
 * Integration tests for all odoo-mcp tools and resources against a real Odoo
 * instance provided by the global test setup (testcontainers).
 *
 * Covers:
 *   - 7 tools: odoo_discover, odoo_model_info, odoo_search, odoo_get,
 *     odoo_create, odoo_write, odoo_get_related
 *   - 3 resources: odoo://models, odoo://modules, odoo://schema/{model}
 *   - Policy enforcement (read-only + model restrictions)
 */

import net from 'node:net';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { OdooClientPool } from '../src/client-pool';
import { startHttpTransport, type HttpTransportHandle } from '../src/transport/http';
import { AuditWriter } from '../src/audit';
import { DEFAULT_POLICY, type PolicyRule } from '../src/policy';
import { uniqueTestName } from '../../../tests/helpers/odoo-instance';

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function parseToolText(content: unknown): unknown {
  const arr = content as { text?: string }[];
  const first = arr[0];
  if (!first?.text) throw new Error('No text in tool result');
  return JSON.parse(first.text);
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe('odoo-mcp tools & resources', () => {
  const odooUrl = process.env.ODOO_URL || 'http://localhost:8069';
  const odooDb = process.env.ODOO_DB_NAME || 'odoo';
  const odooUser = process.env.ODOO_DB_USER || 'admin';
  const odooPassword = process.env.ODOO_DB_PASSWORD || 'admin';

  let handle: HttpTransportHandle;
  let pool: OdooClientPool;
  let client: Client;
  let currentPolicy: PolicyRule[];

  // Track created record IDs for cleanup
  const createdPartnerIds: number[] = [];

  const validHeaders = () => ({
    'x-odoo-url': odooUrl,
    'x-odoo-db': odooDb,
    'x-odoo-user': odooUser,
    'x-odoo-password': odooPassword,
  });

  beforeAll(async () => {
    currentPolicy = [...DEFAULT_POLICY];

    const port = await findFreePort();
    const serverBaseUrl = `http://127.0.0.1:${port}`;

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
    client = new Client({ name: 'test-mcp-tools', version: '1.0.0' });
    await client.connect(transport);
  }, 60_000);

  afterAll(async () => {
    // Clean up created partners via the pool's client.
    if (createdPartnerIds.length > 0) {
      try {
        const session = await pool.acquire({
          url: odooUrl,
          db: odooDb,
          user: odooUser,
          password: odooPassword,
        });
        await session.client.unlink('res.partner', createdPartnerIds);
      } catch {
        // Best-effort cleanup; test DB is ephemeral
      }
    }

    await client.close().catch(() => {});
    await handle.close();
    await pool.close();
  });

  beforeEach(() => {
    currentPolicy = [...DEFAULT_POLICY];
  });

  // ── 1. Discovery tools ─────────────────────────────────────────────────────

  describe('odoo_discover', () => {
    it('finds res.partner when searching for "partner"', async () => {
      const result = await client.callTool({
        name: 'odoo_discover',
        arguments: { query: 'partner' },
      });

      expect(result.isError).toBeFalsy();
      const data = parseToolText(result.content) as {
        query: string;
        results: { model: string; description: string; modules: string[]; score: number }[];
      };

      expect(data.query).toBe('partner');
      expect(data.results.length).toBeGreaterThan(0);

      const models = data.results.map((r) => r.model);
      expect(models).toContain('res.partner');
    });

    it('returns empty results for a nonexistent model query', async () => {
      const result = await client.callTool({
        name: 'odoo_discover',
        arguments: { query: 'nonexistent_model_xyz_99999' },
      });

      expect(result.isError).toBeFalsy();
      const data = parseToolText(result.content) as { results: unknown[] };
      expect(data.results).toEqual([]);
    });
  });

  describe('odoo_model_info', () => {
    it('returns field schema for res.partner with known fields', async () => {
      const result = await client.callTool({
        name: 'odoo_model_info',
        arguments: { model: 'res.partner' },
      });

      expect(result.isError).toBeFalsy();
      const data = parseToolText(result.content) as {
        model: string;
        fields: {
          name: string;
          type: string;
          string: string;
          required: boolean;
          readonly: boolean;
          help: string;
        }[];
      };

      expect(data.model).toBe('res.partner');
      expect(Array.isArray(data.fields)).toBe(true);
      expect(data.fields.length).toBeGreaterThan(0);

      const fieldNames = data.fields.map((f) => f.name);
      expect(fieldNames).toContain('id');
      expect(fieldNames).toContain('name');
      expect(fieldNames).toContain('email');

      // Verify field shape
      const nameField = data.fields.find((f) => f.name === 'name');
      expect(nameField).toBeDefined();
      expect(typeof nameField!.type).toBe('string');
      expect(typeof nameField!.string).toBe('string');
      expect(typeof nameField!.required).toBe('boolean');
      expect(typeof nameField!.readonly).toBe('boolean');
      expect(typeof nameField!.help).toBe('string');
    });
  });

  // ── 2. CRUD tools ──────────────────────────────────────────────────────────

  describe('odoo_search', () => {
    it('returns an array of records with pagination', async () => {
      const result = await client.callTool({
        name: 'odoo_search',
        arguments: { model: 'res.partner', limit: 5 },
      });

      expect(result.isError).toBeFalsy();
      const data = parseToolText(result.content) as {
        records: Record<string, unknown>[];
        pagination: { total: number; limit: number; offset: number; hasMore: boolean };
      };

      expect(Array.isArray(data.records)).toBe(true);
      expect(data.records.length).toBeGreaterThan(0);
      expect(data.records.length).toBeLessThanOrEqual(5);
      expect(data.pagination).toMatchObject({
        total: expect.any(Number),
        limit: 5,
        offset: 0,
        hasMore: expect.any(Boolean),
      });
    });

    it('applies domain filter for companies only', async () => {
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
  });

  describe('odoo_get', () => {
    it('returns records with requested fields for specific IDs', async () => {
      // First, search to get some IDs
      const searchResult = await client.callTool({
        name: 'odoo_search',
        arguments: { model: 'res.partner', fields: ['id'], limit: 3 },
      });

      expect(searchResult.isError).toBeFalsy();
      const searchData = parseToolText(searchResult.content) as {
        records: { id: number }[];
      };
      expect(searchData.records.length).toBeGreaterThan(0);

      const ids = searchData.records.map((r) => r.id);

      // Now get those specific records
      const getResult = await client.callTool({
        name: 'odoo_get',
        arguments: {
          model: 'res.partner',
          ids,
          fields: ['id', 'name', 'email'],
        },
      });

      expect(getResult.isError).toBeFalsy();
      const getData = parseToolText(getResult.content) as {
        records: Record<string, unknown>[];
      };

      expect(getData.records.length).toBe(ids.length);
      for (const record of getData.records) {
        expect(record).toHaveProperty('id');
        expect(record).toHaveProperty('name');
        expect(record).toHaveProperty('email');
        expect(ids).toContain(record.id);
      }
    });
  });

  describe('odoo_create & odoo_write', () => {
    // Needs write policy
    beforeEach(() => {
      currentPolicy = [{ model: '*', ops: ['read', 'write'] }];
    });

    it('creates a new partner and verifies it exists', async () => {
      const testName = uniqueTestName('MCP');

      const createResult = await client.callTool({
        name: 'odoo_create',
        arguments: {
          model: 'res.partner',
          values: { name: testName, email: `${testName.toLowerCase()}@test.example.com` },
        },
      });

      expect(createResult.isError).toBeFalsy();
      const createData = parseToolText(createResult.content) as { id: number };
      expect(createData.id).toBeGreaterThan(0);

      // Track for cleanup
      createdPartnerIds.push(createData.id);

      // Verify via odoo_get
      const getResult = await client.callTool({
        name: 'odoo_get',
        arguments: {
          model: 'res.partner',
          ids: [createData.id],
          fields: ['id', 'name', 'email'],
        },
      });

      expect(getResult.isError).toBeFalsy();
      const getData = parseToolText(getResult.content) as {
        records: { id: number; name: string; email: string }[];
      };

      expect(getData.records.length).toBe(1);
      expect(getData.records[0].name).toBe(testName);
      expect(getData.records[0].email).toBe(`${testName.toLowerCase()}@test.example.com`);
    });

    it('writes (updates) a partner and verifies the change', async () => {
      // Create a partner first
      const originalName = uniqueTestName('MCP');
      const createResult = await client.callTool({
        name: 'odoo_create',
        arguments: {
          model: 'res.partner',
          values: { name: originalName },
        },
      });

      expect(createResult.isError).toBeFalsy();
      const createData = parseToolText(createResult.content) as { id: number };
      createdPartnerIds.push(createData.id);

      // Update the name
      const updatedName = uniqueTestName('MCP_Updated');
      const writeResult = await client.callTool({
        name: 'odoo_write',
        arguments: {
          model: 'res.partner',
          ids: [createData.id],
          values: { name: updatedName },
        },
      });

      expect(writeResult.isError).toBeFalsy();
      const writeData = parseToolText(writeResult.content) as {
        success: boolean;
        updated: number;
      };
      expect(writeData.success).toBe(true);
      expect(writeData.updated).toBe(1);

      // Verify the change
      const getResult = await client.callTool({
        name: 'odoo_get',
        arguments: {
          model: 'res.partner',
          ids: [createData.id],
          fields: ['id', 'name'],
        },
      });

      expect(getResult.isError).toBeFalsy();
      const getData = parseToolText(getResult.content) as {
        records: { id: number; name: string }[];
      };
      expect(getData.records[0].name).toBe(updatedName);
    });
  });

  // ── 3. Navigation tool ─────────────────────────────────────────────────────

  describe('odoo_get_related', () => {
    it('follows a many2one field (company_id on res.partner)', async () => {
      // Find a partner that has a company_id set
      const searchResult = await client.callTool({
        name: 'odoo_search',
        arguments: {
          model: 'res.partner',
          domain: [['company_id', '!=', false]],
          fields: ['id', 'name', 'company_id'],
          limit: 1,
        },
      });

      expect(searchResult.isError).toBeFalsy();
      const searchData = parseToolText(searchResult.content) as {
        records: { id: number; company_id: [number, string] | false }[];
      };
      expect(searchData.records.length).toBeGreaterThan(0);

      const partnerId = searchData.records[0].id;

      // Follow the company_id relation
      const relatedResult = await client.callTool({
        name: 'odoo_get_related',
        arguments: {
          model: 'res.partner',
          id: partnerId,
          field: 'company_id',
          fields: ['id', 'name'],
        },
      });

      expect(relatedResult.isError).toBeFalsy();
      const relatedData = parseToolText(relatedResult.content) as {
        type: string;
        model: string;
        record: { id: number; name: string } | null;
      };

      expect(relatedData.type).toBe('many2one');
      expect(relatedData.model).toBe('res.company');
      expect(relatedData.record).not.toBeNull();
      expect(relatedData.record!.id).toBeGreaterThan(0);
      expect(typeof relatedData.record!.name).toBe('string');
    });
  });

  // ── 4. Resources ───────────────────────────────────────────────────────────

  describe('odoo://models resource', () => {
    it('lists models including res.partner', async () => {
      const result = await client.readResource({ uri: 'odoo://models' });

      expect(result.contents.length).toBeGreaterThan(0);
      const content = result.contents[0];
      expect(content.mimeType).toBe('application/json');

      const text = 'text' in content ? (content.text as string) : '';
      const data = JSON.parse(text) as {
        models: { model: string; description: string; modules: string[] }[];
      };

      expect(Array.isArray(data.models)).toBe(true);
      expect(data.models.length).toBeGreaterThan(0);

      const modelNames = data.models.map((m) => m.model);
      expect(modelNames).toContain('res.partner');
    });
  });

  describe('odoo://modules resource', () => {
    it('lists installed modules including base', async () => {
      const result = await client.readResource({ uri: 'odoo://modules' });

      expect(result.contents.length).toBeGreaterThan(0);
      const content = result.contents[0];
      expect(content.mimeType).toBe('application/json');

      const text = 'text' in content ? (content.text as string) : '';
      const data = JSON.parse(text) as {
        modules: {
          name: string;
          label: string;
          summary: string | null;
          category: string | null;
        }[];
      };

      expect(Array.isArray(data.modules)).toBe(true);
      expect(data.modules.length).toBeGreaterThan(0);

      const moduleNames = data.modules.map((m) => m.name);
      expect(moduleNames).toContain('base');
    });
  });

  describe('odoo://schema/{model} resource', () => {
    it('returns field definitions for res.partner', async () => {
      const result = await client.readResource({ uri: 'odoo://schema/res.partner' });

      expect(result.contents.length).toBeGreaterThan(0);
      const content = result.contents[0];
      expect(content.mimeType).toBe('application/json');

      const text = 'text' in content ? (content.text as string) : '';
      const data = JSON.parse(text) as {
        model: string;
        fields: {
          name: string;
          type: string;
          string: string;
          required: boolean;
          readonly: boolean;
          help: string;
        }[];
      };

      expect(data.model).toBe('res.partner');
      expect(Array.isArray(data.fields)).toBe(true);
      expect(data.fields.length).toBeGreaterThan(0);

      const fieldNames = data.fields.map((f) => f.name);
      expect(fieldNames).toContain('name');
      expect(fieldNames).toContain('email');
      expect(fieldNames).toContain('id');
    });
  });

  // ── 5. Policy enforcement ──────────────────────────────────────────────────

  describe('policy enforcement', () => {
    it('denies odoo_create when policy is read-only', async () => {
      currentPolicy = [{ model: '*', ops: ['read'] }];

      const result = await client.callTool({
        name: 'odoo_create',
        arguments: {
          model: 'res.partner',
          values: { name: 'Should Not Be Created' },
        },
      });

      expect(result.isError).toBe(true);
      const text = (result.content as { text: string }[])[0].text;
      expect(text).toMatch(/^POLICY_DENIED:/);
    });

    it('denies odoo_search on res.partner when policy only allows sale.*', async () => {
      currentPolicy = [{ model: 'sale.*', ops: ['read'] }];

      const result = await client.callTool({
        name: 'odoo_search',
        arguments: { model: 'res.partner', limit: 1 },
      });

      expect(result.isError).toBe(true);
      const text = (result.content as { text: string }[])[0].text;
      expect(text).toMatch(/^POLICY_DENIED:/);
    });
  });
});
