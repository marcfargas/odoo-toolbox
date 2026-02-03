import { SessionManager } from '../session/index.js';
import { formatError, McpErrorResponse } from '../utils/index.js';
import { CodeGenerator } from '@odoo-toolbox/introspection';
import {
  GetModelsInputSchema,
  GetModelsOutput,
  GetFieldsInputSchema,
  GetFieldsOutput,
  GetModelMetadataInputSchema,
  GetModelMetadataOutput,
  GenerateTypesInputSchema,
  GenerateTypesOutput,
} from '../schemas/index.js';

export async function handleGetModels(
  session: SessionManager,
  input: unknown
): Promise<GetModelsOutput | McpErrorResponse> {
  try {
    const params = GetModelsInputSchema.parse(input);
    const introspector = session.getIntrospector();

    const models = await introspector.getModels({
      includeTransient: params.includeTransient,
      modules: params.modules,
      bypassCache: params.bypassCache,
    });

    return {
      success: true,
      models,
      count: models.length,
      message: `Found ${models.length} model(s)`,
    };
  } catch (error) {
    return formatError(error);
  }
}

export async function handleGetFields(
  session: SessionManager,
  input: unknown
): Promise<GetFieldsOutput | McpErrorResponse> {
  try {
    const params = GetFieldsInputSchema.parse(input);
    const introspector = session.getIntrospector();

    const fields = await introspector.getFields(params.model, {
      bypassCache: params.bypassCache,
    });

    return {
      success: true,
      fields,
      count: fields.length,
      message: `Found ${fields.length} field(s) in ${params.model}`,
    };
  } catch (error) {
    return formatError(error);
  }
}

export async function handleGetModelMetadata(
  session: SessionManager,
  input: unknown
): Promise<GetModelMetadataOutput | McpErrorResponse> {
  try {
    const params = GetModelMetadataInputSchema.parse(input);
    const introspector = session.getIntrospector();

    const metadata = await introspector.getModelMetadata(params.model, {
      bypassCache: params.bypassCache,
    });

    return {
      success: true,
      metadata,
      message: `Retrieved metadata for ${params.model} (${metadata.fields.length} fields)`,
    };
  } catch (error) {
    return formatError(error);
  }
}

export async function handleGenerateTypes(
  session: SessionManager,
  input: unknown
): Promise<GenerateTypesOutput | McpErrorResponse> {
  try {
    const params = GenerateTypesInputSchema.parse(input);
    const client = session.getClient();
    const introspector = session.getIntrospector();

    // If specific models requested, generate only for those
    if (params.models && params.models.length > 0) {
      const { generateCompleteFile, generateHelperTypes } =
        await import('@odoo-toolbox/introspection');

      const allMetadata = [];
      for (const modelName of params.models) {
        const metadata = await introspector.getModelMetadata(modelName);
        allMetadata.push(metadata);
      }

      const generatedCode = generateCompleteFile(allMetadata);
      const helperTypes = generateHelperTypes();
      const typescript = `${helperTypes}\n\n${generatedCode}`;

      return {
        success: true,
        typescript,
        modelCount: params.models.length,
        message: `Generated TypeScript interfaces for ${params.models.length} model(s)`,
      };
    }

    // Otherwise use the full code generator
    const codeGenerator = new CodeGenerator(client);
    const typescript = await codeGenerator.generate({
      includeTransient: params.includeTransient,
      outputDir: undefined, // Don't write to file, just return the code
    });

    // Count models in generated code by counting interface declarations
    const modelCount = (typescript.match(/export interface/g) || []).length;

    return {
      success: true,
      typescript,
      modelCount,
      message: `Generated TypeScript interfaces for ${modelCount} model(s)`,
    };
  } catch (error) {
    return formatError(error);
  }
}

export const introspectionToolDefinitions = [
  {
    name: 'odoo_get_models',
    description: 'List available Odoo models (database tables)',
    inputSchema: {
      type: 'object',
      properties: {
        includeTransient: {
          type: 'boolean',
          description: 'Include wizard/transient models',
          default: false,
        },
        modules: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by module names',
        },
        bypassCache: {
          type: 'boolean',
          description: 'Force fresh query (bypass cache)',
          default: false,
        },
      },
      required: [],
    },
  },
  {
    name: 'odoo_get_fields',
    description: 'Get field definitions for an Odoo model',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Model name',
        },
        bypassCache: {
          type: 'boolean',
          description: 'Force fresh query (bypass cache)',
          default: false,
        },
      },
      required: ['model'],
    },
  },
  {
    name: 'odoo_get_model_metadata',
    description: 'Get complete model metadata (model info + all fields)',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Model name',
        },
        bypassCache: {
          type: 'boolean',
          description: 'Force fresh query (bypass cache)',
          default: false,
        },
      },
      required: ['model'],
    },
  },
  {
    name: 'odoo_generate_types',
    description: 'Generate TypeScript interfaces for Odoo models',
    inputSchema: {
      type: 'object',
      properties: {
        models: {
          type: 'array',
          items: { type: 'string' },
          description: 'Models to generate (empty = all)',
        },
        includeTransient: {
          type: 'boolean',
          description: 'Include wizard/transient models',
          default: false,
        },
      },
      required: [],
    },
  },
];
