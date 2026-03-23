import type { OdooClient } from '@marcfargas/odoo-client';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { McpCache } from '../cache';
import { allows, type PolicyRule } from '../policy';

export interface McpFieldSchema {
  name: string;
  type: string;
  string: string;
  required: boolean;
  readonly: boolean;
  help: string;
  selection?: [string, string][];
  relation?: string;
}

export interface RawFieldMeta {
  type?: string;
  string?: string;
  required?: boolean;
  readonly?: boolean;
  help?: string;
  selection?: [string, string][];
  relation?: string;
}

/** Normalize a fields_get response into a sorted McpFieldSchema[]. */
export function buildFieldSchema(raw: Record<string, RawFieldMeta>): McpFieldSchema[] {
  return Object.entries(raw)
    .map(([name, value]) => ({
      name,
      type: value.type ?? 'unknown',
      string: value.string ?? name,
      required: value.required ?? false,
      readonly: value.readonly ?? false,
      help: value.help ?? '',
      selection: Array.isArray(value.selection) ? value.selection : undefined,
      relation: value.relation,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface SchemaResourceContext {
  client: OdooClient;
  cache: McpCache;
  getPolicy: () => PolicyRule[];
}

export const SCHEMA_RESOURCE_TEMPLATE = {
  name: 'odoo_schema',
  uriTemplate: 'odoo://schema/{model}',
  description: 'Field metadata for an Odoo model using fields_get.',
};

export function parseSchemaUri(uri: string): string | null {
  const prefix = 'odoo://schema/';
  if (!uri.startsWith(prefix)) {
    return null;
  }

  const encodedModel = uri.slice(prefix.length);
  if (!encodedModel) {
    return null;
  }

  return decodeURIComponent(encodedModel);
}

export async function readSchemaResource(
  uri: string,
  context: SchemaResourceContext
): Promise<ReadResourceResult> {
  const model = parseSchemaUri(uri);

  if (!model) {
    throw new Error(`Resource not found: ${uri}`);
  }

  if (!allows(context.getPolicy(), model, 'read')) {
    throw new Error(`POLICY_DENIED: read on '${model}' not allowed by policy.`);
  }

  const fields = await context.cache.getSchema(model, async () => {
    const raw = await context.client.call<Record<string, RawFieldMeta>>(model, 'fields_get', [], {
      attributes: ['string', 'type', 'required', 'readonly', 'help', 'selection', 'relation'],
    });
    return buildFieldSchema(raw);
  });

  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({ model, fields }, null, 2),
      },
    ],
  };
}
