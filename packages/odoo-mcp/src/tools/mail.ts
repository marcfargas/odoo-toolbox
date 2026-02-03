/**
 * Mail/Chatter MCP tools.
 *
 * Provides tools for:
 * - Posting messages and internal notes
 * - Managing followers
 * - Creating attachments
 * - Scheduling and completing activities
 * - Channel messaging
 */

import { OdooClient } from '@odoo-toolbox/client';
import { SessionManager } from '../session/index.js';
import { formatError, McpErrorResponse } from '../utils/index.js';
import {
  PostInternalNoteInputSchema,
  PostInternalNoteOutput,
  PostPublicMessageInputSchema,
  PostPublicMessageOutput,
  GetMessagesInputSchema,
  GetMessagesOutput,
  ManageFollowersInputSchema,
  ManageFollowersOutput,
  AddAttachmentInputSchema,
  AddAttachmentOutput,
  ScheduleActivityInputSchema,
  ScheduleActivityOutput,
  CompleteActivityInputSchema,
  CompleteActivityOutput,
  GetActivitiesInputSchema,
  GetActivitiesOutput,
  ChannelMessageInputSchema,
  ChannelMessageOutput,
  ListChannelsInputSchema,
  ListChannelsOutput,
} from '../schemas/index.js';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Detect channel model based on Odoo version.
 * Odoo 16+ uses discuss.channel, older versions use mail.channel.
 */
async function getChannelModel(client: OdooClient): Promise<string> {
  const count = await client.call('ir.model', 'search_count', [
    [['model', '=', 'discuss.channel']],
  ]);
  return count > 0 ? 'discuss.channel' : 'mail.channel';
}

/**
 * Resolve activity type from XML ID or name.
 */
async function resolveActivityTypeId(client: OdooClient, activityType: string): Promise<number> {
  // If it's a numeric string, parse it directly
  const asNumber = parseInt(activityType, 10);
  if (!isNaN(asNumber)) {
    return asNumber;
  }

  // If it looks like an XML ID (contains dot), resolve it
  if (activityType.includes('.')) {
    const result = await client.call('ir.model.data', 'xmlid_to_res_id', [activityType]);
    if (result) {
      return result as number;
    }
    throw new Error(`Activity type XML ID not found: ${activityType}`);
  }

  // Otherwise, search by name
  const types = await client.searchRead('mail.activity.type', [['name', 'ilike', activityType]], {
    fields: ['id'],
    limit: 1,
  });

  if (types.length === 0) {
    throw new Error(`Activity type not found: ${activityType}`);
  }

  return types[0].id;
}

/**
 * Wrap plain text in HTML paragraph tags if needed.
 */
function ensureHtml(text: string): string {
  if (text.trim().startsWith('<')) {
    return text;
  }
  return `<p>${text}</p>`;
}

// ============================================================================
// Post Internal Note
// ============================================================================

export async function handlePostInternalNote(
  session: SessionManager,
  input: unknown
): Promise<PostInternalNoteOutput | McpErrorResponse> {
  try {
    const params = PostInternalNoteInputSchema.parse(input);
    const client = session.getClient();

    const messageOptions: Record<string, unknown> = {
      body: ensureHtml(params.body),
      message_type: 'comment',
      subtype_xmlid: 'mail.mt_note',
    };

    if (params.attachments && params.attachments.length > 0) {
      messageOptions.attachments = params.attachments;
    }

    if (params.attachment_ids && params.attachment_ids.length > 0) {
      messageOptions.attachment_ids = params.attachment_ids;
    }

    const messageId = await client.call(
      params.model,
      'message_post',
      [[params.id]],
      messageOptions
    );

    return {
      success: true,
      message_id: messageId as number,
      message: `Internal note posted to ${params.model} record ${params.id}`,
    };
  } catch (error) {
    return formatError(error);
  }
}

// ============================================================================
// Post Public Message
// ============================================================================

export async function handlePostPublicMessage(
  session: SessionManager,
  input: unknown
): Promise<PostPublicMessageOutput | McpErrorResponse> {
  try {
    const params = PostPublicMessageInputSchema.parse(input);
    const client = session.getClient();

    const messageOptions: Record<string, unknown> = {
      body: ensureHtml(params.body),
      message_type: 'comment',
      subtype_xmlid: 'mail.mt_comment',
    };

    if (params.partner_ids && params.partner_ids.length > 0) {
      messageOptions.partner_ids = params.partner_ids;
    }

    if (params.attachments && params.attachments.length > 0) {
      messageOptions.attachments = params.attachments;
    }

    if (params.attachment_ids && params.attachment_ids.length > 0) {
      messageOptions.attachment_ids = params.attachment_ids;
    }

    const messageId = await client.call(
      params.model,
      'message_post',
      [[params.id]],
      messageOptions
    );

    return {
      success: true,
      message_id: messageId as number,
      message: `Public message posted to ${params.model} record ${params.id} (will be sent to followers)`,
    };
  } catch (error) {
    return formatError(error);
  }
}

// ============================================================================
// Get Messages
// ============================================================================

export async function handleGetMessages(
  session: SessionManager,
  input: unknown
): Promise<GetMessagesOutput | McpErrorResponse> {
  try {
    const params = GetMessagesInputSchema.parse(input);
    const client = session.getClient();

    const domain: Array<unknown[]> = [
      ['model', '=', params.model],
      ['res_id', '=', params.id],
    ];

    if (params.message_types && params.message_types.length > 0) {
      domain.push(['message_type', 'in', params.message_types]);
    }

    const messages = await client.searchRead('mail.message', domain, {
      fields: ['body', 'message_type', 'subtype_id', 'author_id', 'date', 'attachment_ids'],
      order: 'date desc',
      limit: params.limit,
    });

    return {
      success: true,
      messages: messages as GetMessagesOutput['messages'],
      count: messages.length,
      message: `Found ${messages.length} messages on ${params.model} record ${params.id}`,
    };
  } catch (error) {
    return formatError(error);
  }
}

// ============================================================================
// Manage Followers
// ============================================================================

export async function handleManageFollowers(
  session: SessionManager,
  input: unknown
): Promise<ManageFollowersOutput | McpErrorResponse> {
  try {
    const params = ManageFollowersInputSchema.parse(input);
    const client = session.getClient();

    if (params.action === 'list') {
      const followers = await client.searchRead(
        'mail.followers',
        [
          ['res_model', '=', params.model],
          ['res_id', '=', params.id],
        ],
        { fields: ['partner_id'] }
      );

      return {
        success: true,
        followers: followers as ManageFollowersOutput['followers'],
        count: followers.length,
        message: `Found ${followers.length} followers`,
      };
    }

    if (!params.partner_ids || params.partner_ids.length === 0) {
      return formatError(new Error('partner_ids required for add/remove actions'));
    }

    if (params.action === 'add') {
      await client.call(params.model, 'message_subscribe', [[params.id]], {
        partner_ids: params.partner_ids,
      });

      return {
        success: true,
        count: params.partner_ids.length,
        message: `Added ${params.partner_ids.length} followers to ${params.model} record ${params.id}`,
      };
    }

    if (params.action === 'remove') {
      await client.call(params.model, 'message_unsubscribe', [[params.id], params.partner_ids]);

      return {
        success: true,
        count: params.partner_ids.length,
        message: `Removed ${params.partner_ids.length} followers from ${params.model} record ${params.id}`,
      };
    }

    return formatError(new Error(`Unknown action: ${params.action}`));
  } catch (error) {
    return formatError(error);
  }
}

// ============================================================================
// Add Attachment
// ============================================================================

export async function handleAddAttachment(
  session: SessionManager,
  input: unknown
): Promise<AddAttachmentOutput | McpErrorResponse> {
  try {
    const params = AddAttachmentInputSchema.parse(input);
    const client = session.getClient();

    const attachmentData: Record<string, unknown> = {
      name: params.filename,
      datas: params.content,
      res_model: params.model,
      res_id: params.id,
    };

    if (params.description) {
      attachmentData.description = params.description;
    }

    const attachmentId = await client.create('ir.attachment', attachmentData);

    return {
      success: true,
      attachment_id: attachmentId,
      message: `Attachment '${params.filename}' created with ID ${attachmentId}`,
    };
  } catch (error) {
    return formatError(error);
  }
}

// ============================================================================
// Schedule Activity
// ============================================================================

export async function handleScheduleActivity(
  session: SessionManager,
  input: unknown
): Promise<ScheduleActivityOutput | McpErrorResponse> {
  try {
    const params = ScheduleActivityInputSchema.parse(input);
    const client = session.getClient();

    const activityTypeId = await resolveActivityTypeId(client, params.activity_type);

    const activityOptions: Record<string, unknown> = {
      activity_type_id: activityTypeId,
      summary: params.summary,
      date_deadline: params.date_deadline,
    };

    if (params.note) {
      activityOptions.note = ensureHtml(params.note);
    }

    if (params.user_id) {
      activityOptions.user_id = params.user_id;
    }

    const activityId = await client.call(
      params.model,
      'activity_schedule',
      [[params.id]],
      activityOptions
    );

    return {
      success: true,
      activity_id: activityId as number,
      message: `Activity scheduled on ${params.model} record ${params.id}`,
    };
  } catch (error) {
    return formatError(error);
  }
}

// ============================================================================
// Complete Activity
// ============================================================================

export async function handleCompleteActivity(
  session: SessionManager,
  input: unknown
): Promise<CompleteActivityOutput | McpErrorResponse> {
  try {
    const params = CompleteActivityInputSchema.parse(input);
    const client = session.getClient();

    const activityIds = Array.isArray(params.activity_ids)
      ? params.activity_ids
      : [params.activity_ids];

    if (params.action === 'done') {
      for (const activityId of activityIds) {
        await client.call('mail.activity', 'action_feedback', [[activityId]], {
          feedback: params.feedback || '',
        });
      }

      return {
        success: true,
        completed_count: activityIds.length,
        message: `Marked ${activityIds.length} activities as done`,
      };
    }

    if (params.action === 'cancel') {
      await client.unlink('mail.activity', activityIds);

      return {
        success: true,
        completed_count: activityIds.length,
        message: `Cancelled ${activityIds.length} activities`,
      };
    }

    return formatError(new Error(`Unknown action: ${params.action}`));
  } catch (error) {
    return formatError(error);
  }
}

// ============================================================================
// Get Activities
// ============================================================================

export async function handleGetActivities(
  session: SessionManager,
  input: unknown
): Promise<GetActivitiesOutput | McpErrorResponse> {
  try {
    const params = GetActivitiesInputSchema.parse(input);
    const client = session.getClient();

    const domain: Array<unknown[]> = [];

    if (params.model) {
      domain.push(['res_model', '=', params.model]);
    }

    if (params.id) {
      domain.push(['res_id', '=', params.id]);
    }

    if (params.user_id) {
      domain.push(['user_id', '=', params.user_id]);
    }

    if (params.state && params.state !== 'all') {
      domain.push(['state', '=', params.state]);
    }

    const activities = await client.searchRead('mail.activity', domain, {
      fields: [
        'res_model',
        'res_id',
        'summary',
        'note',
        'date_deadline',
        'state',
        'activity_type_id',
        'user_id',
      ],
      order: 'date_deadline asc',
      limit: params.limit,
    });

    return {
      success: true,
      activities: activities as GetActivitiesOutput['activities'],
      count: activities.length,
      message: `Found ${activities.length} activities`,
    };
  } catch (error) {
    return formatError(error);
  }
}

// ============================================================================
// Channel Message
// ============================================================================

export async function handleChannelMessage(
  session: SessionManager,
  input: unknown
): Promise<ChannelMessageOutput | McpErrorResponse> {
  try {
    const params = ChannelMessageInputSchema.parse(input);
    const client = session.getClient();

    const channelModel = await getChannelModel(client);

    const messageId = await client.call(channelModel, 'message_post', [[params.channel_id]], {
      body: ensureHtml(params.body),
      message_type: 'comment',
    });

    return {
      success: true,
      message_id: messageId as number,
      message: `Message posted to channel ${params.channel_id}`,
    };
  } catch (error) {
    return formatError(error);
  }
}

// ============================================================================
// List Channels
// ============================================================================

export async function handleListChannels(
  session: SessionManager,
  input: unknown
): Promise<ListChannelsOutput | McpErrorResponse> {
  try {
    const params = ListChannelsInputSchema.parse(input);
    const client = session.getClient();

    const channelModel = await getChannelModel(client);

    const domain: Array<unknown[]> = [];

    if (params.channel_type && params.channel_type !== 'all') {
      domain.push(['channel_type', '=', params.channel_type]);
    }

    const channels = await client.searchRead(channelModel, domain, {
      fields: ['name', 'channel_type', 'description'],
      order: 'name asc',
      limit: params.limit,
    });

    return {
      success: true,
      channels: channels as ListChannelsOutput['channels'],
      count: channels.length,
      channel_model: channelModel,
      message: `Found ${channels.length} channels`,
    };
  } catch (error) {
    return formatError(error);
  }
}

// ============================================================================
// Tool Definitions
// ============================================================================

export const mailToolDefinitions = [
  {
    name: 'odoo_post_internal_note',
    description:
      'Post an internal note on a record (visible only to internal users, NOT sent to followers)',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Target model with chatter (e.g., res.partner, crm.lead)',
        },
        id: {
          type: 'number',
          description: 'Record ID',
        },
        body: {
          type: 'string',
          description: 'Note content (HTML or plain text)',
        },
        attachments: {
          type: 'array',
          items: {
            type: 'array',
            items: { type: 'string' },
          },
          description: 'Inline attachments as [filename, base64_content] tuples',
        },
        attachment_ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'IDs of existing ir.attachment records to attach',
        },
      },
      required: ['model', 'id', 'body'],
    },
  },
  {
    name: 'odoo_post_public_message',
    description: 'Post a public message on a record (sent to all followers via email)',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Target model with chatter (e.g., res.partner, crm.lead)',
        },
        id: {
          type: 'number',
          description: 'Record ID',
        },
        body: {
          type: 'string',
          description: 'Message content (HTML or plain text)',
        },
        partner_ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Additional partner IDs to notify',
        },
        attachments: {
          type: 'array',
          items: {
            type: 'array',
            items: { type: 'string' },
          },
          description: 'Inline attachments as [filename, base64_content] tuples',
        },
        attachment_ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'IDs of existing ir.attachment records to attach',
        },
      },
      required: ['model', 'id', 'body'],
    },
  },
  {
    name: 'odoo_get_messages',
    description: "Read messages from a record's chatter",
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Target model',
        },
        id: {
          type: 'number',
          description: 'Record ID',
        },
        limit: {
          type: 'number',
          description: 'Maximum messages to return (default 20)',
        },
        message_types: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by message types: comment, notification, email',
        },
      },
      required: ['model', 'id'],
    },
  },
  {
    name: 'odoo_manage_followers',
    description: 'Add, remove, or list followers on a record',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Target model',
        },
        id: {
          type: 'number',
          description: 'Record ID',
        },
        action: {
          type: 'string',
          enum: ['add', 'remove', 'list'],
          description: 'Action to perform',
        },
        partner_ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Partner IDs to add or remove (required for add/remove)',
        },
      },
      required: ['model', 'id', 'action'],
    },
  },
  {
    name: 'odoo_add_attachment',
    description: 'Create and attach a file to a record',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Target model',
        },
        id: {
          type: 'number',
          description: 'Record ID',
        },
        filename: {
          type: 'string',
          description: 'Filename with extension',
        },
        content: {
          type: 'string',
          description: 'Base64-encoded file content',
        },
        description: {
          type: 'string',
          description: 'Optional description',
        },
      },
      required: ['model', 'id', 'filename', 'content'],
    },
  },
  {
    name: 'odoo_schedule_activity',
    description: 'Schedule an activity (task/reminder) on a record',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Target model',
        },
        id: {
          type: 'number',
          description: 'Record ID',
        },
        activity_type: {
          type: 'string',
          description: 'Activity type: XML ID (mail.mail_activity_data_todo) or name (To-Do)',
        },
        summary: {
          type: 'string',
          description: 'Activity title',
        },
        note: {
          type: 'string',
          description: 'Detailed description (HTML)',
        },
        date_deadline: {
          type: 'string',
          description: 'Due date (YYYY-MM-DD)',
        },
        user_id: {
          type: 'number',
          description: 'Assignee user ID (defaults to current user)',
        },
      },
      required: ['model', 'id', 'activity_type', 'summary', 'date_deadline'],
    },
  },
  {
    name: 'odoo_complete_activity',
    description: 'Mark activities as done or cancel them',
    inputSchema: {
      type: 'object',
      properties: {
        activity_ids: {
          oneOf: [{ type: 'number' }, { type: 'array', items: { type: 'number' } }],
          description: 'Activity ID(s)',
        },
        action: {
          type: 'string',
          enum: ['done', 'cancel'],
          description: 'done = mark complete, cancel = delete',
        },
        feedback: {
          type: 'string',
          description: 'Completion feedback (for done action)',
        },
      },
      required: ['activity_ids', 'action'],
    },
  },
  {
    name: 'odoo_get_activities',
    description: 'Get activities filtered by model, record, state, or user',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Filter by model',
        },
        id: {
          type: 'number',
          description: 'Filter by record ID',
        },
        state: {
          type: 'string',
          enum: ['overdue', 'today', 'planned', 'all'],
          description: 'Filter by state',
        },
        user_id: {
          type: 'number',
          description: 'Filter by assignee',
        },
        limit: {
          type: 'number',
          description: 'Maximum activities to return (default 50)',
        },
      },
      required: [],
    },
  },
  {
    name: 'odoo_channel_message',
    description: 'Post a message to a discuss/mail channel',
    inputSchema: {
      type: 'object',
      properties: {
        channel_id: {
          type: 'number',
          description: 'Channel ID',
        },
        body: {
          type: 'string',
          description: 'Message content',
        },
      },
      required: ['channel_id', 'body'],
    },
  },
  {
    name: 'odoo_list_channels',
    description: 'List available discuss channels',
    inputSchema: {
      type: 'object',
      properties: {
        channel_type: {
          type: 'string',
          enum: ['channel', 'group', 'chat', 'all'],
          description: 'Filter by channel type',
        },
        limit: {
          type: 'number',
          description: 'Maximum channels to return (default 50)',
        },
      },
      required: [],
    },
  },
];
