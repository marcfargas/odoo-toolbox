/**
 * Properties MCP tools.
 *
 * Provides tools for:
 * - Reading properties in both formats
 * - Safely updating properties (read-modify-write pattern)
 * - Discovering properties fields on models
 * - Managing property definitions
 */

import { SessionManager } from '../session/index.js';
import { formatError, McpErrorResponse } from '../utils/index.js';
import {
  ReadPropertiesInputSchema,
  ReadPropertiesOutput,
  PropertyRawValue,
  UpdatePropertiesInputSchema,
  UpdatePropertiesOutput,
  FindPropertiesFieldInputSchema,
  FindPropertiesFieldOutput,
  GetPropertyDefinitionsInputSchema,
  GetPropertyDefinitionsOutput,
  SetPropertyDefinitionsInputSchema,
  SetPropertyDefinitionsOutput,
} from '../schemas/index.js';
import { OdooClient } from '@odoo-toolbox/client';

// ============================================================================
// Known Property Mappings
// ============================================================================

interface PropertyMapping {
  field: string;
  definitionModel: string;
  definitionField: string;
  parentField: string;
}

const PROPERTY_MAPPINGS: Record<string, PropertyMapping> = {
  'crm.lead': {
    field: 'lead_properties',
    definitionModel: 'crm.team',
    definitionField: 'lead_properties_definition',
    parentField: 'team_id',
  },
  'project.task': {
    field: 'task_properties',
    definitionModel: 'project.project',
    definitionField: 'task_properties_definition',
    parentField: 'project_id',
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Find the properties field on a model by querying ir.model.fields.
 */
async function findPropertiesFieldOnModel(
  client: OdooClient,
  model: string
): Promise<string | null> {
  // First check known mappings
  if (PROPERTY_MAPPINGS[model]) {
    return PROPERTY_MAPPINGS[model].field;
  }

  // Query ir.model.fields for properties type
  const fields = await client.searchRead(
    'ir.model.fields',
    [
      ['model', '=', model],
      ['ttype', '=', 'properties'],
    ],
    { fields: ['name'], limit: 1 }
  );

  return fields.length > 0 ? fields[0].name : null;
}

/**
 * Convert Odoo's read format (array of property objects) to simple key-value format.
 */
function propertiesToWriteFormat(properties: PropertyRawValue[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const prop of properties) {
    if (prop.type !== 'separator') {
      result[prop.name] = prop.value;
    }
  }

  return result;
}

/**
 * Get the definition model and field for a given model.
 */
function getDefinitionInfo(
  model: string
): { model: string; field: string; parentField: string } | null {
  const mapping = PROPERTY_MAPPINGS[model];
  if (mapping) {
    return {
      model: mapping.definitionModel,
      field: mapping.definitionField,
      parentField: mapping.parentField,
    };
  }
  return null;
}

// ============================================================================
// Read Properties
// ============================================================================

export async function handleReadProperties(
  session: SessionManager,
  input: unknown
): Promise<ReadPropertiesOutput | McpErrorResponse> {
  try {
    const params = ReadPropertiesInputSchema.parse(input);
    const client = session.getClient();

    // Determine property field
    let propertyField: string | undefined = params.property_field;
    if (!propertyField) {
      const foundField = await findPropertiesFieldOnModel(client, params.model);
      if (!foundField) {
        return {
          success: false,
          message: `No properties field found on model ${params.model}`,
        };
      }
      propertyField = foundField;
    }

    // Read the record
    const records = await client.read(params.model, [params.id], [propertyField]);

    if (records.length === 0) {
      return formatError(new Error(`Record ${params.id} not found in ${params.model}`));
    }

    const rawProperties = (records[0][propertyField] || []) as PropertyRawValue[];
    const simpleProperties = propertiesToWriteFormat(rawProperties);

    const result: ReadPropertiesOutput = {
      success: true,
      property_field: propertyField,
      count: rawProperties.length,
      message: `Read ${rawProperties.length} properties from ${params.model} record ${params.id}`,
    };

    if (params.format === 'raw' || params.format === 'both') {
      result.raw = rawProperties;
    }

    if (params.format === 'simple' || params.format === 'both') {
      result.simple = simpleProperties;
    }

    return result;
  } catch (error) {
    return formatError(error);
  }
}

// ============================================================================
// Update Properties
// ============================================================================

export async function handleUpdateProperties(
  session: SessionManager,
  input: unknown
): Promise<UpdatePropertiesOutput | McpErrorResponse> {
  try {
    const params = UpdatePropertiesInputSchema.parse(input);
    const client = session.getClient();

    // Determine property field
    let propertyField: string | undefined = params.property_field;
    if (!propertyField) {
      const foundField = await findPropertiesFieldOnModel(client, params.model);
      if (!foundField) {
        return {
          success: false,
          message: `No properties field found on model ${params.model}`,
        };
      }
      propertyField = foundField;
    }

    // Read current properties
    const records = await client.read(params.model, [params.id], [propertyField]);

    if (records.length === 0) {
      return formatError(new Error(`Record ${params.id} not found in ${params.model}`));
    }

    const rawProperties = (records[0][propertyField] || []) as PropertyRawValue[];
    const currentSimple = propertiesToWriteFormat(rawProperties);

    // Merge updates
    const merged = { ...currentSimple, ...params.updates };

    // Write back
    await client.write(params.model, [params.id], {
      [propertyField]: merged,
    });

    const updatedKeys = Object.keys(params.updates);

    return {
      success: true,
      updated_properties: updatedKeys,
      property_field: propertyField,
      message: `Updated ${updatedKeys.length} properties on ${params.model} record ${params.id}`,
    };
  } catch (error) {
    return formatError(error);
  }
}

// ============================================================================
// Find Properties Field
// ============================================================================

export async function handleFindPropertiesField(
  session: SessionManager,
  input: unknown
): Promise<FindPropertiesFieldOutput | McpErrorResponse> {
  try {
    const params = FindPropertiesFieldInputSchema.parse(input);
    const client = session.getClient();

    const propertyField = await findPropertiesFieldOnModel(client, params.model);

    if (!propertyField) {
      return {
        success: true,
        has_properties: false,
        message: `Model ${params.model} does not have a properties field`,
      };
    }

    const definitionInfo = getDefinitionInfo(params.model);

    return {
      success: true,
      has_properties: true,
      property_field: propertyField,
      definition_model: definitionInfo?.model,
      definition_field: definitionInfo?.field,
      message: `Model ${params.model} has properties field '${propertyField}'`,
    };
  } catch (error) {
    return formatError(error);
  }
}

// ============================================================================
// Get Property Definitions
// ============================================================================

export async function handleGetPropertyDefinitions(
  session: SessionManager,
  input: unknown
): Promise<GetPropertyDefinitionsOutput | McpErrorResponse> {
  try {
    const params = GetPropertyDefinitionsInputSchema.parse(input);
    const client = session.getClient();

    const definitionInfo = getDefinitionInfo(params.model);

    if (!definitionInfo) {
      return {
        success: false,
        message: `No property definition mapping known for model ${params.model}. Use odoo_find_properties_field to discover the structure.`,
      };
    }

    // If parent_id provided, read from that record
    // Otherwise, need to find the parent from a record
    if (!params.parent_id) {
      return {
        success: false,
        message: `parent_id required. For ${params.model}, this is the ${definitionInfo.parentField} value.`,
      };
    }

    const records = await client.read(
      definitionInfo.model,
      [params.parent_id],
      [definitionInfo.field]
    );

    if (records.length === 0) {
      return formatError(
        new Error(`Record ${params.parent_id} not found in ${definitionInfo.model}`)
      );
    }

    const definitions = (records[0][definitionInfo.field] ||
      []) as GetPropertyDefinitionsOutput['definitions'];

    return {
      success: true,
      definitions,
      definition_model: definitionInfo.model,
      definition_field: definitionInfo.field,
      count: definitions?.length || 0,
      message: `Found ${definitions?.length || 0} property definitions`,
    };
  } catch (error) {
    return formatError(error);
  }
}

// ============================================================================
// Set Property Definitions
// ============================================================================

export async function handleSetPropertyDefinitions(
  session: SessionManager,
  input: unknown
): Promise<SetPropertyDefinitionsOutput | McpErrorResponse> {
  try {
    const params = SetPropertyDefinitionsInputSchema.parse(input);
    const client = session.getClient();

    // Determine definition field
    let definitionField = params.definition_field;
    if (!definitionField) {
      // Try to find from known mappings (reverse lookup)
      for (const [, mapping] of Object.entries(PROPERTY_MAPPINGS)) {
        if (mapping.definitionModel === params.definition_model) {
          definitionField = mapping.definitionField;
          break;
        }
      }
    }

    if (!definitionField) {
      return {
        success: false,
        message: `Could not determine definition field for ${params.definition_model}. Please provide definition_field.`,
      };
    }

    let finalDefinitions = params.definitions;

    if (params.mode === 'merge') {
      // Read existing definitions
      const records = await client.read(
        params.definition_model,
        [params.definition_id],
        [definitionField]
      );

      if (records.length === 0) {
        return formatError(
          new Error(`Record ${params.definition_id} not found in ${params.definition_model}`)
        );
      }

      const existing = (records[0][definitionField] || []) as Array<{
        name: string;
        [key: string]: unknown;
      }>;

      // Merge: update existing by name, add new ones
      const existingByName = new Map(existing.map((d) => [d.name, d]));

      for (const newDef of params.definitions) {
        existingByName.set(newDef.name, newDef);
      }

      finalDefinitions = Array.from(existingByName.values()) as typeof params.definitions;
    }

    // Write definitions
    await client.write(params.definition_model, [params.definition_id], {
      [definitionField]: finalDefinitions,
    });

    return {
      success: true,
      property_count: finalDefinitions.length,
      message: `Set ${finalDefinitions.length} property definitions on ${params.definition_model} record ${params.definition_id}`,
    };
  } catch (error) {
    return formatError(error);
  }
}

// ============================================================================
// Tool Definitions
// ============================================================================

export const propertiesToolDefinitions = [
  {
    name: 'odoo_read_properties',
    description: 'Read properties from a record in both raw (Odoo) and simple (key-value) formats',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Model name (e.g., crm.lead, project.task)',
        },
        id: {
          type: 'number',
          description: 'Record ID',
        },
        property_field: {
          type: 'string',
          description: 'Properties field name (auto-detected if omitted)',
        },
        format: {
          type: 'string',
          enum: ['raw', 'simple', 'both'],
          description: 'Output format (default: both)',
        },
      },
      required: ['model', 'id'],
    },
  },
  {
    name: 'odoo_update_properties',
    description:
      'Safely update properties using read-modify-write pattern (prevents accidental data loss)',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Model name (e.g., crm.lead, project.task)',
        },
        id: {
          type: 'number',
          description: 'Record ID',
        },
        updates: {
          type: 'object',
          description: 'Property values to update (partial update supported)',
        },
        property_field: {
          type: 'string',
          description: 'Properties field name (auto-detected if omitted)',
        },
      },
      required: ['model', 'id', 'updates'],
    },
  },
  {
    name: 'odoo_find_properties_field',
    description: 'Discover if a model has a properties field and its configuration',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Model name to check',
        },
      },
      required: ['model'],
    },
  },
  {
    name: 'odoo_get_property_definitions',
    description: 'Get property definitions from the parent model',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Record model (e.g., crm.lead)',
        },
        parent_id: {
          type: 'number',
          description: 'Parent record ID (e.g., team_id for leads)',
        },
      },
      required: ['model', 'parent_id'],
    },
  },
  {
    name: 'odoo_set_property_definitions',
    description: 'Define or update property definitions on a parent model (admin operation)',
    inputSchema: {
      type: 'object',
      properties: {
        definition_model: {
          type: 'string',
          description: 'Model holding definitions (e.g., crm.team)',
        },
        definition_id: {
          type: 'number',
          description: 'Record ID on definition model',
        },
        definition_field: {
          type: 'string',
          description: 'Definition field name (auto-detected if possible)',
        },
        definitions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              string: { type: 'string' },
              type: { type: 'string' },
              selection: { type: 'array' },
              comodel: { type: 'string' },
              default: {},
            },
            required: ['name', 'string', 'type'],
          },
          description: 'Property definitions',
        },
        mode: {
          type: 'string',
          enum: ['replace', 'merge'],
          description: 'replace = overwrite all, merge = add/update by name',
        },
      },
      required: ['definition_model', 'definition_id', 'definitions'],
    },
  },
];
