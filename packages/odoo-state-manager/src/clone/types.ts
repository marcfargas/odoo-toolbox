/**
 * Types for the data clone (export/import) feature.
 *
 * Enables pulling records from a source Odoo instance with transitive
 * many2one dependencies and replaying them into a target instance.
 */

// ---------------------------------------------------------------------------
// Export types
// ---------------------------------------------------------------------------

/**
 * Specifies a set of records to export from a source instance.
 */
export interface DataDomain {
  /** Odoo model name (e.g., 'res.partner') */
  model: string;
  /** Odoo domain filter (e.g., [['active', '=', true]]) */
  domain: any[];
  /** Maximum number of records to fetch for this spec */
  limit?: number;
}

/**
 * Options for the export operation.
 */
export interface ExportOptions {
  /**
   * Resolve many2one dependencies transitively.
   * When true, referenced records are fetched automatically.
   * @default true
   */
  followRelations?: boolean;

  /**
   * Maximum recursion depth for dependency resolution.
   * @default 5
   */
  maxDepth?: number;

  /**
   * Models to skip during dependency resolution.
   * Infrastructure models (ir.*, mail.*, etc.) are good candidates.
   */
  excludeModels?: string[];

  /**
   * Field names to skip during export (applied to all models).
   * Useful for skipping mail/activity data, large binary fields, etc.
   */
  excludeFields?: string[];

  /**
   * Whether to include binary fields in the export.
   * @default false
   */
  includeBinaryFields?: boolean;
}

// ---------------------------------------------------------------------------
// Snapshot types
// ---------------------------------------------------------------------------

/**
 * Metadata about an export snapshot.
 */
export interface SnapshotMetadata {
  /** ISO 8601 timestamp of the export */
  exportedAt: string;
  /** The domain specs that produced this snapshot */
  domainSpecs: DataDomain[];
  /** Record counts per model */
  stats: Record<string, number>;
}

/**
 * A serializable snapshot of exported data.
 *
 * Records are keyed by model name. Each record is a plain object
 * with field values ready for import (many2one normalized to IDs,
 * computed/readonly fields stripped).
 */
export interface Snapshot {
  /** Version tag for forward compatibility */
  version: 1;
  /** Exported records grouped by model */
  records: Record<string, ExportedRecord[]>;
  /** Export metadata */
  metadata: SnapshotMetadata;
}

/**
 * A single exported record with its original ID preserved.
 */
export interface ExportedRecord {
  /** The record's ID in the source instance */
  id: number;
  /** Field values (many2one normalized to plain IDs, system fields stripped) */
  values: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Import types
// ---------------------------------------------------------------------------

/**
 * Options for the import operation.
 */
export interface ImportOptions {
  /**
   * How to handle records that already exist in the target.
   *
   * - 'skip': silently skip (default, best for testcontainers)
   * - 'error': throw on conflict
   *
   * Note: conflict detection uses xml_id when available, otherwise
   * records are always created fresh (IDs are instance-specific).
   *
   * @default 'skip'
   */
  onConflict?: 'skip' | 'error';
}

/**
 * Result of an import operation.
 */
export interface ImportResult {
  /**
   * Mapping of source IDs to target IDs, keyed by model.
   *
   * Example: `idMap['res.partner'][42]` → 7
   * (source ID 42 became target ID 7)
   */
  idMap: Record<string, Record<number, number>>;

  /** Number of records created per model */
  created: Record<string, number>;

  /** Number of records skipped per model */
  skipped: Record<string, number>;

  /** Errors encountered (non-fatal when onConflict is 'skip') */
  errors: Array<{ model: string; sourceId: number; error: string }>;
}
