/**
 * Properties functions — implementation for the properties service
 */

import type { OdooClient } from '../../client/odoo-client';
import { propertiesToWriteFormat } from '../../types/properties';
import type { PropertiesUpdate } from './types';

/**
 * Safely update properties on a record by merging with existing values
 *
 * This prevents accidental data loss by:
 * 1. Reading the current properties
 * 2. Converting to write format
 * 3. Merging your changes
 * 4. Writing back all properties
 *
 * @param client - Authenticated Odoo client
 * @param model - Model name (e.g., 'crm.lead')
 * @param recordId - Record ID to update
 * @param propertiesField - Properties field name (e.g., 'lead_properties')
 * @param updates - Properties to update (partial object)
 * @returns Promise that resolves when update is complete
 */
export async function updateSafely(
  client: OdooClient,
  model: string,
  recordId: number,
  propertiesField: string,
  updates: PropertiesUpdate
): Promise<void> {
  // Read current properties
  const [record] = await client.read(model, [recordId], [propertiesField]);

  if (!record || !record[propertiesField]) {
    throw new Error(`Record ${recordId} not found or has no ${propertiesField} field`);
  }

  // Convert to write format and merge updates
  const currentProps = propertiesToWriteFormat(record[propertiesField]);
  const mergedProps = { ...currentProps, ...updates };

  // Write back all properties
  await client.write(model, recordId, {
    [propertiesField]: mergedProps,
  });
}

/**
 * Safely update properties on multiple records
 *
 * @param client - Authenticated Odoo client
 * @param model - Model name (e.g., 'crm.lead')
 * @param recordIds - Record IDs to update
 * @param propertiesField - Properties field name (e.g., 'lead_properties')
 * @param updates - Properties to update (partial object)
 * @returns Promise that resolves when all updates are complete
 */
export async function updateSafelyBatch(
  client: OdooClient,
  model: string,
  recordIds: number[],
  propertiesField: string,
  updates: PropertiesUpdate
): Promise<void> {
  if (recordIds.length === 0) return;

  // Read all current properties
  const records = await client.read(model, recordIds, [propertiesField]);

  // Prepare updates for each record
  const writeOperations = records.map((record) => {
    if (!record[propertiesField]) {
      throw new Error(`Record ${record.id} has no ${propertiesField} field`);
    }

    const currentProps = propertiesToWriteFormat(record[propertiesField]);
    const mergedProps = { ...currentProps, ...updates };

    return client.write(model, record.id, {
      [propertiesField]: mergedProps,
    });
  });

  // Execute all updates
  await Promise.all(writeOperations);
}

/**
 * Get current properties in write format for a record
 *
 * Useful when you need to inspect current values before updating.
 *
 * @param client - Authenticated Odoo client
 * @param model - Model name (e.g., 'crm.lead')
 * @param recordId - Record ID
 * @param propertiesField - Properties field name (e.g., 'lead_properties')
 * @returns Current properties in write format
 */
export async function getCurrentWriteFormat(
  client: OdooClient,
  model: string,
  recordId: number,
  propertiesField: string
): Promise<Record<string, any>> {
  const [record] = await client.read(model, [recordId], [propertiesField]);

  if (!record || !record[propertiesField]) {
    throw new Error(`Record ${recordId} not found or has no ${propertiesField} field`);
  }

  return propertiesToWriteFormat(record[propertiesField]);
}
