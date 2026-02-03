/**
 * Base schema for ir.model - Odoo model registry.
 *
 * This model stores metadata about all database models (tables) in Odoo.
 * Used by introspection tools to discover available models.
 *
 * @see https://github.com/odoo/odoo/blob/17.0/odoo/addons/base/models/ir_model.py
 */

import type { BaseModelSchema } from './types.js';

export const IR_MODEL_BASE: BaseModelSchema = {
  model: 'ir.model',
  description:
    'Odoo model registry - metadata about all database models. Query this to discover available models in the system.',
  fields: {
    id: {
      type: 'integer',
      description: 'Unique identifier for this model registry entry',
    },
    model: {
      type: 'string',
      description:
        'Technical model name using dot notation (e.g., "res.partner", "sale.order"). This is the name used in API calls.',
    },
    name: {
      type: 'string',
      description: 'Human-readable model name shown in the UI (e.g., "Contact", "Sales Order")',
    },
    info: {
      type: ['string', 'null'],
      description: 'Optional description or documentation for the model',
    },
    transient: {
      type: 'boolean',
      description:
        'True if this is a transient/wizard model (temporary data, not stored permanently). TransientModels are used for wizards and temporary UI states.',
    },
    modules: {
      type: ['string', 'null'],
      description:
        'Comma-separated list of module names that define or extend this model (e.g., "base,sale,crm"). Useful for finding module-specific models.',
    },
    state: {
      type: 'string',
      description: 'Model state: "manual" for custom models, "base" for core models',
      enum: ['manual', 'base'],
    },
    access_ids: {
      type: 'array',
      items: { type: 'integer' },
      description: 'Access control list IDs (ir.model.access records)',
      relation: 'ir.model.access',
    },
    rule_ids: {
      type: 'array',
      items: { type: 'integer' },
      description: 'Record rule IDs for row-level security',
      relation: 'ir.rule',
    },
    field_id: {
      type: 'array',
      items: { type: 'integer' },
      description: 'Field definition IDs for this model',
      relation: 'ir.model.fields',
    },
  },
  required: ['id', 'model', 'name'],
};
