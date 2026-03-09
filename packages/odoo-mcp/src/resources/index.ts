import type { OdooClient } from '@marcfargas/odoo-client';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpCache } from '../cache';
import { type PolicyRule } from '../policy';
import { readSchemaResource, SCHEMA_RESOURCE_TEMPLATE } from './schema';
import { readModelsResource, MODELS_RESOURCE } from './models';
import { readModulesResource, MODULES_RESOURCE } from './modules';

interface ResourceContext {
  client: OdooClient;
  cache: McpCache;
  getPolicy: () => PolicyRule[];
}

export function registerResources(server: McpServer, context: ResourceContext): void {
  server.registerResource(
    MODELS_RESOURCE.name,
    MODELS_RESOURCE.uri,
    {
      description: MODELS_RESOURCE.description,
      mimeType: MODELS_RESOURCE.mimeType,
    },
    async () => readModelsResource(context)
  );

  server.registerResource(
    MODULES_RESOURCE.name,
    MODULES_RESOURCE.uri,
    {
      description: MODULES_RESOURCE.description,
      mimeType: MODULES_RESOURCE.mimeType,
    },
    async () => readModulesResource(context)
  );

  server.registerResource(
    SCHEMA_RESOURCE_TEMPLATE.name,
    new ResourceTemplate(SCHEMA_RESOURCE_TEMPLATE.uriTemplate, { list: undefined }),
    {
      description: SCHEMA_RESOURCE_TEMPLATE.description,
      mimeType: 'application/json',
    },
    async (uri) => readSchemaResource(uri.toString(), context)
  );
}
