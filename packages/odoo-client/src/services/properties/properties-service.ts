/**
 * Properties service — the typed interface exposed via `client.properties.*`
 *
 * This is the public API shape. Implementation delegates to standalone
 * functions in functions.ts, binding the client reference.
 */

import type { OdooClient } from '../../client/odoo-client';
import type { PropertiesUpdate } from './types';
import {
  updateSafely as _updateSafely,
  updateSafelyBatch as _updateSafelyBatch,
  getCurrentWriteFormat as _getCurrentWriteFormat,
} from './functions';

/**
 * Properties service providing safe operations for Odoo properties fields.
 *
 * Access via `client.properties` — never instantiate directly.
 *
 * Properties in Odoo use full-replacement semantics. When you write properties,
 * Odoo replaces ALL values. This service prevents data loss by automatically
 * reading current values, merging your changes, and writing everything back.
 */
export class PropertiesService {
  /** @internal */
  constructor(private client: OdooClient) {}

  /**
   * Safely update properties on a record by merging with existing values.
   *
   * This prevents accidental data loss by automatically reading current
   * properties, merging your changes, and writing back all properties.
   *
   * @param model - Model name (e.g., 'crm.lead')
   * @param recordId - Record ID to update
   * @param propertiesField - Properties field name (e.g., 'lead_properties')
   * @param updates - Properties to update (partial object)
   * @returns Promise that resolves when update is complete
   *
   * @example
   * ```typescript
   * // Safe - only updates priority, preserves everything else
   * await client.properties.updateSafely(
   *   'crm.lead',
   *   leadId,
   *   'lead_properties',
   *   { priority: 'critical' }
   * );
   * ```
   */
  async updateSafely(
    model: string,
    recordId: number,
    propertiesField: string,
    updates: PropertiesUpdate
  ): Promise<void> {
    return _updateSafely(this.client, model, recordId, propertiesField, updates);
  }

  /**
   * Safely update properties on multiple records.
   *
   * Applies the same property updates to multiple records while preserving
   * existing values on each record.
   *
   * @param model - Model name (e.g., 'crm.lead')
   * @param recordIds - Record IDs to update
   * @param propertiesField - Properties field name (e.g., 'lead_properties')
   * @param updates - Properties to update (partial object)
   * @returns Promise that resolves when all updates are complete
   *
   * @example
   * ```typescript
   * // Update priority on multiple leads
   * await client.properties.updateSafelyBatch(
   *   'crm.lead',
   *   [123, 456, 789],
   *   'lead_properties',
   *   { priority: 'high', updated_by_batch: true }
   * );
   * ```
   */
  async updateSafelyBatch(
    model: string,
    recordIds: number[],
    propertiesField: string,
    updates: PropertiesUpdate
  ): Promise<void> {
    return _updateSafelyBatch(this.client, model, recordIds, propertiesField, updates);
  }

  /**
   * Get current properties in write format for a record.
   *
   * Useful when you need to inspect current values before updating.
   *
   * @param model - Model name (e.g., 'crm.lead')
   * @param recordId - Record ID
   * @param propertiesField - Properties field name (e.g., 'lead_properties')
   * @returns Current properties in write format
   *
   * @example
   * ```typescript
   * const current = await client.properties.getCurrentWriteFormat(
   *   'crm.lead',
   *   leadId,
   *   'lead_properties'
   * );
   * console.log(`Current priority: ${current.priority}`);
   * ```
   */
  async getCurrentWriteFormat(
    model: string,
    recordId: number,
    propertiesField: string
  ): Promise<Record<string, any>> {
    return _getCurrentWriteFormat(this.client, model, recordId, propertiesField);
  }
}
