/**
 * Navigation tool: odoo_get_related
 *
 * Follows a relational field on a source record and fetches the related
 * record(s) from the target model.
 *
 * - many2one   → value is [id, display_name] or false → read one record
 * - one2many / many2many → value is list of IDs → searchRead with limit
 *
 * Policy is checked on both the source model and the target model.
 */

import type { OdooClient } from '@marcfargas/odoo-client';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { z, ZodError } from 'zod';
import { formatMcpError, mcpError, toValidationError } from '../errors';
import { buildPagination, enforceLimit, enforceOffset, isPayloadOversize } from '../limits';
import { allows, type PolicyRule } from '../policy';
import type { McpCache } from '../cache';
import { buildFieldSchema } from '../resources/schema';
import type { ToolDefinition } from './crud';

const MAX_RELATED_LIMIT = 200;
const DEFAULT_RELATED_LIMIT = 100;

interface InternalToolDefinition extends ToolDefinition {
  inputShape: z.ZodRawShape;
}

const GET_RELATED_TOOL_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

export interface NavigationToolContext {
  client: OdooClient;
  getPolicy: () => PolicyRule[];
  cache: McpCache;
}

interface RawFieldMeta {
  type?: string;
  string?: string;
  required?: boolean;
  readonly?: boolean;
  help?: string;
  selection?: [string, string][];
  relation?: string;
}

const GET_RELATED_INPUT_SHAPE = {
  model: z.string().trim().min(1).describe('Source model, e.g. sale.order.'),
  id: z.number().int().positive().describe('Source record ID.'),
  field: z.string().trim().min(1).describe('Relational field name, e.g. order_line.'),
  fields: z
    .array(z.string())
    .default([])
    .describe('Fields to fetch from related records. Defaults to [].'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_RELATED_LIMIT)
    .default(DEFAULT_RELATED_LIMIT)
    .describe(
      `Max related records (one2many / many2many). Default ${DEFAULT_RELATED_LIMIT}, max ${MAX_RELATED_LIMIT}.`
    ),
  offset: z.number().int().min(0).default(0).describe('Offset for x2many pagination. Default 0.'),
  context: z.record(z.string(), z.unknown()).optional().describe('Optional Odoo context object.'),
};

const GET_RELATED_ARGS_SCHEMA = z.object(GET_RELATED_INPUT_SHAPE);

async function handleGetRelated(
  ctx: NavigationToolContext,
  args: unknown
): Promise<CallToolResult> {
  try {
    const parsed = GET_RELATED_ARGS_SCHEMA.parse(args);

    const limit = enforceLimit(parsed.limit, DEFAULT_RELATED_LIMIT, MAX_RELATED_LIMIT);
    const offset = enforceOffset(parsed.offset);

    // Policy check on source model
    if (!allows(ctx.getPolicy(), parsed.model, 'read')) {
      return mcpError('POLICY_DENIED', `read on '${parsed.model}' not allowed by policy.`);
    }

    // Get field metadata to determine type and target model
    const schema = await ctx.cache.getSchema(parsed.model, async () => {
      const raw = await ctx.client.call<Record<string, RawFieldMeta>>(
        parsed.model,
        'fields_get',
        [],
        {
          attributes: ['string', 'type', 'required', 'readonly', 'help', 'selection', 'relation'],
        }
      );
      return buildFieldSchema(raw);
    });

    const fieldMeta = schema.find((f) => f.name === parsed.field);
    if (!fieldMeta) {
      return mcpError(
        'VALIDATION_ERROR',
        `Field '${parsed.field}' not found on model '${parsed.model}'.`
      );
    }

    const relationType = fieldMeta.type;
    const targetModel = fieldMeta.relation;

    if (!targetModel) {
      return mcpError(
        'VALIDATION_ERROR',
        `Field '${parsed.field}' on '${parsed.model}' is not a relational field (type: ${relationType}).`
      );
    }

    // Policy check on target model
    if (!allows(ctx.getPolicy(), targetModel, 'read')) {
      return mcpError('POLICY_DENIED', `read on '${targetModel}' not allowed by policy.`);
    }

    // Read the source record's field value
    const sourceRecords = await ctx.client.read(
      parsed.model,
      [parsed.id],
      [parsed.field],
      parsed.context
    );
    if (!sourceRecords.length) {
      return mcpError(
        'VALIDATION_ERROR',
        `Record ${parsed.id} not found on model '${parsed.model}' or access denied.`
      );
    }

    const rawValue = sourceRecords[0]?.[parsed.field];

    // ── many2one ─────────────────────────────────────────────────────
    if (relationType === 'many2one') {
      if (!rawValue) {
        const response = { type: 'many2one', record: null };
        return {
          content: [{ type: 'text', text: JSON.stringify(response) }],
          structuredContent: response,
        };
      }

      // Odoo returns [id, display_name] tuple for many2one
      const targetId = Array.isArray(rawValue) ? (rawValue[0] as number) : (rawValue as number);
      const records = await ctx.client.read(targetModel, [targetId], parsed.fields, parsed.context);

      const response = {
        type: 'many2one',
        model: targetModel,
        record: records[0] ?? null,
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(response) }],
        structuredContent: response,
      };
    }

    // ── one2many / many2many ──────────────────────────────────────────
    if (relationType === 'one2many' || relationType === 'many2many') {
      const relatedIds = Array.isArray(rawValue) ? (rawValue as number[]) : [];

      if (relatedIds.length === 0) {
        const response = {
          type: relationType,
          model: targetModel,
          records: [],
          pagination: buildPagination(0, 0, limit, 0),
        };
        return {
          content: [{ type: 'text', text: JSON.stringify(response) }],
          structuredContent: response,
        };
      }

      // Paginate over the known IDs
      const pageIds = relatedIds.slice(offset, offset + limit);
      const records = await ctx.client.read(targetModel, pageIds, parsed.fields, parsed.context);

      const response = {
        type: relationType,
        model: targetModel,
        records,
        pagination: buildPagination(relatedIds.length, offset, limit, records.length),
      };

      const sizeCheck = isPayloadOversize(response);
      if (sizeCheck.oversize) {
        const kb = (sizeCheck.bytes / 1024).toFixed(1);
        return mcpError('OVERSIZE', `Response would be ${kb} KB. Use fewer fields.`);
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(response) }],
        structuredContent: response,
      };
    }

    return mcpError(
      'VALIDATION_ERROR',
      `Field '${parsed.field}' has type '${relationType}' which is not a relational type.`
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return toValidationError(error);
    }
    if (error instanceof Error && /must be|required/.test(error.message)) {
      return mcpError('VALIDATION_ERROR', error.message);
    }
    return formatMcpError(error);
  }
}

function buildNavigationTools(ctx: NavigationToolContext): InternalToolDefinition[] {
  return [
    {
      name: 'odoo_get_related',
      description:
        'Follow a relational field from a source record to its related record(s). Handles many2one (returns one record), one2many and many2many (returns array with pagination). Policy is checked on both source and target models.',
      inputSchema: GET_RELATED_INPUT_SHAPE,
      inputShape: GET_RELATED_INPUT_SHAPE,
      annotations: GET_RELATED_TOOL_ANNOTATIONS,
      handler: (args: unknown) => handleGetRelated(ctx, args),
    },
  ];
}

export function registerNavigationTools(server: McpServer, ctx: NavigationToolContext): void {
  for (const tool of buildNavigationTools(ctx)) {
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

export function createNavigationTools(ctx: NavigationToolContext): ToolDefinition[] {
  return buildNavigationTools(ctx).map(({ inputShape: _inputShape, ...tool }) => tool);
}
