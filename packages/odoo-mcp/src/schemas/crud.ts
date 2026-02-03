import { z } from 'zod';

export const SearchInputSchema = z.object({
  model: z.string().min(1).describe("Model name (e.g., 'res.partner')"),
  domain: z
    .array(z.any())
    .default([])
    .describe("Search domain filter (e.g., [['active', '=', true]])"),
  offset: z.number().int().nonnegative().optional().describe('Number of records to skip'),
  limit: z.number().int().positive().optional().describe('Maximum records to return'),
  order: z.string().optional().describe("Sort order (e.g., 'name asc, id desc')"),
});

export type SearchInput = z.infer<typeof SearchInputSchema>;

export interface SearchOutput {
  success: boolean;
  ids: number[];
  count: number;
  message: string;
}

export const ReadInputSchema = z.object({
  model: z.string().min(1).describe('Model name'),
  ids: z.union([z.number().int(), z.array(z.number().int())]).describe('Record ID(s) to read'),
  fields: z.array(z.string()).optional().describe('Fields to read (empty = all fields)'),
});

export type ReadInput = z.infer<typeof ReadInputSchema>;

export interface ReadOutput {
  success: boolean;
  records: Record<string, unknown>[];
  count: number;
  message: string;
}

export const SearchReadInputSchema = z.object({
  model: z.string().min(1).describe('Model name'),
  domain: z.array(z.any()).default([]).describe('Search domain filter'),
  fields: z.array(z.string()).optional().describe('Fields to return'),
  offset: z.number().int().nonnegative().optional().describe('Number of records to skip'),
  limit: z.number().int().positive().optional().describe('Maximum records to return'),
  order: z.string().optional().describe('Sort order'),
});

export type SearchReadInput = z.infer<typeof SearchReadInputSchema>;

export interface SearchReadOutput {
  success: boolean;
  records: Record<string, unknown>[];
  count: number;
  message: string;
}

export const CreateInputSchema = z.object({
  model: z.string().min(1).describe('Model name'),
  values: z.record(z.any()).describe('Field values for new record'),
  context: z.record(z.any()).optional().describe('Optional context for creation'),
});

export type CreateInput = z.infer<typeof CreateInputSchema>;

export interface CreateOutput {
  success: boolean;
  id?: number;
  message: string;
}

export const WriteInputSchema = z.object({
  model: z.string().min(1).describe('Model name'),
  ids: z.union([z.number().int(), z.array(z.number().int())]).describe('Record ID(s) to update'),
  values: z.record(z.any()).describe('Field values to update'),
  context: z.record(z.any()).optional().describe('Optional context'),
});

export type WriteInput = z.infer<typeof WriteInputSchema>;

export interface WriteOutput {
  success: boolean;
  updated: boolean;
  count: number;
  message: string;
}

export const UnlinkInputSchema = z.object({
  model: z.string().min(1).describe('Model name'),
  ids: z.union([z.number().int(), z.array(z.number().int())]).describe('Record ID(s) to delete'),
});

export type UnlinkInput = z.infer<typeof UnlinkInputSchema>;

export interface UnlinkOutput {
  success: boolean;
  deleted: boolean;
  count: number;
  message: string;
}

export const CallInputSchema = z.object({
  model: z.string().min(1).describe('Model name'),
  method: z.string().min(1).describe('Method name to call'),
  args: z.array(z.any()).default([]).describe('Positional arguments'),
  kwargs: z.record(z.any()).default({}).describe('Keyword arguments'),
});

export type CallInput = z.infer<typeof CallInputSchema>;

export interface CallOutput {
  success: boolean;
  result?: unknown;
  message: string;
}
