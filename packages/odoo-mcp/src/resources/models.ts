/**
 * odoo://models resource — all non-transient models with name, description, modules.
 *
 * Orientation resource: lets the AI see what models are available without
 * knowing their technical names upfront. Cached 10 min.
 */

import type { OdooClient } from '@marcfargas/odoo-client';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import type { McpCache } from '../cache';
import type { PolicyRule } from '../policy';

export const MODELS_RESOURCE = {
  uri: 'odoo://models',
  name: 'odoo_models',
  description: 'All non-transient Odoo models available on this instance.',
  mimeType: 'application/json',
};

export interface ModelsResourceContext {
  client: OdooClient;
  cache: McpCache;
  getPolicy: () => PolicyRule[];
}

export async function readModelsResource(ctx: ModelsResourceContext): Promise<ReadResourceResult> {
  const models = await ctx.cache.getIrModels(() =>
    ctx.client.searchRead('ir.model', [['transient', '=', false]], {
      fields: ['name', 'model', 'modules'],
      limit: 0,
    })
  );

  const result = models.map((m) => ({
    model: m.model,
    description: m.name,
    modules: m.modules
      ? m.modules
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
  }));

  return {
    contents: [
      {
        uri: MODELS_RESOURCE.uri,
        mimeType: 'application/json',
        text: JSON.stringify({ models: result }, null, 2),
      },
    ],
  };
}
