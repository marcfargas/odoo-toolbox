/**
 * Base schema for ir.module.module - Odoo module registry.
 *
 * This model stores metadata about all installed and available modules.
 * Used by module management tools.
 *
 * @see https://github.com/odoo/odoo/blob/17.0/odoo/addons/base/models/ir_module.py
 */

import type { BaseModelSchema } from './types.js';

export const IR_MODULE_MODULE_BASE: BaseModelSchema = {
  model: 'ir.module.module',
  description:
    'Odoo module registry - metadata about installed and available modules. Query this to discover what functionality is available.',
  fields: {
    id: {
      type: 'integer',
      description: 'Unique identifier for this module registry entry',
    },
    name: {
      type: 'string',
      description: 'Technical module name (e.g., "sale", "crm", "project")',
    },
    shortdesc: {
      type: ['string', 'null'],
      description: 'Short description/title of the module (e.g., "Sales", "CRM")',
    },
    summary: {
      type: ['string', 'null'],
      description: 'Brief summary of module functionality',
    },
    description: {
      type: ['string', 'null'],
      description: 'Full module description (may contain RST/HTML formatting)',
    },
    author: {
      type: ['string', 'null'],
      description: 'Module author (e.g., "Odoo SA", "OCA")',
    },
    website: {
      type: ['string', 'null'],
      description: 'Module website or documentation URL',
    },
    category_id: {
      type: ['array', 'null'],
      description: 'Module category [id, name] (e.g., "Sales", "Accounting")',
      relation: 'ir.module.category',
    },
    state: {
      type: 'string',
      description: 'Module installation state',
      enum: ['uninstallable', 'uninstalled', 'installed', 'to upgrade', 'to remove', 'to install'],
    },
    installed_version: {
      type: ['string', 'null'],
      description: 'Currently installed version string (e.g., "17.0.1.0.0")',
    },
    latest_version: {
      type: ['string', 'null'],
      description: 'Latest available version string',
    },
    dependencies_id: {
      type: 'array',
      items: { type: 'integer' },
      description: 'Module dependency IDs',
      relation: 'ir.module.module.dependency',
    },
    auto_install: {
      type: 'boolean',
      description: 'True if module auto-installs when all dependencies are met (glue modules)',
    },
    application: {
      type: 'boolean',
      description: 'True if this is a main application (shown in app switcher)',
    },
    license: {
      type: ['string', 'null'],
      description: 'Module license (e.g., "LGPL-3", "AGPL-3", "OPL-1")',
    },
    demo: {
      type: 'boolean',
      description: 'True if demo data is available for this module',
    },
  },
  required: ['id', 'name', 'state'],
};
