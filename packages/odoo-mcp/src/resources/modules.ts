/**
 * odoo://modules resource — installed Odoo modules.
 *
 * Lets the AI see which business apps are installed (Sales, CRM, Accounting…).
 * Cached 10 min.
 */

import type { OdooClient } from '@marcfargas/odoo-client';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import type { McpCache } from '../cache';
import type { PolicyRule } from '../policy';

export const MODULES_RESOURCE = {
  uri: 'odoo://modules',
  name: 'odoo_modules',
  description: 'Installed Odoo modules (business apps) on this instance.',
  mimeType: 'application/json',
};

export interface ModulesResourceContext {
  client: OdooClient;
  cache: McpCache;
  getPolicy: () => PolicyRule[];
}

export async function readModulesResource(
  ctx: ModulesResourceContext
): Promise<ReadResourceResult> {
  const modules = await ctx.cache.getIrModules(() =>
    ctx.client.searchRead('ir.module.module', [['state', '=', 'installed']], {
      fields: ['name', 'shortdesc', 'summary', 'category_id'],
      limit: 0,
    })
  );

  const result = modules
    .map((m) => ({
      name: m.name,
      label: m.shortdesc,
      summary: m.summary || null,
      category: Array.isArray(m.category_id) ? m.category_id[1] : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    contents: [
      {
        uri: MODULES_RESOURCE.uri,
        mimeType: 'application/json',
        text: JSON.stringify({ modules: result }, null, 2),
      },
    ],
  };
}
