import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OdooAuthError } from '@marcfargas/odoo-client';
import type { AuditWriter } from '../src/audit';
import type { PolicyRule } from '../src/policy';

// ── Fake timers ────────────────────────────────────────────────────────────

vi.useFakeTimers();

// ── authenticateFn: mutable so individual tests can override it ────────────

let authenticateFn = vi.fn().mockResolvedValue(undefined);

// ── Module mocks ───────────────────────────────────────────────────────────

// Note: StreamableHTTPServerTransport and McpOdooServer are NOT mocked here —
// they are no longer created inside the pool. The pool only holds OdooClient +
// McpCache. Fresh server+transport are created per HTTP request in the handler.

vi.mock('../src/cache', () => ({
  McpCache: vi.fn(function MockCache() {}),
}));

vi.mock('../src/safety', () => ({
  createMcpSafetyContext: vi.fn(() => ({})),
}));

vi.mock('@marcfargas/odoo-introspection', () => ({
  Introspector: vi.fn(function MockIntrospector() {}),
}));

// Keep real OdooAuthError; only replace OdooClient constructor.
vi.mock('@marcfargas/odoo-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@marcfargas/odoo-client')>();
  return {
    ...actual,
    // Must be a regular function (not arrow) to work with `new`.
    OdooClient: vi.fn(function MockOdooClient(this: Record<string, unknown>) {
      this.authenticate = () => authenticateFn();
      this.setSafetyContext = vi.fn();
      this.logout = vi.fn();
    }),
  };
});

// ── Import SUT after mocks are registered ─────────────────────────────────

import { OdooClientPool, McpPoolFullError } from '../src/client-pool';

// ── Helpers ────────────────────────────────────────────────────────────────

const makePool = (overrides?: Partial<ConstructorParameters<typeof OdooClientPool>[0]>) =>
  new OdooClientPool({
    version: '0.1.0',
    getPolicy: (): PolicyRule[] => [],
    audit: {} as AuditWriter,
    evictIntervalMs: 60_000,
    ...overrides,
  });

const creds = { url: 'https://odoo.example.com', db: 'mydb', user: 'admin', password: 'pass' };

beforeEach(() => {
  authenticateFn = vi.fn().mockResolvedValue(undefined);
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllTimers();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('OdooClientPool', () => {
  it('creates a new entry on first acquire', async () => {
    const pool = makePool();
    await pool.acquire(creds);
    expect(pool.size).toBe(1);
    await pool.close();
  });

  it('reuses the same entry for identical credentials', async () => {
    const pool = makePool();
    const a = await pool.acquire(creds);
    const b = await pool.acquire(creds);
    expect(a).toBe(b);
    expect(pool.size).toBe(1);
    // authenticate only called once — second acquire is a cache hit
    expect(authenticateFn).toHaveBeenCalledTimes(1);
    await pool.close();
  });

  it('creates separate entries for different users', async () => {
    const pool = makePool();
    await pool.acquire(creds);
    await pool.acquire({ ...creds, user: 'other_user' });
    expect(pool.size).toBe(2);
    expect(authenticateFn).toHaveBeenCalledTimes(2);
    await pool.close();
  });

  it('treats different databases as separate entries', async () => {
    const pool = makePool();
    await pool.acquire(creds);
    await pool.acquire({ ...creds, db: 'other_db' });
    expect(pool.size).toBe(2);
    await pool.close();
  });

  it('propagates OdooAuthError on bad credentials without storing entry', async () => {
    authenticateFn = vi.fn().mockRejectedValue(new OdooAuthError('Invalid credentials'));
    const pool = makePool();
    await expect(pool.acquire(creds)).rejects.toBeInstanceOf(OdooAuthError);
    // Failed entry must NOT be stored in pool
    expect(pool.size).toBe(0);
    await pool.close();
  });

  it('evicts idle entries when idle timeout expires', async () => {
    const pool = makePool({ idleTimeoutMs: 1000, evictIntervalMs: 500 });
    await pool.acquire(creds);
    expect(pool.size).toBe(1);

    // Advance time past idle timeout + one eviction sweep
    vi.advanceTimersByTime(2000);

    expect(pool.size).toBe(0);
    await pool.close();
  });

  it('drains all entries on close()', async () => {
    const pool = makePool();
    await pool.acquire(creds);
    await pool.acquire({ ...creds, user: 'user2' });
    expect(pool.size).toBe(2);
    await pool.close();
    expect(pool.size).toBe(0);
  });

  it('throws McpPoolFullError when maxSize is exceeded', async () => {
    const pool = makePool({ maxSize: 2 });
    await pool.acquire(creds);
    await pool.acquire({ ...creds, user: 'user2' });
    expect(pool.size).toBe(2);

    // Third distinct credential set should hit the cap
    await expect(pool.acquire({ ...creds, user: 'user3' })).rejects.toBeInstanceOf(
      McpPoolFullError
    );
    // Pool stays at cap — failed acquire must not add an entry
    expect(pool.size).toBe(2);

    // Existing credential set still works (hits cache, not the cap check)
    await expect(pool.acquire(creds)).resolves.toBeDefined();

    await pool.close();
  });
});
