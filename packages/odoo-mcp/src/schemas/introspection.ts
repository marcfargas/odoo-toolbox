import { z } from 'zod';
import { OdooModel, OdooField, ModelMetadata } from '@odoo-toolbox/introspection';

export const GetModelsInputSchema = z.object({
  includeTransient: z.boolean().default(false).describe('Include wizard/transient models'),
  modules: z.array(z.string()).optional().describe('Filter by module names'),
  bypassCache: z.boolean().default(false).describe('Force fresh query'),
});

export type GetModelsInput = z.infer<typeof GetModelsInputSchema>;

export interface GetModelsOutput {
  success: boolean;
  models: OdooModel[];
  count: number;
  message: string;
}

export const GetFieldsInputSchema = z.object({
  model: z.string().min(1).describe('Model name'),
  bypassCache: z.boolean().default(false).describe('Force fresh query'),
});

export type GetFieldsInput = z.infer<typeof GetFieldsInputSchema>;

export interface GetFieldsOutput {
  success: boolean;
  fields: OdooField[];
  count: number;
  message: string;
}

export const GetModelMetadataInputSchema = z.object({
  model: z.string().min(1).describe('Model name'),
  bypassCache: z.boolean().default(false).describe('Force fresh query'),
});

export type GetModelMetadataInput = z.infer<typeof GetModelMetadataInputSchema>;

export interface GetModelMetadataOutput {
  success: boolean;
  metadata?: ModelMetadata;
  message: string;
}

export const GenerateTypesInputSchema = z.object({
  models: z.array(z.string()).optional().describe('Models to generate (empty = all)'),
  includeTransient: z.boolean().default(false).describe('Include wizard/transient models'),
});

export type GenerateTypesInput = z.infer<typeof GenerateTypesInputSchema>;

export interface GenerateTypesOutput {
  success: boolean;
  typescript?: string;
  modelCount: number;
  message: string;
}
