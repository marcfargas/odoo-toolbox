/**
 * PropertiesService - Business logic for Odoo properties fields
 *
 * Provides high-level API for:
 * - Auto-detecting properties fields on models
 * - Reading property values
 * - Safely updating properties with read-modify-write pattern
 * - Managing property definitions
 *
 * Properties are user-definable fields that can be created dynamically via the Odoo UI.
 * They have asymmetric read/write formats and require special handling.
 *
 * @see https://github.com/odoo/odoo/blob/17.0/odoo/fields.py#L3188 - Properties field
 * @see https://github.com/odoo/odoo/blob/17.0/odoo/fields.py#L3419 - PropertiesDefinition field
 */

import debug from 'debug';
import type { OdooClient } from '../client/odoo-client';
import {
  PropertiesDefinition,
  PropertiesReadFormat,
  PropertiesWriteFormat,
  propertiesToWriteFormat,
} from '../types/properties';

const log = debug('odoo-client:properties-service');

/**
 * Common model to properties field mappings
 *
 * Known properties fields in standard Odoo modules.
 * Used as a fallback when auto-detection is needed.
 */
export const PROPERTY_FIELD_MAPPINGS: Record<string, string> = {
  'crm.lead': 'lead_properties',
  'project.task': 'task_properties',
  'project.project': 'project_properties',
  'sale.order': 'order_properties',
  'product.template': 'product_properties',
};

/**
 * Auto-detect properties field for a model
 *
 * Searches for fields of type 'properties' on the given model.
 * Falls back to known mappings if introspection fails.
 *
 * @param client - OdooClient instance
 * @param model - Model name
 * @returns Properties field name, or null if not found
 *
 * @example
 * ```typescript
 * const field = await findPropertiesFieldOnModel(client, 'crm.lead');
 * // Returns: 'lead_properties'
 * ```
 */
export async function findPropertiesFieldOnModel(
  client: OdooClient,
  model: string
): Promise<string | null> {
  log('Finding properties field for model: %s', model);

  // Try introspection first
  try {
    const fields = await client.searchRead<{ name: string; ttype: string }>(
      'ir.model.fields',
      [
        ['model', '=', model],
        ['ttype', '=', 'properties'],
      ],
      { fields: ['name'], limit: 1 }
    );

    if (fields.length > 0) {
      log('Found properties field via introspection: %s', fields[0].name);
      return fields[0].name;
    }
  } catch (error) {
    log('Introspection failed: %s', error);
  }

  // Fall back to known mappings
  if (model in PROPERTY_FIELD_MAPPINGS) {
    log('Using known mapping for %s: %s', model, PROPERTY_FIELD_MAPPINGS[model]);
    return PROPERTY_FIELD_MAPPINGS[model];
  }

  log('No properties field found for model: %s', model);
  return null;
}

/**
 * Service for managing properties in Odoo
 *
 * Handles the complexity of properties fields, including:
 * - Asymmetric read/write formats
 * - Safe partial updates (read-modify-write pattern)
 * - Property definition management
 */
export class PropertiesService {
  constructor(private client: OdooClient) {}

  /**
   * Find the properties field for a model
   *
   * @param model - Model name
   * @returns Properties field name, or null if not found
   */
  async findPropertiesField(model: string): Promise<string | null> {
    return findPropertiesFieldOnModel(this.client, model);
  }

  /**
   * Read property values from a record
   *
   * @param model - Model name
   * @param recordId - Record ID
   * @param field - Properties field name (optional, auto-detected if not provided)
   * @returns Properties in read format (array with metadata)
   *
   * @example
   * ```typescript
   * const properties = await propertiesService.read('crm.lead', leadId);
   * // Returns: [{ name: 'priority', type: 'selection', value: 'high', ... }, ...]
   * ```
   */
  async read(model: string, recordId: number, field?: string): Promise<PropertiesReadFormat> {
    const propertyField = field || (await this.findPropertiesField(model));

    if (!propertyField) {
      throw new Error(`No properties field found for model: ${model}`);
    }

    log('Reading properties for %s/%d (field: %s)', model, recordId, propertyField);

    const records = await this.client.read(model, recordId, [propertyField]);

    if (records.length === 0) {
      throw new Error(`Record not found: ${model}/${recordId}`);
    }

    const properties = records[0][propertyField] || [];
    log('Read %d properties', properties.length);
    return properties;
  }

  /**
   * Update property values on a record
   *
   * Uses safe read-modify-write pattern to preserve unmodified properties.
   * CRITICAL: Odoo replaces ALL properties when writing, so we must:
   * 1. Read current properties
   * 2. Merge with new values
   * 3. Write back all properties
   *
   * @param model - Model name
   * @param recordId - Record ID
   * @param values - Property values to update (key-value pairs)
   * @param field - Properties field name (optional, auto-detected if not provided)
   * @param merge - Whether to merge with existing properties (default: true)
   *
   * @example
   * ```typescript
   * // Update only priority, preserving other properties
   * await propertiesService.update('crm.lead', leadId, {
   *   priority: 'high'
   * });
   * ```
   */
  async update(
    model: string,
    recordId: number,
    values: PropertiesWriteFormat,
    field?: string,
    merge = true
  ): Promise<void> {
    const propertyField = field || (await this.findPropertiesField(model));

    if (!propertyField) {
      throw new Error(`No properties field found for model: ${model}`);
    }

    log('Updating properties for %s/%d (field: %s)', model, recordId, propertyField);

    let finalValues = values;

    if (merge) {
      // Read current properties and merge
      const currentProperties = await this.read(model, recordId, propertyField);
      const currentValues = propertiesToWriteFormat(currentProperties);

      finalValues = {
        ...currentValues,
        ...values,
      };

      log(
        'Merged %d new values with %d existing properties',
        Object.keys(values).length,
        Object.keys(currentValues).length
      );
    }

    await this.client.write(model, recordId, {
      [propertyField]: finalValues,
    });

    log('Updated properties successfully');
  }

  /**
   * Get property definitions for a model
   *
   * Retrieves the PropertiesDefinition field which defines available properties.
   * For most models, this is stored on a parent record (e.g., crm.team for crm.lead).
   *
   * @param model - Model name
   * @param parentId - Parent record ID (e.g., team ID for leads)
   * @returns Property definitions
   *
   * @example
   * ```typescript
   * // Get lead property definitions from team
   * const definitions = await propertiesService.getDefinitions('crm.lead', teamId);
   * ```
   */
  async getDefinitions(model: string, parentId?: number): Promise<PropertiesDefinition> {
    log('Getting property definitions for model: %s', model);

    // Map model to definition source
    const definitionSources: Record<string, { model: string; field: string }> = {
      'crm.lead': { model: 'crm.team', field: 'lead_properties_definition' },
      'project.task': { model: 'project.project', field: 'task_properties_definition' },
    };

    const source = definitionSources[model];
    if (!source) {
      throw new Error(`Property definitions not supported for model: ${model}`);
    }

    if (!parentId) {
      throw new Error(`Parent ID required to get property definitions for ${model}`);
    }

    const records = await this.client.read(source.model, parentId, [source.field]);

    if (records.length === 0) {
      throw new Error(`Parent record not found: ${source.model}/${parentId}`);
    }

    const definitions = records[0][source.field] || [];
    log('Retrieved %d property definitions', definitions.length);
    return definitions;
  }

  /**
   * Set property definitions for a model
   *
   * Updates the PropertiesDefinition field on the parent record.
   *
   * @param model - Model name
   * @param parentId - Parent record ID
   * @param definitions - Property definitions to set
   * @param merge - Whether to merge with existing definitions (default: false)
   *
   * @example
   * ```typescript
   * await propertiesService.setDefinitions('crm.lead', teamId, [
   *   { name: 'priority', string: 'Priority', type: 'selection', selection: [...] }
   * ]);
   * ```
   */
  async setDefinitions(
    model: string,
    parentId: number,
    definitions: PropertiesDefinition,
    merge = false
  ): Promise<void> {
    log('Setting property definitions for model: %s', model);

    const definitionSources: Record<string, { model: string; field: string }> = {
      'crm.lead': { model: 'crm.team', field: 'lead_properties_definition' },
      'project.task': { model: 'project.project', field: 'task_properties_definition' },
    };

    const source = definitionSources[model];
    if (!source) {
      throw new Error(`Property definitions not supported for model: ${model}`);
    }

    let finalDefinitions = definitions;

    if (merge) {
      const currentDefinitions = await this.getDefinitions(model, parentId);
      // Merge by name, new definitions override existing ones
      const definitionMap = new Map(currentDefinitions.map((d) => [d.name, d]));
      definitions.forEach((d) => definitionMap.set(d.name, d));
      finalDefinitions = Array.from(definitionMap.values());

      log(
        'Merged %d new definitions with %d existing',
        definitions.length,
        currentDefinitions.length
      );
    }

    await this.client.write(source.model, parentId, {
      [source.field]: finalDefinitions,
    });

    log('Set property definitions successfully');
  }
}
