/**
 * Odoo model introspection implementation.
 * 
 * Queries Odoo's ir.model and ir.model.fields to discover available models
 * and their field definitions at runtime. This enables type generation and
 * provides metadata for state management operations.
 * 
 * @see https://github.com/odoo/odoo/blob/17.0/odoo/addons/base/models/ir_model.py
 * @see https://github.com/odoo/odoo/blob/17.0/odoo/addons/base/models/ir_model_fields.py
 */

import type { OdooClient } from '../client/odoo-client';
import type {
  OdooModel,
  OdooField,
  ModelMetadata,
  IntrospectionOptions,
} from './types';
import { IntrospectionCache } from './cache';

/**
 * Field type mapping from Odoo field types to TypeScript types.
 * 
 * This mapping is based on Odoo's field type system defined in odoo/fields.py.
 * 
 * Key mappings:
 * - String types (char, text, html) → string
 * - Numeric types (integer, float, monetary) → number
 * - Boolean → boolean
 * - Dates (date, datetime) → string (ISO 8601 format)
 * - Relational fields have special handling:
 *   - many2one: Can be number (when writing) or [number, string] (when reading)
 *   - one2many, many2many: Arrays of IDs (number[])
 * - Selection: string (could be narrowed to union of literals in codegen)
 * 
 * @see https://github.com/odoo/odoo/blob/17.0/odoo/fields.py for field type definitions
 */
export function mapOdooFieldTypeToTypeScript(odooType: string): string {
  const typeMap: Record<string, string> = {
    // String types
    char: 'string',
    text: 'string',
    html: 'string',
    
    // Numeric types
    integer: 'number',
    float: 'number',
    monetary: 'number',
    
    // Boolean
    boolean: 'boolean',
    
    // Date/time types
    // Odoo represents dates as strings in ISO 8601 format
    // See: odoo/fields.py:Date.to_string() and DateTime.to_string()
    date: 'string',
    datetime: 'string',
    
    // Relational fields
    // many2one: When reading, Odoo returns [id, display_name] tuples
    //           When writing, you pass just the id
    // See: odoo/fields.py:Many2one.convert_to_read() and convert_to_write()
    many2one: 'number | [number, string]',
    
    // one2many and many2many: Arrays of record IDs
    // See: odoo/fields.py:_RelationalMulti
    one2many: 'number[]',
    many2many: 'number[]',
    
    // Selection: String value from predefined choices
    // In codegen, this could be narrowed to union of string literals
    // See: odoo/fields.py:Selection
    selection: 'string',
    
    // Binary data (base64 encoded string)
    binary: 'string',
    
    // Reference field (polymorphic relation as "model,id" string)
    reference: 'string',
  };

  return typeMap[odooType] || 'any';
}

/**
 * Introspection service for querying Odoo model metadata.
 * 
 * This class provides methods to query ir.model and ir.model.fields
 * to discover models and their fields at runtime. Results are cached
 * to minimize RPC overhead.
 */
export class Introspector {
  private cache: IntrospectionCache;

  constructor(private client: OdooClient) {
    this.cache = new IntrospectionCache();
  }

  /**
   * Get all available models from Odoo.
   * 
   * Queries ir.model to retrieve all model definitions. By default,
   * excludes transient models (wizards/temporary models).
   * 
   * @param options - Introspection options
   * @returns Array of model metadata
   * 
   * @example
   * ```typescript
   * const models = await introspector.getModels();
   * console.log(models.map(m => m.model)); // ['res.partner', 'project.task', ...]
   * ```
   */
  async getModels(options: IntrospectionOptions = {}): Promise<OdooModel[]> {
    const {
      includeTransient = false,
      modules,
      bypassCache = false,
    } = options;

    // Check cache first
    if (!bypassCache) {
      const cached = this.cache.getModels();
      if (cached) {
        return this.filterModels(cached, { includeTransient, modules });
      }
    }

    // Build domain filter for ir.model query
    const domain: any[] = [];
    
    // Exclude transient models by default (wizards, temporary data)
    // Transient models are defined with _transient = True in Python
    // See: odoo/models.py:TransientModel
    if (!includeTransient) {
      domain.push(['transient', '=', false]);
    }

    // Query ir.model for all model definitions
    // Fields queried:
    // - model: Technical name (e.g., 'res.partner')
    // - name: Human-readable name (e.g., 'Contact')
    // - info: Optional description/help text
    // - transient: Boolean indicating if it's a TransientModel
    // - modules: Comma-separated list of modules defining/extending this model
    const models = await this.client.searchRead<OdooModel>(
      'ir.model',
      domain,
      {
        fields: ['model', 'name', 'info', 'transient', 'modules'],
        order: 'model',
      }
    );

    // Cache the complete result before filtering
    this.cache.setModels(models);

    return this.filterModels(models, { includeTransient, modules });
  }

  /**
   * Get all fields for a specific model.
   * 
   * Queries ir.model.fields to retrieve field definitions for the given model.
   * 
   * @param modelName - Technical model name (e.g., 'res.partner')
   * @param options - Introspection options
   * @returns Array of field metadata
   * 
   * @example
   * ```typescript
   * const fields = await introspector.getFields('res.partner');
   * const nameField = fields.find(f => f.name === 'name');
   * console.log(nameField.ttype); // 'char'
   * console.log(nameField.required); // true
   * ```
   */
  async getFields(
    modelName: string,
    options: IntrospectionOptions = {}
  ): Promise<OdooField[]> {
    const { bypassCache = false } = options;

    // Check cache first
    if (!bypassCache) {
      const cached = this.cache.getFields(modelName);
      if (cached) {
        return cached;
      }
    }

    // Query ir.model.fields for all fields of this model
    // Fields queried match the OdooField interface:
    // - name: Technical field name
    // - field_description: Human-readable label
    // - ttype: Odoo field type (char, integer, many2one, etc.)
    // - required: Whether field is mandatory
    // - readonly: Whether field is readonly/computed
    // - relation: For relational fields, the target model
    // - help: Help text shown in UI
    // - selection: For selection fields, the available choices
    // - compute: If set, indicates computed field
    // - model: The model this field belongs to
    const fields = await this.client.searchRead<OdooField>(
      'ir.model.fields',
      [['model', '=', modelName]],
      {
        fields: [
          'name',
          'field_description',
          'ttype',
          'required',
          'readonly',
          'relation',
          'help',
          'selection',
          'compute',
          'model',
        ],
        order: 'name',
      }
    );

    // Cache for future requests
    this.cache.setFields(modelName, fields);

    return fields;
  }

  /**
   * Get complete metadata for a model (model info + fields).
   * 
   * This is a convenience method that combines getModels() and getFields()
   * to retrieve complete model metadata in a single call.
   * 
   * @param modelName - Technical model name
   * @param options - Introspection options
   * @returns Combined model and field metadata
   * 
   * @example
   * ```typescript
   * const metadata = await introspector.getModelMetadata('res.partner');
   * console.log(metadata.model.name); // 'Contact'
   * console.log(metadata.fields.length); // 50+ fields
   * ```
   */
  async getModelMetadata(
    modelName: string,
    options: IntrospectionOptions = {}
  ): Promise<ModelMetadata> {
    const { bypassCache = false } = options;

    // Check cache first
    if (!bypassCache) {
      const cached = this.cache.getMetadata(modelName);
      if (cached) {
        return cached;
      }
    }

    // Fetch both model info and fields
    // We could parallelize these, but they're fast enough sequentially
    // and getModels() benefits from caching if called first
    const models = await this.getModels({ bypassCache });
    const model = models.find((m) => m.model === modelName);

    if (!model) {
      throw new Error(`Model '${modelName}' not found in Odoo instance`);
    }

    const fields = await this.getFields(modelName, { bypassCache });

    const metadata: ModelMetadata = {
      model,
      fields,
    };

    // Cache combined metadata
    this.cache.setMetadata(modelName, metadata);

    return metadata;
  }

  /**
   * Clear the introspection cache.
   * 
   * Use this after installing or upgrading Odoo modules, which can
   * add new models or fields.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear cached data for a specific model.
   * 
   * @param modelName - Model to clear from cache
   */
  clearModelCache(modelName: string): void {
    this.cache.clearModel(modelName);
  }

  /**
   * Filter models based on options.
   * 
   * @private
   */
  private filterModels(
    models: OdooModel[],
    options: Pick<IntrospectionOptions, 'includeTransient' | 'modules'>
  ): OdooModel[] {
    let filtered = models;

    // Filter by transient status
    if (!options.includeTransient) {
      filtered = filtered.filter((m) => !m.transient);
    }

    // Filter by module names
    if (options.modules && options.modules.length > 0) {
      filtered = filtered.filter((m) => {
        if (!m.modules) return false;
        const modelModules = m.modules.split(',').map((mod) => mod.trim());
        return options.modules!.some((mod) => modelModules.includes(mod));
      });
    }

    return filtered;
  }
}
