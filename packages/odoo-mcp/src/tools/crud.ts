import { SessionManager } from '../session/index.js';
import { formatError, McpErrorResponse } from '../utils/index.js';
import {
  SearchInputSchema,
  SearchOutput,
  ReadInputSchema,
  ReadOutput,
  SearchReadInputSchema,
  SearchReadOutput,
  CreateInputSchema,
  CreateOutput,
  WriteInputSchema,
  WriteOutput,
  UnlinkInputSchema,
  UnlinkOutput,
  CallInputSchema,
  CallOutput,
} from '../schemas/index.js';

export async function handleSearch(
  session: SessionManager,
  input: unknown
): Promise<SearchOutput | McpErrorResponse> {
  try {
    const params = SearchInputSchema.parse(input);
    const client = session.getClient();

    const ids = await client.search(params.model, params.domain, {
      offset: params.offset,
      limit: params.limit,
      order: params.order,
    });

    return {
      success: true,
      ids,
      count: ids.length,
      message: `Found ${ids.length} record(s) in ${params.model}`,
    };
  } catch (error) {
    return formatError(error);
  }
}

export async function handleRead(
  session: SessionManager,
  input: unknown
): Promise<ReadOutput | McpErrorResponse> {
  try {
    const params = ReadInputSchema.parse(input);
    const client = session.getClient();

    const records = await client.read(params.model, params.ids, params.fields);

    return {
      success: true,
      records,
      count: records.length,
      message: `Read ${records.length} record(s) from ${params.model}`,
    };
  } catch (error) {
    return formatError(error);
  }
}

export async function handleSearchRead(
  session: SessionManager,
  input: unknown
): Promise<SearchReadOutput | McpErrorResponse> {
  try {
    const params = SearchReadInputSchema.parse(input);
    const client = session.getClient();

    const records = await client.searchRead(params.model, params.domain, {
      fields: params.fields,
      offset: params.offset,
      limit: params.limit,
      order: params.order,
    });

    return {
      success: true,
      records,
      count: records.length,
      message: `Found and read ${records.length} record(s) from ${params.model}`,
    };
  } catch (error) {
    return formatError(error);
  }
}

export async function handleCreate(
  session: SessionManager,
  input: unknown
): Promise<CreateOutput | McpErrorResponse> {
  try {
    const params = CreateInputSchema.parse(input);
    const client = session.getClient();

    const id = await client.create(params.model, params.values, params.context);

    return {
      success: true,
      id,
      message: `Created record ${id} in ${params.model}`,
    };
  } catch (error) {
    return formatError(error);
  }
}

export async function handleWrite(
  session: SessionManager,
  input: unknown
): Promise<WriteOutput | McpErrorResponse> {
  try {
    const params = WriteInputSchema.parse(input);
    const client = session.getClient();

    const idsArray = Array.isArray(params.ids) ? params.ids : [params.ids];
    const updated = await client.write(params.model, params.ids, params.values, params.context);

    return {
      success: true,
      updated,
      count: idsArray.length,
      message: updated
        ? `Updated ${idsArray.length} record(s) in ${params.model}`
        : `No records updated in ${params.model}`,
    };
  } catch (error) {
    return formatError(error);
  }
}

export async function handleUnlink(
  session: SessionManager,
  input: unknown
): Promise<UnlinkOutput | McpErrorResponse> {
  try {
    const params = UnlinkInputSchema.parse(input);
    const client = session.getClient();

    const idsArray = Array.isArray(params.ids) ? params.ids : [params.ids];
    const deleted = await client.unlink(params.model, params.ids);

    return {
      success: true,
      deleted,
      count: idsArray.length,
      message: deleted
        ? `Deleted ${idsArray.length} record(s) from ${params.model}`
        : `No records deleted from ${params.model}`,
    };
  } catch (error) {
    return formatError(error);
  }
}

export async function handleCall(
  session: SessionManager,
  input: unknown
): Promise<CallOutput | McpErrorResponse> {
  try {
    const params = CallInputSchema.parse(input);
    const client = session.getClient();

    const result = await client.call(params.model, params.method, params.args, params.kwargs);

    return {
      success: true,
      result,
      message: `Called ${params.model}.${params.method}`,
    };
  } catch (error) {
    return formatError(error);
  }
}

export const crudToolDefinitions = [
  {
    name: 'odoo_search',
    description: 'Search for record IDs matching a domain filter in Odoo',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: "Model name (e.g., 'res.partner')",
        },
        domain: {
          type: 'array',
          description: "Search domain filter (e.g., [['active', '=', true]])",
          default: [],
        },
        offset: {
          type: 'number',
          description: 'Number of records to skip',
        },
        limit: {
          type: 'number',
          description: 'Maximum records to return',
        },
        order: {
          type: 'string',
          description: "Sort order (e.g., 'name asc, id desc')",
        },
      },
      required: ['model'],
    },
  },
  {
    name: 'odoo_read',
    description: 'Read specific records by ID from Odoo',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Model name',
        },
        ids: {
          oneOf: [{ type: 'number' }, { type: 'array', items: { type: 'number' } }],
          description: 'Record ID(s) to read',
        },
        fields: {
          type: 'array',
          items: { type: 'string' },
          description: 'Fields to read (empty = all fields)',
        },
      },
      required: ['model', 'ids'],
    },
  },
  {
    name: 'odoo_search_read',
    description: 'Combined search and read in a single operation',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Model name',
        },
        domain: {
          type: 'array',
          description: 'Search domain filter',
          default: [],
        },
        fields: {
          type: 'array',
          items: { type: 'string' },
          description: 'Fields to return',
        },
        offset: {
          type: 'number',
          description: 'Number of records to skip',
        },
        limit: {
          type: 'number',
          description: 'Maximum records to return',
        },
        order: {
          type: 'string',
          description: 'Sort order',
        },
      },
      required: ['model'],
    },
  },
  {
    name: 'odoo_create',
    description: 'Create a new record in Odoo',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Model name',
        },
        values: {
          type: 'object',
          description: 'Field values for new record',
        },
        context: {
          type: 'object',
          description: 'Optional context for creation',
        },
      },
      required: ['model', 'values'],
    },
  },
  {
    name: 'odoo_write',
    description: 'Update existing records in Odoo',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Model name',
        },
        ids: {
          oneOf: [{ type: 'number' }, { type: 'array', items: { type: 'number' } }],
          description: 'Record ID(s) to update',
        },
        values: {
          type: 'object',
          description: 'Field values to update',
        },
        context: {
          type: 'object',
          description: 'Optional context',
        },
      },
      required: ['model', 'ids', 'values'],
    },
  },
  {
    name: 'odoo_unlink',
    description: 'Delete records from Odoo',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Model name',
        },
        ids: {
          oneOf: [{ type: 'number' }, { type: 'array', items: { type: 'number' } }],
          description: 'Record ID(s) to delete',
        },
      },
      required: ['model', 'ids'],
    },
  },
  {
    name: 'odoo_call',
    description: 'Call any Odoo model method (for advanced operations)',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Model name',
        },
        method: {
          type: 'string',
          description: 'Method name to call',
        },
        args: {
          type: 'array',
          description: 'Positional arguments',
          default: [],
        },
        kwargs: {
          type: 'object',
          description: 'Keyword arguments',
          default: {},
        },
      },
      required: ['model', 'method'],
    },
  },
];
