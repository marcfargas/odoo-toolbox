import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { discoverSkillResources, readSkillContent } from './skill-resources.js';

/**
 * Register MCP resource handlers for skill documentation.
 */
export function registerResources(server: Server): void {
  // Handler for listing all available skill resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const skills = discoverSkillResources();

    return {
      resources: skills.map((skill) => ({
        uri: skill.uri,
        name: skill.name,
        description: skill.description,
        mimeType: 'text/markdown',
      })),
    };
  });

  // Handler for reading a specific skill resource
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    const content = readSkillContent(uri);

    if (!content) {
      throw new Error(`Resource not found: ${uri}`);
    }

    return {
      contents: [
        {
          uri,
          mimeType: 'text/markdown',
          text: content,
        },
      ],
    };
  });
}

export { discoverSkillResources, readSkillContent } from './skill-resources.js';
