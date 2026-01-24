/**
 * Simple in-memory cache for introspection results.
 * 
 * Model metadata rarely changes during runtime, so caching prevents
 * redundant RPC calls to ir.model and ir.model.fields.
 * 
 * This is a simple Map-based implementation without TTL or size limits.
 * Since model metadata is relatively small and doesn't change frequently,
 * this approach is sufficient for most use cases.
 */

import type { OdooModel, OdooField, ModelMetadata } from './types.js';

export class IntrospectionCache {
  private models: OdooModel[] | null = null;
  private fields: Map<string, OdooField[]> = new Map();
  private metadata: Map<string, ModelMetadata> = new Map();

  /**
   * Get cached models list.
   * 
   * @returns Cached models array or null if not cached
   */
  getModels(): OdooModel[] | null {
    return this.models;
  }

  /**
   * Cache the complete models list.
   * 
   * @param models - Array of all models from ir.model
   */
  setModels(models: OdooModel[]): void {
    this.models = models;
  }

  /**
   * Get cached fields for a specific model.
   * 
   * @param modelName - Technical model name (e.g., 'res.partner')
   * @returns Cached fields array or undefined if not cached
   */
  getFields(modelName: string): OdooField[] | undefined {
    return this.fields.get(modelName);
  }

  /**
   * Cache fields for a specific model.
   * 
   * @param modelName - Technical model name
   * @param fields - Array of fields from ir.model.fields
   */
  setFields(modelName: string, fields: OdooField[]): void {
    this.fields.set(modelName, fields);
  }

  /**
   * Get cached metadata (model + fields) for a specific model.
   * 
   * @param modelName - Technical model name
   * @returns Cached metadata or undefined if not cached
   */
  getMetadata(modelName: string): ModelMetadata | undefined {
    return this.metadata.get(modelName);
  }

  /**
   * Cache metadata for a specific model.
   * 
   * @param modelName - Technical model name
   * @param metadata - Combined model and fields metadata
   */
  setMetadata(modelName: string, metadata: ModelMetadata): void {
    this.metadata.set(modelName, metadata);
  }

  /**
   * Clear all cached introspection data.
   * 
   * Use this if the Odoo schema changes (e.g., after module install/upgrade).
   */
  clear(): void {
    this.models = null;
    this.fields.clear();
    this.metadata.clear();
  }

  /**
   * Clear cached data for a specific model only.
   * 
   * @param modelName - Technical model name to clear from cache
   */
  clearModel(modelName: string): void {
    this.fields.delete(modelName);
    this.metadata.delete(modelName);
  }
}
