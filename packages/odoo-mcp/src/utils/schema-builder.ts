/**
 * Schema builder utility for merging base schemas with live Odoo fields.
 *
 * Combines pre-defined base schemas (with rich documentation) with
 * dynamically discovered fields from Odoo introspection to provide
 * complete, well-documented model schemas.
 */

import type { Introspector, OdooField } from '@odoo-toolbox/introspection';
import type { BaseModelSchema, BaseFieldSchema, MergedModelSchema } from '../schemas/base/types.js';
import { BASE_SCHEMAS, mapOdooField } from '../schemas/base/index.js';

/**
 * Cache entry for merged schemas.
 */
interface CacheEntry {
  schema: MergedModelSchema;
  timestamp: number;
}

/**
 * Default cache TTL in milliseconds (5 minutes).
 */
const DEFAULT_CACHE_TTL = 5 * 60 * 1000;

/**
 * Fields to exclude from dynamic discovery (internal Odoo fields).
 */
const EXCLUDED_FIELDS = new Set([
  '__last_update',
  'write_date',
  'write_uid',
  'create_date',
  'create_uid',
  'display_name', // Often computed and verbose
]);

/**
 * Schema builder that merges base schemas with live Odoo introspection.
 *
 * Key behaviors:
 * - Base schema fields take precedence for documentation quality
 * - Live fields add module-specific extensions
 * - Results are cached with configurable TTL
 * - Graceful fallback to live-only or base-only
 */
export class SchemaBuilder {
  private cache: Map<string, CacheEntry> = new Map();
  private cacheTtl: number;

  constructor(
    private introspector: Introspector,
    options: { cacheTtl?: number } = {}
  ) {
    this.cacheTtl = options.cacheTtl ?? DEFAULT_CACHE_TTL;
  }

  /**
   * Build a complete schema for a model by merging base and live fields.
   *
   * @param model - Technical model name (e.g., 'ir.model', 'res.partner')
   * @param options - Build options
   * @returns Merged schema with all fields documented
   *
   * @example
   * ```typescript
   * const schema = await builder.buildSchema('ir.model');
   * console.log(schema.fields.model.description); // Rich documentation
   * console.log(schema.liveFields); // Fields discovered from Odoo
   * ```
   */
  async buildSchema(
    model: string,
    options: { bypassCache?: boolean } = {}
  ): Promise<MergedModelSchema> {
    const { bypassCache = false } = options;

    // Check cache first
    if (!bypassCache) {
      const cached = this.cache.get(model);
      if (cached && Date.now() - cached.timestamp < this.cacheTtl) {
        return cached.schema;
      }
    }

    // Get base schema if available
    const baseSchema = BASE_SCHEMAS[model];

    // Fetch live fields from Odoo
    let liveFields: OdooField[] = [];
    try {
      liveFields = await this.introspector.getFields(model, { bypassCache });
    } catch (error) {
      // If introspection fails and we have base schema, return that
      if (baseSchema) {
        const fallbackSchema = this.createSchemaFromBase(baseSchema);
        this.cache.set(model, { schema: fallbackSchema, timestamp: Date.now() });
        return fallbackSchema;
      }
      // No base schema and introspection failed - rethrow
      throw error;
    }

    // Merge base and live fields
    const schema = this.merge(model, baseSchema, liveFields);

    // Cache the result
    this.cache.set(model, { schema, timestamp: Date.now() });

    return schema;
  }

  /**
   * Merge base schema with live fields.
   */
  private merge(
    model: string,
    baseSchema: BaseModelSchema | undefined,
    liveFields: OdooField[]
  ): MergedModelSchema {
    const fields: Record<string, BaseFieldSchema> = {};
    const baseFieldNames: string[] = [];
    const liveFieldNames: string[] = [];

    // Start with base schema fields (they have better documentation)
    if (baseSchema) {
      for (const [name, field] of Object.entries(baseSchema.fields)) {
        fields[name] = { ...field };
        baseFieldNames.push(name);
      }
    }

    // Add live fields (skip excluded and already-defined base fields)
    for (const liveField of liveFields) {
      if (EXCLUDED_FIELDS.has(liveField.name)) {
        continue;
      }

      // Don't overwrite base schema fields - they have better documentation
      if (fields[liveField.name]) {
        continue;
      }

      fields[liveField.name] = mapOdooField(liveField);
      liveFieldNames.push(liveField.name);
    }

    return {
      model,
      description: baseSchema?.description ?? `Odoo model: ${model}`,
      fields,
      required: baseSchema?.required ?? ['id'],
      baseFields: baseFieldNames,
      liveFields: liveFieldNames,
    };
  }

  /**
   * Create a schema from base definition only (no live fields).
   */
  private createSchemaFromBase(baseSchema: BaseModelSchema): MergedModelSchema {
    return {
      model: baseSchema.model,
      description: baseSchema.description,
      fields: { ...baseSchema.fields },
      required: [...baseSchema.required],
      baseFields: Object.keys(baseSchema.fields),
      liveFields: [],
    };
  }

  /**
   * Clear cached schemas.
   *
   * @param model - Specific model to clear, or all if undefined
   */
  invalidateCache(model?: string): void {
    if (model) {
      this.cache.delete(model);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get list of models that have base schemas.
   */
  getModelsWithBaseSchemas(): string[] {
    return Object.keys(BASE_SCHEMAS);
  }

  /**
   * Check if a model has a base schema.
   */
  hasBaseSchema(model: string): boolean {
    return model in BASE_SCHEMAS;
  }
}
