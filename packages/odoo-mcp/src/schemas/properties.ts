/**
 * Zod schemas for properties MCP tools.
 */

import { z } from 'zod';

// ============================================================================
// Read Properties
// ============================================================================

export const ReadPropertiesInputSchema = z.object({
  model: z.string().min(1).describe('Model name (e.g., crm.lead, project.task)'),
  id: z.number().int().positive().describe('Record ID'),
  property_field: z
    .string()
    .optional()
    .describe('Properties field name (auto-detected if omitted)'),
  format: z
    .enum(['raw', 'simple', 'both'])
    .default('both')
    .describe('Output format: raw (Odoo format), simple (key-value), or both'),
});

export type ReadPropertiesInput = z.infer<typeof ReadPropertiesInputSchema>;

export interface PropertyRawValue {
  name: string;
  type: string;
  string: string;
  value: unknown;
  selection?: Array<{ value: string; label: string }>;
  comodel?: string;
}

export interface ReadPropertiesOutput {
  success: boolean;
  property_field?: string;
  raw?: PropertyRawValue[];
  simple?: Record<string, unknown>;
  count?: number;
  message: string;
}

// ============================================================================
// Update Properties
// ============================================================================

export const UpdatePropertiesInputSchema = z.object({
  model: z.string().min(1).describe('Model name (e.g., crm.lead, project.task)'),
  id: z.number().int().positive().describe('Record ID'),
  updates: z
    .record(z.unknown())
    .describe('Property values to update (partial update - only specified properties are changed)'),
  property_field: z
    .string()
    .optional()
    .describe('Properties field name (auto-detected if omitted)'),
});

export type UpdatePropertiesInput = z.infer<typeof UpdatePropertiesInputSchema>;

export interface UpdatePropertiesOutput {
  success: boolean;
  updated_properties?: string[];
  property_field?: string;
  message: string;
}

// ============================================================================
// Find Properties Field
// ============================================================================

export const FindPropertiesFieldInputSchema = z.object({
  model: z.string().min(1).describe('Model name to check for properties field'),
});

export type FindPropertiesFieldInput = z.infer<typeof FindPropertiesFieldInputSchema>;

export interface FindPropertiesFieldOutput {
  success: boolean;
  has_properties: boolean;
  property_field?: string;
  definition_model?: string;
  definition_field?: string;
  message: string;
}

// ============================================================================
// Get Property Definitions
// ============================================================================

export const GetPropertyDefinitionsInputSchema = z.object({
  model: z.string().min(1).describe('Record model (e.g., crm.lead)'),
  parent_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Parent record ID (e.g., team_id for leads)'),
});

export type GetPropertyDefinitionsInput = z.infer<typeof GetPropertyDefinitionsInputSchema>;

export interface PropertyDefinition {
  name: string;
  string: string;
  type: string;
  selection?: Array<{ value: string; label: string }>;
  comodel?: string;
  default?: unknown;
}

export interface GetPropertyDefinitionsOutput {
  success: boolean;
  definitions?: PropertyDefinition[];
  definition_model?: string;
  definition_field?: string;
  count?: number;
  message: string;
}

// ============================================================================
// Set Property Definitions
// ============================================================================

const PropertyDefinitionSchema = z.object({
  name: z.string().min(1).describe('Technical name (no spaces, lowercase)'),
  string: z.string().min(1).describe('Display label'),
  type: z
    .enum([
      'boolean',
      'integer',
      'float',
      'char',
      'date',
      'datetime',
      'selection',
      'many2one',
      'many2many',
      'tags',
      'separator',
    ])
    .describe('Property type'),
  selection: z
    .array(
      z.object({
        value: z.string(),
        label: z.string(),
      })
    )
    .optional()
    .describe('Options for selection type'),
  comodel: z.string().optional().describe('Related model for many2one/many2many types'),
  default: z.unknown().optional().describe('Default value'),
});

export const SetPropertyDefinitionsInputSchema = z.object({
  definition_model: z.string().min(1).describe('Model holding definitions (e.g., crm.team)'),
  definition_id: z.number().int().positive().describe('Record ID on definition model'),
  definition_field: z
    .string()
    .optional()
    .describe('Definition field name (auto-detected if possible)'),
  definitions: z.array(PropertyDefinitionSchema).describe('Property definitions to set'),
  mode: z
    .enum(['replace', 'merge'])
    .default('replace')
    .describe('replace = overwrite all, merge = add/update by name'),
});

export type SetPropertyDefinitionsInput = z.infer<typeof SetPropertyDefinitionsInputSchema>;

export interface SetPropertyDefinitionsOutput {
  success: boolean;
  property_count?: number;
  message: string;
}
