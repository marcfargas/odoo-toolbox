/**
 * Discovery tools: odoo_discover + odoo_model_info
 *
 * odoo_discover: semantic fuzzy-search over all Odoo models using a
 * scored index built from ir.model + ir.module.module.
 *
 * odoo_model_info: full field schema for a specific model (same fields_get
 * source as odoo://schema/{model} — shares the cache).
 */

import type { OdooClient } from '@marcfargas/odoo-client';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { z, ZodError } from 'zod';
import { formatMcpError, mcpError, toValidationError } from '../errors';
import { allows, type PolicyRule } from '../policy';
import { type McpCache, type IrModelInfo, type IrModuleInfo } from '../cache';
import { buildFieldSchema } from '../resources/schema';
import type { ToolDefinition } from './crud';

// ── Scoring constants (tunable without API changes) ───────────────────────

const SCORE_EXACT_MODEL = 100;
const SCORE_MODEL_CONTAINS = 60;
const SCORE_DESC_CONTAINS = 40;
const SCORE_MODULE_CONTAINS = 20;
const SCORE_THRESHOLD = 20;
const DEFAULT_DISCOVER_LIMIT = 10;
const MAX_DISCOVER_LIMIT = 20;

interface InternalToolDefinition extends ToolDefinition {
  inputShape: z.ZodRawShape;
}

const DISCOVER_TOOL_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

const MODEL_INFO_TOOL_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

// ── Types ─────────────────────────────────────────────────────────────────

export interface DiscoveryToolContext {
  client: OdooClient;
  getPolicy: () => PolicyRule[];
  cache: McpCache;
}

interface DiscoverResult {
  model: string;
  description: string;
  modules: string[];
  score: number;
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

// ── Fetchers (called by cache layer) ─────────────────────────────────────

async function fetchIrModels(client: OdooClient): Promise<IrModelInfo[]> {
  return client.searchRead<IrModelInfo>('ir.model', [['transient', '=', false]], {
    fields: ['name', 'model', 'modules'],
    limit: 0, // no limit — we want all models
  });
}

async function fetchIrModules(client: OdooClient): Promise<IrModuleInfo[]> {
  return client.searchRead<IrModuleInfo>('ir.module.module', [['state', '=', 'installed']], {
    fields: ['name', 'shortdesc', 'summary', 'category_id'],
    limit: 0,
  });
}

// ── Scoring ───────────────────────────────────────────────────────────────

function scoreModel(
  irModel: IrModelInfo,
  moduleSummaries: Map<string, string>,
  query: string
): number {
  const q = query.toLowerCase();
  const modelName = irModel.model.toLowerCase();
  const desc = (irModel.name ?? '').toLowerCase();

  if (modelName === q) return SCORE_EXACT_MODEL;

  let score = 0;
  if (modelName.includes(q)) score += SCORE_MODEL_CONTAINS;
  if (desc && desc.includes(q)) score += SCORE_DESC_CONTAINS;

  // Check associated modules
  const modelModules = irModel.modules
    ? irModel.modules
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean)
    : [];

  for (const mod of modelModules) {
    const blurb = moduleSummaries.get(mod) ?? '';
    if (blurb.includes(q)) {
      score += SCORE_MODULE_CONTAINS;
      break; // count module match once per model
    }
  }

  return score;
}

const DISCOVER_INPUT_SHAPE = {
  query: z
    .string()
    .trim()
    .min(1)
    .describe('Business concept to search for, e.g. "invoices", "sales orders", "employees".'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_DISCOVER_LIMIT)
    .default(DEFAULT_DISCOVER_LIMIT)
    .describe(
      `Max results to return. Default ${DEFAULT_DISCOVER_LIMIT}, max ${MAX_DISCOVER_LIMIT}.`
    ),
  response_format: z
    .enum(['json', 'markdown'])
    .default('json')
    .describe("Output format: 'json' for structured output, 'markdown' for a readable list."),
};

const DISCOVER_ARGS_SCHEMA = z.object(DISCOVER_INPUT_SHAPE);

const MODEL_INFO_INPUT_SHAPE = {
  model: z.string().trim().min(1).describe('Odoo model technical name, e.g. res.partner.'),
};

const MODEL_INFO_ARGS_SCHEMA = z.object(MODEL_INFO_INPUT_SHAPE);

function renderDiscoverMarkdown(query: string, results: DiscoverResult[]): string {
  const lines: string[] = [`Query: ${query}`, ''];

  if (results.length === 0) {
    lines.push('No matching models found.');
    return lines.join('\n');
  }

  for (const result of results) {
    const moduleLabel = result.modules.length > 0 ? result.modules.join(', ') : 'n/a';
    lines.push(
      `- **${result.model}** (Module: ${moduleLabel}): ${result.description || 'No description'}`
    );
  }

  return lines.join('\n');
}

async function handleOdooDiscover(
  ctx: DiscoveryToolContext,
  args: unknown
): Promise<CallToolResult> {
  try {
    const parsed = DISCOVER_ARGS_SCHEMA.parse(args);

    const [irModels, irModules] = await Promise.all([
      ctx.cache.getIrModels(() => fetchIrModels(ctx.client)),
      ctx.cache.getIrModules(() => fetchIrModules(ctx.client)),
    ]);

    // Build module blurb map: technical_name → searchable text
    const moduleSummaries = new Map<string, string>();
    for (const m of irModules) {
      const blurb = [m.shortdesc, m.summary].filter(Boolean).join(' ').toLowerCase();
      moduleSummaries.set(m.name, blurb);
    }

    const results: DiscoverResult[] = [];
    for (const irModel of irModels) {
      const score = scoreModel(irModel, moduleSummaries, parsed.query);
      if (score < SCORE_THRESHOLD) continue;

      results.push({
        model: irModel.model,
        description: irModel.name ?? '',
        modules: irModel.modules
          ? irModel.modules
              .split(',')
              .map((m) => m.trim())
              .filter(Boolean)
          : [],
        score,
      });
    }

    results.sort((a, b) => b.score - a.score);
    const top = results.slice(0, parsed.limit);

    const response = { query: parsed.query, results: top };
    return {
      content: [
        {
          type: 'text',
          text:
            parsed.response_format === 'markdown'
              ? renderDiscoverMarkdown(parsed.query, top)
              : JSON.stringify(response),
        },
      ],
      structuredContent: response,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return toValidationError(error);
    }
    return formatMcpError(error);
  }
}

async function handleOdooModelInfo(
  ctx: DiscoveryToolContext,
  args: unknown
): Promise<CallToolResult> {
  try {
    const parsed = MODEL_INFO_ARGS_SCHEMA.parse(args);

    if (!allows(ctx.getPolicy(), parsed.model, 'read')) {
      return mcpError('POLICY_DENIED', `read on '${parsed.model}' not allowed by policy.`);
    }

    const fields = await ctx.cache.getSchema(parsed.model, async () => {
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

    const response = { model: parsed.model, fields };
    return {
      content: [{ type: 'text', text: JSON.stringify(response) }],
      structuredContent: response,
    };
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

function buildDiscoveryTools(ctx: DiscoveryToolContext): InternalToolDefinition[] {
  return [
    {
      name: 'odoo_discover',
      description:
        'Fuzzy-search Odoo models by business concept. Use this before odoo_search to find the right model name.',
      inputSchema: DISCOVER_INPUT_SHAPE,
      inputShape: DISCOVER_INPUT_SHAPE,
      annotations: DISCOVER_TOOL_ANNOTATIONS,
      handler: (args: unknown) => handleOdooDiscover(ctx, args),
    },
    {
      name: 'odoo_model_info',
      description:
        'Return full field schema for an Odoo model (types, labels, required/readonly flags, relational targets, selection options). Shares cache with odoo://schema/{model}.',
      inputSchema: MODEL_INFO_INPUT_SHAPE,
      inputShape: MODEL_INFO_INPUT_SHAPE,
      annotations: MODEL_INFO_TOOL_ANNOTATIONS,
      handler: (args: unknown) => handleOdooModelInfo(ctx, args),
    },
  ];
}

export function registerDiscoveryTools(server: McpServer, ctx: DiscoveryToolContext): void {
  for (const tool of buildDiscoveryTools(ctx)) {
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

export function createDiscoveryTools(ctx: DiscoveryToolContext): ToolDefinition[] {
  return buildDiscoveryTools(ctx).map(({ inputShape: _inputShape, ...tool }) => tool);
}
