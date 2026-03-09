import type { OdooClient } from '@marcfargas/odoo-client';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { z, ZodError } from 'zod';
import type { AuditWriter } from '../audit';
import { formatMcpError, mcpError, toValidationError } from '../errors';
import {
  buildPagination,
  enforceLimit,
  enforceOffset,
  isPayloadOversize,
  type PaginationInfo,
} from '../limits';
import { allows, type PolicyRule } from '../policy';

const MAX_IDS = 200;
const SEARCH_DEFAULT_LIMIT = 80;

type ResponseFormat = 'json' | 'markdown';

interface SearchResponse {
  records: Record<string, unknown>[];
  pagination: PaginationInfo;
  model: string;
  fields: string[];
}

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: z.ZodRawShape;
  annotations: ToolAnnotations;
  handler: (args: unknown) => Promise<CallToolResult>;
};

interface InternalToolDefinition extends ToolDefinition {
  inputShape: z.ZodRawShape;
}

export interface CrudToolContext {
  client: OdooClient;
  getPolicy: () => PolicyRule[];
  audit: AuditWriter;
  userLogin: string;
}

const SEARCH_TOOL_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

const GET_TOOL_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

const CREATE_TOOL_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
};

const WRITE_TOOL_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

const SEARCH_INPUT_SHAPE = {
  model: z.string().trim().min(1).describe('Odoo model name, e.g. res.partner.'),
  domain: z.array(z.unknown()).default([]).describe('Odoo domain filter. Defaults to [].'),
  fields: z.array(z.string()).default([]).describe('Fields to fetch. Defaults to [].'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(500)
    .default(SEARCH_DEFAULT_LIMIT)
    .describe('Max records to return. Default 80, max 500.'),
  offset: z.number().int().min(0).default(0).describe('Offset for pagination. Default 0.'),
  context: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Optional Odoo context (lang, tz, allowed_company_ids, …).'),
  response_format: z
    .enum(['json', 'markdown'])
    .default('json')
    .describe("Output format: 'json' for structured data, 'markdown' for a readable table."),
};

const SEARCH_ARGS_SCHEMA = z.object(SEARCH_INPUT_SHAPE);

const GET_INPUT_SHAPE = {
  model: z.string().trim().min(1).describe('Odoo model name.'),
  ids: z
    .array(z.number().int().positive())
    .min(1)
    .max(MAX_IDS)
    .describe(`Record IDs to fetch. Max ${MAX_IDS}.`),
  fields: z.array(z.string()).default([]).describe('Fields to fetch. Defaults to [].'),
  context: z.record(z.string(), z.unknown()).optional().describe('Optional Odoo context.'),
};

const GET_ARGS_SCHEMA = z.object(GET_INPUT_SHAPE);

const CREATE_INPUT_SHAPE = {
  model: z.string().trim().min(1).describe('Odoo model name.'),
  values: z
    .record(z.string(), z.unknown())
    .describe('Field values as an object { field_name: value } for the new record.'),
  context: z.record(z.string(), z.unknown()).optional().describe('Optional Odoo context.'),
};

const CREATE_ARGS_SCHEMA = z.object(CREATE_INPUT_SHAPE);

const WRITE_INPUT_SHAPE = {
  model: z.string().trim().min(1).describe('Odoo model name.'),
  ids: z
    .array(z.number().int().positive())
    .min(1)
    .max(MAX_IDS)
    .describe(`Record IDs to update. Max ${MAX_IDS}.`),
  values: z
    .record(z.string(), z.unknown())
    .describe('Field values to update as { field_name: value }.'),
  context: z.record(z.string(), z.unknown()).optional().describe('Optional Odoo context.'),
};

const WRITE_ARGS_SCHEMA = z.object(WRITE_INPUT_SHAPE);

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  return raw.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function renderSearchMarkdown(response: SearchResponse): string {
  const columns = (
    response.fields.length > 0 ? response.fields : Object.keys(response.records[0] ?? {})
  ).slice(0, 5);

  const lines: string[] = [
    `Showing ${response.records.length} records (offset ${response.pagination.offset}, has_more: ${response.pagination.hasMore})`,
    '',
  ];

  if (columns.length === 0) {
    lines.push('_No records found._');
    return lines.join('\n');
  }

  lines.push(`| ${columns.join(' | ')} |`);
  lines.push(`| ${columns.map(() => '---').join(' | ')} |`);

  for (const record of response.records) {
    lines.push(`| ${columns.map((column) => stringifyCell(record[column])).join(' | ')} |`);
  }

  if (response.records.length === 0) {
    lines.push(`| ${columns.map(() => '').join(' | ')} |`);
  }

  return lines.join('\n');
}

function formatToolResponse<TPayload extends object>(
  payload: TPayload,
  responseFormat: ResponseFormat,
  markdownText: string
): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: responseFormat === 'markdown' ? markdownText : JSON.stringify(payload),
      },
    ],
    structuredContent: payload as Record<string, unknown>,
  };
}

async function handleOdooSearch(ctx: CrudToolContext, args: unknown): Promise<CallToolResult> {
  try {
    const parsed = SEARCH_ARGS_SCHEMA.parse(args);

    const model = parsed.model;
    const domain = parsed.domain;
    const fields = parsed.fields;
    const limit = enforceLimit(parsed.limit, SEARCH_DEFAULT_LIMIT);
    const offset = enforceOffset(parsed.offset);
    const context = parsed.context;

    if (!allows(ctx.getPolicy(), model, 'read')) {
      return mcpError('POLICY_DENIED', `read on '${model}' not allowed by policy.`);
    }

    const records = await ctx.client.searchRead(model, domain, {
      fields,
      limit,
      offset,
      context,
    });

    const hasMore = records.length === limit;
    // Derive a lower-bound total: exact when no more pages, +1 when there are more.
    const total = offset + records.length + (hasMore ? 1 : 0);
    const response: SearchResponse = {
      records,
      pagination: buildPagination(total, offset, limit, records.length),
      model,
      fields,
    };

    const sizeCheck = isPayloadOversize(response);
    if (sizeCheck.oversize) {
      const kb = (sizeCheck.bytes / 1024).toFixed(1);
      return mcpError('OVERSIZE', `Response would be ${kb} KB. Use fewer fields.`);
    }

    return formatToolResponse(response, parsed.response_format, renderSearchMarkdown(response));
  } catch (error) {
    if (error instanceof ZodError) {
      return toValidationError(error);
    }
    return formatMcpError(error);
  }
}

async function handleOdooGet(ctx: CrudToolContext, args: unknown): Promise<CallToolResult> {
  try {
    const parsed = GET_ARGS_SCHEMA.parse(args);

    if (!allows(ctx.getPolicy(), parsed.model, 'read')) {
      return mcpError('POLICY_DENIED', `read on '${parsed.model}' not allowed by policy.`);
    }

    const records = await ctx.client.read(parsed.model, parsed.ids, parsed.fields, parsed.context);
    const response = { records };

    const sizeCheck = isPayloadOversize(response);
    if (sizeCheck.oversize) {
      const kb = (sizeCheck.bytes / 1024).toFixed(1);
      return mcpError('OVERSIZE', `Response would be ${kb} KB. Use fewer fields or IDs.`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(response) }],
      structuredContent: response,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return toValidationError(error);
    }
    return formatMcpError(error);
  }
}

async function handleOdooCreate(ctx: CrudToolContext, args: unknown): Promise<CallToolResult> {
  try {
    const parsed = CREATE_ARGS_SCHEMA.parse(args);

    if (Object.keys(parsed.values).length === 0) {
      return mcpError('VALIDATION_ERROR', "'values' must be a non-empty object.");
    }

    if (!allows(ctx.getPolicy(), parsed.model, 'write')) {
      return mcpError('POLICY_DENIED', `write on '${parsed.model}' not allowed by policy.`);
    }

    const newId = await ctx.client.create(parsed.model, parsed.values, parsed.context ?? {});

    void ctx.audit.log({
      tool: 'odoo_create',
      model: parsed.model,
      fields: Object.keys(parsed.values),
      odoo_user: ctx.userLogin,
      transport: 'http',
    });

    const response = { id: newId };
    return {
      content: [{ type: 'text', text: JSON.stringify(response) }],
      structuredContent: response,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return toValidationError(error);
    }
    return formatMcpError(error);
  }
}

async function handleOdooWrite(ctx: CrudToolContext, args: unknown): Promise<CallToolResult> {
  try {
    const parsed = WRITE_ARGS_SCHEMA.parse(args);

    if (Object.keys(parsed.values).length === 0) {
      return mcpError('VALIDATION_ERROR', "'values' must be a non-empty object.");
    }

    if (!allows(ctx.getPolicy(), parsed.model, 'write')) {
      return mcpError('POLICY_DENIED', `write on '${parsed.model}' not allowed by policy.`);
    }

    await ctx.client.write(parsed.model, parsed.ids, parsed.values, parsed.context ?? {});

    void ctx.audit.log({
      tool: 'odoo_write',
      model: parsed.model,
      ids: parsed.ids,
      fields: Object.keys(parsed.values),
      odoo_user: ctx.userLogin,
      transport: 'http',
    });

    const response = { success: true, updated: parsed.ids.length };
    return {
      content: [{ type: 'text', text: JSON.stringify(response) }],
      structuredContent: response,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return toValidationError(error);
    }
    return formatMcpError(error);
  }
}

function buildCrudTools(ctx: CrudToolContext): InternalToolDefinition[] {
  return [
    {
      name: 'odoo_search',
      description: 'Search and read Odoo records with pagination-safe defaults.',
      inputSchema: SEARCH_INPUT_SHAPE,
      inputShape: SEARCH_INPUT_SHAPE,
      annotations: SEARCH_TOOL_ANNOTATIONS,
      handler: (args: unknown) => handleOdooSearch(ctx, args),
    },
    {
      name: 'odoo_get',
      description: `Fetch specific Odoo records by ID. Max ${MAX_IDS} IDs per call.`,
      inputSchema: GET_INPUT_SHAPE,
      inputShape: GET_INPUT_SHAPE,
      annotations: GET_TOOL_ANNOTATIONS,
      handler: (args: unknown) => handleOdooGet(ctx, args),
    },
    {
      name: 'odoo_create',
      description: 'Create a new Odoo record. Returns the new record ID.',
      inputSchema: CREATE_INPUT_SHAPE,
      inputShape: CREATE_INPUT_SHAPE,
      annotations: CREATE_TOOL_ANNOTATIONS,
      handler: (args: unknown) => handleOdooCreate(ctx, args),
    },
    {
      name: 'odoo_write',
      description: `Update Odoo records. Max ${MAX_IDS} IDs per call.`,
      inputSchema: WRITE_INPUT_SHAPE,
      inputShape: WRITE_INPUT_SHAPE,
      annotations: WRITE_TOOL_ANNOTATIONS,
      handler: (args: unknown) => handleOdooWrite(ctx, args),
    },
  ];
}

export function registerCrudTools(server: McpServer, ctx: CrudToolContext): void {
  for (const tool of buildCrudTools(ctx)) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputShape,
        annotations: tool.annotations,
      },
      async (args: unknown) => tool.handler(args)
    );
  }
}

export function createCrudTools(ctx: CrudToolContext): ToolDefinition[] {
  return buildCrudTools(ctx).map(({ inputShape: _inputShape, ...tool }) => tool);
}
