/**
 * Per-credential OdooClient pool for the HTTP transport.
 *
 * Each unique (url, db, user, password) combination gets its own
 * OdooClient + McpCache. Entries are evicted after IDLE_TIMEOUT_MS of
 * inactivity.
 *
 * McpOdooServer and StreamableHTTPServerTransport are intentionally NOT
 * pooled here — the MCP SDK's stateless transport (sessionIdGenerator:
 * undefined) sets _hasHandledRequest=true on first use and throws on the
 * second. A fresh pair must be created per HTTP request in the handler.
 */

import { createHash } from 'node:crypto';
import debug from 'debug';
import { OdooClient, type OdooClientConfig } from '@marcfargas/odoo-client';
import { Introspector } from '@marcfargas/odoo-introspection';
import type { AuditWriter } from './audit';
import { McpCache } from './cache';
import type { PolicyRule } from './policy';
import { createMcpSafetyContext } from './safety';

const log = debug('odoo-mcp:client-pool');

/** Connection parameters extracted from X-Odoo-* headers. */
export interface OdooConnectionConfig {
  url: string;
  db: string;
  user: string;
  password: string;
}

/** What the HTTP handler receives from acquire() for this credential set. */
export interface AcquiredSession {
  client: OdooClient;
  cache: McpCache;
}

interface PoolEntry extends AcquiredSession {
  lastUsed: number;
}

export interface ClientPoolOptions {
  version: string;
  getPolicy: () => PolicyRule[];
  audit: AuditWriter;
  /** Evict entries idle longer than this (default: 30 min). */
  idleTimeoutMs?: number;
  /** How often to run the eviction sweep (default: 5 min). */
  evictIntervalMs?: number;
  /**
   * Maximum number of live pool entries (default: 50).
   * Requests that would exceed this cap receive 429.
   */
  maxSize?: number;
}

/** Exposed subset of options needed by the HTTP handler to build per-request servers. */
export interface PoolServerOptions {
  version: string;
  getPolicy: () => PolicyRule[];
  audit: AuditWriter;
}

const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_EVICT_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_SIZE = 50;

/** Thrown by OdooClientPool.acquire() when the pool is at capacity. */
export class McpPoolFullError extends Error {
  constructor(limit: number) {
    super(`Connection pool is full (limit: ${limit}). Retry after existing sessions expire.`);
    this.name = 'McpPoolFullError';
  }
}

function poolKey(config: OdooConnectionConfig): string {
  const h = createHash('sha256');
  h.update(config.url);
  h.update('\0');
  h.update(config.db);
  h.update('\0');
  h.update(config.user);
  h.update('\0');
  h.update(config.password);
  return h.digest('hex');
}

export class OdooClientPool {
  private readonly entries = new Map<string, PoolEntry>();
  private readonly idleTimeoutMs: number;
  private readonly maxSize: number;
  private readonly evictTimer: ReturnType<typeof setInterval>;

  constructor(private readonly options: ClientPoolOptions) {
    this.idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
    this.maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
    const evictInterval = options.evictIntervalMs ?? DEFAULT_EVICT_INTERVAL_MS;
    this.evictTimer = setInterval(() => this.evictIdle(), evictInterval);
    // Don't prevent process exit
    this.evictTimer.unref();
  }

  /**
   * Options the HTTP handler needs to construct a per-request McpOdooServer.
   * Exposed here so the handler doesn't need a separate config object.
   */
  get serverOptions(): PoolServerOptions {
    return {
      version: this.options.version,
      getPolicy: this.options.getPolicy,
      audit: this.options.audit,
    };
  }

  /**
   * Acquire an authenticated session for the given credentials.
   * Creates a new entry (including Odoo authentication) if one doesn't exist.
   * Throws OdooAuthError if credentials are invalid — caller maps this to 401.
   */
  async acquire(config: OdooConnectionConfig): Promise<AcquiredSession> {
    const key = poolKey(config);
    let entry = this.entries.get(key);

    if (!entry) {
      if (this.entries.size >= this.maxSize) {
        throw new McpPoolFullError(this.maxSize);
      }
      log('Creating new pool entry for %s/%s@%s', config.user, config.db, config.url);
      entry = await this.createEntry(config);
      this.entries.set(key, entry);
    }

    entry.lastUsed = Date.now();
    return entry;
  }

  private async createEntry(config: OdooConnectionConfig): Promise<PoolEntry> {
    const clientConfig: OdooClientConfig = {
      url: config.url,
      database: config.db,
      username: config.user,
      password: config.password,
    };

    const client = new OdooClient(clientConfig);
    // Throws OdooAuthError on bad credentials — propagated to caller → 401.
    await client.authenticate();
    client.setSafetyContext(createMcpSafetyContext(this.options.getPolicy));

    const introspector = new Introspector(client);
    const cache = new McpCache(introspector);

    return {
      client,
      cache,
      lastUsed: Date.now(),
    };
  }

  private evictIdle(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (now - entry.lastUsed > this.idleTimeoutMs) {
        log('Evicting idle pool entry (key=%s)', key.slice(0, 8));
        this.entries.delete(key);
        void this.closeEntry(entry);
      }
    }
  }

  private async closeEntry(entry: PoolEntry): Promise<void> {
    try {
      entry.client.logout();
    } catch (err) {
      log('Error closing pool entry: %o', err);
    }
  }

  /** Return current number of live entries (useful for tests / metrics). */
  get size(): number {
    return this.entries.size;
  }

  /** Drain the pool: stop eviction timer, close all entries. */
  async close(): Promise<void> {
    clearInterval(this.evictTimer);
    const all = [...this.entries.values()];
    this.entries.clear();
    await Promise.all(all.map((e) => this.closeEntry(e)));
    log('Pool closed (%d entries drained)', all.length);
  }
}
