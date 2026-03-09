import type { OdooModel } from '@marcfargas/odoo-introspection';
import { Introspector } from '@marcfargas/odoo-introspection';

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const SCHEMA_TTL_MS = 5 * 60 * 1000;
const INTROSPECTOR_MODEL_TTL_MS = 5 * 60 * 1000; // keeps existing cache.test.ts expectations
const IR_MODEL_TTL_MS = 10 * 60 * 1000;
const IR_MODULE_TTL_MS = 10 * 60 * 1000;
const MAX_SCHEMA_ENTRIES = 500;

/** Raw ir.model row — used by odoo://models and odoo_discover. */
export interface IrModelInfo {
  id: number;
  name: string; // human label, e.g. 'Contact'
  model: string; // technical name, e.g. 'res.partner'
  modules: string; // comma-separated, e.g. 'base,mail'
}

/** Raw ir.module.module row — used by odoo://modules and odoo_discover. */
export interface IrModuleInfo {
  id: number;
  name: string; // technical name, e.g. 'sale'
  shortdesc: string; // human label
  summary: string; // short summary (may be empty)
  category_id: [number, string] | false;
}

export class McpCache {
  private introspectorModelEntry?: CacheEntry<OdooModel[]>;
  private irModelEntry?: CacheEntry<IrModelInfo[]>;
  private irModuleEntry?: CacheEntry<IrModuleInfo[]>;
  private schemaEntries = new Map<string, CacheEntry<unknown>>();

  constructor(
    private readonly introspector: Introspector,
    private readonly now: () => number = () => Date.now()
  ) {}

  /** Introspector-based model list (used by schema cache internals). */
  async getModels(): Promise<OdooModel[]> {
    const cached = this.introspectorModelEntry;
    if (cached && cached.expiresAt > this.now()) return cached.value;

    const value = await this.introspector.getModels({ bypassCache: true });
    this.introspectorModelEntry = { value, expiresAt: this.now() + INTROSPECTOR_MODEL_TTL_MS };
    return value;
  }

  /**
   * All ir.model rows (non-transient) — for odoo://models and odoo_discover.
   * Fetched via the provided async fetcher; cached for 10 min.
   */
  async getIrModels(fetcher: () => Promise<IrModelInfo[]>): Promise<IrModelInfo[]> {
    const cached = this.irModelEntry;
    if (cached && cached.expiresAt > this.now()) return cached.value;

    const value = await fetcher();
    this.irModelEntry = { value, expiresAt: this.now() + IR_MODEL_TTL_MS };
    return value;
  }

  /**
   * Installed ir.module.module rows — for odoo://modules and odoo_discover.
   * Fetched via the provided async fetcher; cached for 10 min.
   */
  async getIrModules(fetcher: () => Promise<IrModuleInfo[]>): Promise<IrModuleInfo[]> {
    const cached = this.irModuleEntry;
    if (cached && cached.expiresAt > this.now()) return cached.value;

    const value = await fetcher();
    this.irModuleEntry = { value, expiresAt: this.now() + IR_MODULE_TTL_MS };
    return value;
  }

  /**
   * Per-model field schema cache (fetched via fields_get).
   * LRU-ish: evicts the oldest entry when MAX_SCHEMA_ENTRIES is reached.
   */
  async getSchema<T>(model: string, fetcher: () => Promise<T>): Promise<T> {
    const existing = this.schemaEntries.get(model);

    if (existing && existing.expiresAt > this.now()) {
      // Touch for LRU ordering
      this.schemaEntries.delete(model);
      this.schemaEntries.set(model, existing);
      return existing.value as T;
    }

    if (existing) this.schemaEntries.delete(model);

    const value = await fetcher();

    if (!this.schemaEntries.has(model) && this.schemaEntries.size >= MAX_SCHEMA_ENTRIES) {
      const oldestKey = this.schemaEntries.keys().next().value;
      if (oldestKey !== undefined) this.schemaEntries.delete(oldestKey);
    }

    this.schemaEntries.set(model, { value, expiresAt: this.now() + SCHEMA_TTL_MS });
    return value;
  }

  invalidateAll(): void {
    this.introspectorModelEntry = undefined;
    this.irModelEntry = undefined;
    this.irModuleEntry = undefined;
    this.schemaEntries.clear();
  }
}
