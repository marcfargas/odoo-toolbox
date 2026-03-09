#!/usr/bin/env node

import { watch, type FSWatcher } from 'node:fs';
import debug from 'debug';
import { createClient } from '@marcfargas/odoo-client';
import { Introspector } from '@marcfargas/odoo-introspection';
import { AuditWriter } from './audit';
import { McpCache } from './cache';
import { OdooClientPool } from './client-pool';
import { loadPolicy, type PolicyRule } from './policy';
import { McpOdooServer } from './server';
import { createMcpSafetyContext } from './safety';
import { startHttpTransport, type HttpTransportHandle } from './transport/http';
import { startStdioTransport } from './transport/stdio';

const log = debug('odoo-mcp:index');

type TransportMode = 'http' | 'stdio';

function parseTransportArg(argv: string[]): TransportMode {
  const flagIndex = argv.findIndex((arg) => arg === '--transport');
  if (flagIndex === -1) return 'http';

  const value = argv[flagIndex + 1];
  if (value === 'http' || value === 'stdio') return value;

  throw new Error("Invalid value for --transport. Use 'http' or 'stdio'.");
}

/**
 * Parse ODOO_MCP_ALLOWED_URLS (comma-separated).
 * Throws if the variable is unset or empty — SSRF protection requires an explicit list.
 */
function parseAllowedUrls(): string[] {
  const raw = process.env.ODOO_MCP_ALLOWED_URLS?.trim();
  if (!raw) {
    throw new Error(
      'ODOO_MCP_ALLOWED_URLS is required for HTTP transport. ' +
        'Set it to a comma-separated list of allowed Odoo base URLs, e.g. ' +
        'https://prod.example.com,https://staging.example.com'
    );
  }
  return raw
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);
}

/** Used only for stdio mode: requires explicit Odoo credentials in env. */
function requireStdioEnv(): void {
  const required = ['ODOO_URL', 'ODOO_DB', 'ODOO_USER', 'ODOO_PASSWORD'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`stdio transport requires Odoo credentials. Missing: ${missing.join(', ')}`);
  }
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function loadVersion(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require('../package.json') as { version?: string };
    return pkg.version ?? '0.1.0';
  } catch {
    return '0.1.0';
  }
}

async function main(): Promise<void> {
  const transportMode = parseTransportArg(process.argv.slice(2));

  // --- Policy setup (shared across all modes) ---

  const policyFile = process.env.ODOO_MCP_POLICY_FILE;
  const policyJson = process.env.ODOO_MCP_POLICY;

  let currentPolicy: PolicyRule[] = loadPolicy({ policyFile, policyJson });
  const getPolicy = (): PolicyRule[] => currentPolicy;

  const reloadPolicy = (): void => {
    try {
      currentPolicy = loadPolicy({ policyFile, policyJson: process.env.ODOO_MCP_POLICY });
      log('Policy reloaded successfully');
    } catch (error) {
      process.stderr.write(`Failed to reload policy: ${safeErrorMessage(error)}\n`);
    }
  };

  process.on('SIGHUP', reloadPolicy);

  let watcher: FSWatcher | undefined;
  if (policyFile) {
    try {
      watcher = watch(policyFile, reloadPolicy);
      log('Watching policy file: %s', policyFile);
    } catch (error) {
      process.stderr.write(
        `Failed to watch policy file '${policyFile}': ${safeErrorMessage(error)}\n`
      );
    }
  }

  // --- Mode-specific startup ---

  const version = loadVersion();
  const audit = new AuditWriter(process.env.ODOO_MCP_AUDIT_LOG);

  let httpHandle: HttpTransportHandle | undefined;
  let pool: OdooClientPool | undefined;

  if (transportMode === 'stdio') {
    /**
     * stdio mode: single Odoo connection from env vars.
     * Intended for local dev / embedded use where custom headers aren't available.
     */
    requireStdioEnv();

    const client = await createClient();
    client.setSafetyContext(createMcpSafetyContext(getPolicy));

    const introspector = new Introspector(client);
    const cache = new McpCache(introspector);

    const mcpServer = new McpOdooServer({
      version,
      client,
      getPolicy,
      cache,
      audit,
      userLogin: process.env.ODOO_USER ?? 'unknown',
    });
    await startStdioTransport(mcpServer.server);
  } else {
    /**
     * HTTP mode: credentials supplied per-request via X-Odoo-* headers.
     * No server-side Odoo credentials — the pool creates clients on demand.
     */
    const allowedUrls = parseAllowedUrls();
    log('Allowed Odoo URLs: %o', allowedUrls);

    const portRaw = Number.parseInt(process.env.ODOO_MCP_PORT ?? '3100', 10);
    const port = Number.isFinite(portRaw) ? portRaw : 3100;

    const idleMsRaw = Number.parseInt(process.env.ODOO_MCP_POOL_IDLE_MS ?? '', 10);
    const idleTimeoutMs = Number.isFinite(idleMsRaw) && idleMsRaw > 0 ? idleMsRaw : undefined;

    const maxSizeRaw = Number.parseInt(process.env.ODOO_MCP_POOL_MAX_SIZE ?? '', 10);
    const maxSize = Number.isFinite(maxSizeRaw) && maxSizeRaw > 0 ? maxSizeRaw : undefined;

    pool = new OdooClientPool({ version, getPolicy, audit, idleTimeoutMs, maxSize });

    httpHandle = await startHttpTransport({
      port,
      host: process.env.ODOO_MCP_HOST || undefined,
      bodyLimit: process.env.ODOO_MCP_BODY_LIMIT || undefined,
      allowedUrls,
      pool,
      trustProxy: process.env.ODOO_MCP_TRUST_PROXY === '1',
    });
  }

  const shutdown = async (): Promise<void> => {
    watcher?.close();
    if (httpHandle) await httpHandle.close();
    if (pool) await pool.close();
  };

  process.on('SIGINT', () => {
    void shutdown().finally(() => process.exit(0));
  });

  process.on('SIGTERM', () => {
    void shutdown().finally(() => process.exit(0));
  });
}

process.on('uncaughtException', (error) => {
  process.stderr.write(`Uncaught exception: ${safeErrorMessage(error)}\n`);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  process.stderr.write(`Unhandled rejection: ${safeErrorMessage(error)}\n`);
  process.exit(1);
});

main().catch((error) => {
  process.stderr.write(`Fatal startup error: ${safeErrorMessage(error)}\n`);
  process.exit(1);
});
