/**
 * Base schema for ir.model.fields - Odoo field registry.
 *
 * This model stores metadata about all fields in all models.
 * Used by introspection tools to discover field definitions.
 *
 * @see https://github.com/odoo/odoo/blob/17.0/odoo/addons/base/models/ir_model.py
 */

import type { BaseModelSchema } from './types.js';

export const IR_MODEL_FIELDS_BASE: BaseModelSchema = {
  model: 'ir.model.fields',
  description:
    'Odoo field registry - metadata about all fields in all models. Query this to discover available fields for a specific model.',
  fields: {
    id: {
      type: 'integer',
      description: 'Unique identifier for this field registry entry',
    },
    name: {
      type: 'string',
      description: 'Technical field name (e.g., "partner_id", "name", "amount_total")',
    },
    field_description: {
      type: 'string',
      description: 'Human-readable field label shown in the UI (e.g., "Customer", "Name", "Total")',
    },
    model: {
      type: 'string',
      description: 'Technical name of the model this field belongs to (e.g., "sale.order")',
    },
    model_id: {
      type: ['array', 'null'],
      description: 'Reference to ir.model record [id, display_name]',
      relation: 'ir.model',
    },
    ttype: {
      type: 'string',
      description: 'Odoo field type (type of type)',
      enum: [
        'char',
        'text',
        'html',
        'integer',
        'float',
        'monetary',
        'boolean',
        'date',
        'datetime',
        'binary',
        'selection',
        'reference',
        'many2one',
        'one2many',
        'many2many',
        'properties',
        'properties_definition',
      ],
    },
    required: {
      type: 'boolean',
      description: 'True if this field must have a value (cannot be null/empty)',
    },
    readonly: {
      type: 'boolean',
      description:
        'True if this field is read-only (computed or system-managed). Readonly fields cannot be written directly.',
    },
    relation: {
      type: ['string', 'null'],
      description:
        'For relational fields (many2one, one2many, many2many), the target model name (e.g., "res.partner")',
    },
    relation_field: {
      type: ['string', 'null'],
      description: 'For one2many fields, the inverse field name on the related model',
    },
    help: {
      type: ['string', 'null'],
      description: 'Help text/tooltip shown in the UI explaining this field',
    },
    selection: {
      type: ['string', 'null'],
      description:
        'For selection fields, the available choices as a Python-format string representation of a list of tuples',
    },
    compute: {
      type: ['string', 'null'],
      description:
        'If set, indicates this is a computed field. Contains the compute method reference.',
    },
    store: {
      type: 'boolean',
      description:
        'True if this field is stored in the database. Computed fields may or may not be stored.',
    },
    index: {
      type: 'boolean',
      description: 'True if this field has a database index for faster searches',
    },
    copied: {
      type: 'boolean',
      description: 'True if this field is copied when duplicating a record',
    },
    state: {
      type: 'string',
      description: 'Field state: "manual" for custom fields, "base" for core fields',
      enum: ['manual', 'base'],
    },
    modules: {
      type: ['string', 'null'],
      description: 'Comma-separated list of modules that define or extend this field',
    },
  },
  required: ['id', 'name', 'model', 'ttype'],
};
