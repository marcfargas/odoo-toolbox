/**
 * Simple LRU field metadata cache with TTL.
 * Prevents repeated ir.model.fields queries across getFeed pages.
 *
 * Key: ir.model.fields id → { name, ttype, field_description }
 * TTL: 5 minutes (fields rarely change at runtime)
 */

export interface CachedFieldMeta {
  id: number;
  name: string;
  ttype: string;
  field_description: string;
}

interface CacheEntry {
  value: CachedFieldMeta;
  expiresAt: number;
}

const TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_SIZE = 500;

export class FieldMetaCache {
  private map = new Map<number, CacheEntry>();

  get(id: number): CachedFieldMeta | undefined {
    const entry = this.map.get(id);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(id);
      return undefined;
    }
    return entry.value;
  }

  set(meta: CachedFieldMeta): void {
    // Evict oldest entry if at capacity
    if (this.map.size >= MAX_SIZE && !this.map.has(meta.id)) {
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) this.map.delete(firstKey);
    }
    this.map.set(meta.id, { value: meta, expiresAt: Date.now() + TTL_MS });
  }

  /** Return IDs not in cache (need fetching) */
  missing(ids: number[]): number[] {
    return ids.filter((id) => !this.get(id));
  }
}
