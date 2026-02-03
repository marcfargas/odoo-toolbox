/**
 * Base schemas for Odoo models used by the MCP server.
 *
 * These schemas provide documented field definitions for core Odoo models
 * that the MCP server uses internally. They are merged with live field
 * data from Odoo introspection to provide complete, well-documented schemas.
 */

export * from './types.js';
export * from './field-mapper.js';

export { IR_MODEL_BASE } from './ir-model.js';
export { IR_MODEL_FIELDS_BASE } from './ir-model-fields.js';
export { IR_MODULE_MODULE_BASE } from './ir-module-module.js';
export { MAIL_MESSAGE_BASE } from './mail-message.js';
export { MAIL_ACTIVITY_BASE } from './mail-activity.js';
export { MAIL_FOLLOWERS_BASE } from './mail-followers.js';

import type { BaseModelSchema } from './types.js';
import { IR_MODEL_BASE } from './ir-model.js';
import { IR_MODEL_FIELDS_BASE } from './ir-model-fields.js';
import { IR_MODULE_MODULE_BASE } from './ir-module-module.js';
import { MAIL_MESSAGE_BASE } from './mail-message.js';
import { MAIL_ACTIVITY_BASE } from './mail-activity.js';
import { MAIL_FOLLOWERS_BASE } from './mail-followers.js';

/**
 * Registry of all base schemas keyed by model name.
 */
export const BASE_SCHEMAS: Record<string, BaseModelSchema> = {
  'ir.model': IR_MODEL_BASE,
  'ir.model.fields': IR_MODEL_FIELDS_BASE,
  'ir.module.module': IR_MODULE_MODULE_BASE,
  'mail.message': MAIL_MESSAGE_BASE,
  'mail.activity': MAIL_ACTIVITY_BASE,
  'mail.followers': MAIL_FOLLOWERS_BASE,
};

/**
 * Check if a model has a base schema.
 */
export function hasBaseSchema(model: string): boolean {
  return model in BASE_SCHEMAS;
}

/**
 * Get the base schema for a model, or undefined if none exists.
 */
export function getBaseSchema(model: string): BaseModelSchema | undefined {
  return BASE_SCHEMAS[model];
}
