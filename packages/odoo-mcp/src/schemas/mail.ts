/**
 * Zod schemas for mail/chatter MCP tools.
 */

import { z } from 'zod';

// ============================================================================
// Post Internal Note
// ============================================================================

export const PostInternalNoteInputSchema = z.object({
  model: z.string().min(1).describe('Target model with chatter (e.g., res.partner, crm.lead)'),
  id: z.number().int().positive().describe('Record ID'),
  body: z.string().min(1).describe('Note content (HTML or plain text)'),
  attachments: z
    .array(
      z.tuple([z.string().describe('Filename'), z.string().describe('Base64-encoded content')])
    )
    .optional()
    .describe('Inline attachments as [filename, base64_content] tuples'),
  attachment_ids: z
    .array(z.number().int().positive())
    .optional()
    .describe('IDs of existing ir.attachment records to attach'),
});

export type PostInternalNoteInput = z.infer<typeof PostInternalNoteInputSchema>;

export interface PostInternalNoteOutput {
  success: boolean;
  message_id?: number;
  message: string;
}

// ============================================================================
// Post Public Message
// ============================================================================

export const PostPublicMessageInputSchema = z.object({
  model: z.string().min(1).describe('Target model with chatter (e.g., res.partner, crm.lead)'),
  id: z.number().int().positive().describe('Record ID'),
  body: z.string().min(1).describe('Message content (HTML or plain text)'),
  partner_ids: z
    .array(z.number().int().positive())
    .optional()
    .describe('Specific partner IDs to notify (in addition to followers)'),
  attachments: z
    .array(
      z.tuple([z.string().describe('Filename'), z.string().describe('Base64-encoded content')])
    )
    .optional()
    .describe('Inline attachments as [filename, base64_content] tuples'),
  attachment_ids: z
    .array(z.number().int().positive())
    .optional()
    .describe('IDs of existing ir.attachment records to attach'),
});

export type PostPublicMessageInput = z.infer<typeof PostPublicMessageInputSchema>;

export interface PostPublicMessageOutput {
  success: boolean;
  message_id?: number;
  message: string;
}

// ============================================================================
// Get Messages
// ============================================================================

export const GetMessagesInputSchema = z.object({
  model: z.string().min(1).describe('Target model'),
  id: z.number().int().positive().describe('Record ID'),
  limit: z.number().int().positive().default(20).describe('Maximum messages to return'),
  message_types: z
    .array(z.enum(['comment', 'notification', 'email', 'user_notification']))
    .optional()
    .describe('Filter by message types'),
});

export type GetMessagesInput = z.infer<typeof GetMessagesInputSchema>;

export interface MessageRecord {
  id: number;
  body: string;
  message_type: string;
  subtype_id: [number, string] | false;
  author_id: [number, string] | false;
  date: string;
  attachment_ids: number[];
}

export interface GetMessagesOutput {
  success: boolean;
  messages?: MessageRecord[];
  count?: number;
  message: string;
}

// ============================================================================
// Manage Followers
// ============================================================================

export const ManageFollowersInputSchema = z.object({
  model: z.string().min(1).describe('Target model'),
  id: z.number().int().positive().describe('Record ID'),
  action: z.enum(['add', 'remove', 'list']).describe('Action to perform'),
  partner_ids: z
    .array(z.number().int().positive())
    .optional()
    .describe('Partner IDs to add or remove (required for add/remove)'),
});

export type ManageFollowersInput = z.infer<typeof ManageFollowersInputSchema>;

export interface FollowerRecord {
  id: number;
  partner_id: [number, string];
}

export interface ManageFollowersOutput {
  success: boolean;
  followers?: FollowerRecord[];
  count?: number;
  message: string;
}

// ============================================================================
// Add Attachment
// ============================================================================

export const AddAttachmentInputSchema = z.object({
  model: z.string().min(1).describe('Target model'),
  id: z.number().int().positive().describe('Record ID'),
  filename: z.string().min(1).describe('Filename with extension'),
  content: z.string().min(1).describe('Base64-encoded file content'),
  description: z.string().optional().describe('Optional description for the attachment'),
});

export type AddAttachmentInput = z.infer<typeof AddAttachmentInputSchema>;

export interface AddAttachmentOutput {
  success: boolean;
  attachment_id?: number;
  message: string;
}

// ============================================================================
// Schedule Activity
// ============================================================================

export const ScheduleActivityInputSchema = z.object({
  model: z.string().min(1).describe('Target model'),
  id: z.number().int().positive().describe('Record ID'),
  activity_type: z
    .string()
    .min(1)
    .describe('Activity type: XML ID (mail.mail_activity_data_todo) or name (To-Do)'),
  summary: z.string().min(1).describe('Activity title/summary'),
  note: z.string().optional().describe('Detailed description (HTML)'),
  date_deadline: z.string().describe('Due date (YYYY-MM-DD format)'),
  user_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Assignee user ID (defaults to current user)'),
});

export type ScheduleActivityInput = z.infer<typeof ScheduleActivityInputSchema>;

export interface ScheduleActivityOutput {
  success: boolean;
  activity_id?: number;
  message: string;
}

// ============================================================================
// Complete Activity
// ============================================================================

export const CompleteActivityInputSchema = z.object({
  activity_ids: z
    .union([z.number().int().positive(), z.array(z.number().int().positive())])
    .describe('Activity ID(s) to complete or cancel'),
  action: z
    .enum(['done', 'cancel'])
    .describe('done = mark complete with feedback, cancel = delete'),
  feedback: z.string().optional().describe('Completion feedback (for done action)'),
});

export type CompleteActivityInput = z.infer<typeof CompleteActivityInputSchema>;

export interface CompleteActivityOutput {
  success: boolean;
  completed_count?: number;
  message: string;
}

// ============================================================================
// Get Activities
// ============================================================================

export const GetActivitiesInputSchema = z.object({
  model: z.string().optional().describe('Filter by model'),
  id: z.number().int().positive().optional().describe('Filter by record ID'),
  state: z
    .enum(['overdue', 'today', 'planned', 'all'])
    .default('all')
    .describe('Filter by activity state'),
  user_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Filter by assignee (defaults to current user)'),
  limit: z.number().int().positive().default(50).describe('Maximum activities to return'),
});

export type GetActivitiesInput = z.infer<typeof GetActivitiesInputSchema>;

export interface ActivityRecord {
  id: number;
  res_model: string;
  res_id: number;
  summary: string;
  note: string | false;
  date_deadline: string;
  state: string;
  activity_type_id: [number, string];
  user_id: [number, string];
}

export interface GetActivitiesOutput {
  success: boolean;
  activities?: ActivityRecord[];
  count?: number;
  message: string;
}

// ============================================================================
// Channel Message
// ============================================================================

export const ChannelMessageInputSchema = z.object({
  channel_id: z.number().int().positive().describe('Channel ID'),
  body: z.string().min(1).describe('Message content'),
});

export type ChannelMessageInput = z.infer<typeof ChannelMessageInputSchema>;

export interface ChannelMessageOutput {
  success: boolean;
  message_id?: number;
  message: string;
}

// ============================================================================
// List Channels
// ============================================================================

export const ListChannelsInputSchema = z.object({
  channel_type: z
    .enum(['channel', 'group', 'chat', 'all'])
    .default('all')
    .describe('Filter by channel type'),
  limit: z.number().int().positive().default(50).describe('Maximum channels to return'),
});

export type ListChannelsInput = z.infer<typeof ListChannelsInputSchema>;

export interface ChannelRecord {
  id: number;
  name: string;
  channel_type: string;
  description: string | false;
}

export interface ListChannelsOutput {
  success: boolean;
  channels?: ChannelRecord[];
  count?: number;
  channel_model?: string;
  message: string;
}
