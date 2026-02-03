/**
 * MailService - Business logic for Odoo mail operations
 *
 * Provides high-level API for:
 * - Posting messages and notes
 * - Retrieving message history
 * - Managing message subtypes
 *
 * @see https://github.com/odoo/odoo/blob/17.0/addons/mail/models/mail_thread.py - message_post method
 */

import debug from 'debug';
import type { OdooClient } from '../client/odoo-client';

const log = debug('odoo-client:mail-service');

/**
 * Message subtype identifiers
 * @see https://github.com/odoo/odoo/blob/17.0/addons/mail/data/mail_data.xml
 */
export enum MessageSubtype {
  /** Internal note (visible only to internal users) */
  NOTE = 'mail.mt_note',
  /** Public comment (visible to followers and external users) */
  COMMENT = 'mail.mt_comment',
}

export interface PostMessageOptions {
  /** Message subtype (default: mail.mt_comment) */
  subtype?: MessageSubtype | string;
  /** Partner IDs to notify */
  partnerIds?: number[];
  /** Additional context for the operation */
  context?: Record<string, any>;
}

export interface GetMessagesOptions {
  /** Maximum number of messages to retrieve */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Order by field (default: 'id DESC') */
  order?: string;
}

export interface MailMessage {
  id: number;
  body: string;
  author_id: [number, string] | false;
  date: string;
  message_type: string;
  subtype_id: [number, string] | false;
  record_name?: string;
  model?: string;
  res_id?: number;
}

/**
 * Get the correct channel model name based on Odoo version
 *
 * Odoo 17+ uses 'discuss.channel', earlier versions use 'mail.channel'
 *
 * @see https://github.com/odoo/odoo/blob/17.0/addons/mail/models/discuss_channel.py
 * @param client - OdooClient instance
 * @returns 'discuss.channel' or 'mail.channel'
 */
export async function getChannelModel(client: OdooClient): Promise<string> {
  // Check if discuss.channel exists (Odoo 17+)
  try {
    const models = await client.call<any[]>('ir.model', 'search_read', [
      [['model', '=', 'discuss.channel']],
    ]);
    if (models.length > 0) {
      return 'discuss.channel';
    }
  } catch {
    // Model doesn't exist, fall through
  }

  return 'mail.channel';
}

/**
 * Ensure text is wrapped in HTML paragraph tags
 *
 * Odoo's message_post expects HTML content. This helper wraps plain text
 * in <p> tags if it doesn't already contain HTML.
 *
 * @param text - Plain text or HTML content
 * @returns HTML-wrapped content
 */
export function ensureHtml(text: string): string {
  // Check if text already contains HTML tags
  if (/<[a-z][\s\S]*>/i.test(text)) {
    return text;
  }
  return `<p>${text}</p>`;
}

/**
 * Service for managing mail operations in Odoo
 *
 * Handles message posting, retrieval, and formatting for the mail module.
 */
export class MailService {
  constructor(private client: OdooClient) {}

  /**
   * Post a message on a record
   *
   * @param model - Model name (e.g., 'project.task')
   * @param resId - Record ID
   * @param body - Message body (plain text or HTML)
   * @param options - Additional options (subtype, partners, context)
   * @returns Message ID
   *
   * @example
   * ```typescript
   * const messageId = await mailService.postMessage(
   *   'project.task',
   *   taskId,
   *   'Task completed successfully',
   *   { subtype: MessageSubtype.COMMENT }
   * );
   * ```
   */
  async postMessage(
    model: string,
    resId: number,
    body: string,
    options: PostMessageOptions = {}
  ): Promise<number> {
    const { subtype = MessageSubtype.COMMENT, partnerIds = [], context = {} } = options;

    log('Posting message on %s/%d with subtype %s', model, resId, subtype);

    const htmlBody = ensureHtml(body);

    const kwargs: Record<string, any> = {
      body: htmlBody,
      message_type: 'comment',
      subtype_xmlid: subtype,
      context,
    };

    if (partnerIds.length > 0) {
      kwargs.partner_ids = partnerIds;
    }

    const messageId = await this.client.call<number>(model, 'message_post', [resId], kwargs);

    log('Posted message ID %d', messageId);
    return messageId;
  }

  /**
   * Post an internal note on a record
   *
   * Convenience method for posting internal notes (only visible to internal users).
   *
   * @param model - Model name
   * @param resId - Record ID
   * @param body - Note body (plain text or HTML)
   * @param context - Additional context
   * @returns Message ID
   *
   * @example
   * ```typescript
   * const noteId = await mailService.postInternalNote(
   *   'project.task',
   *   taskId,
   *   'Internal note: Check with customer'
   * );
   * ```
   */
  async postInternalNote(
    model: string,
    resId: number,
    body: string,
    context: Record<string, any> = {}
  ): Promise<number> {
    return this.postMessage(model, resId, body, {
      subtype: MessageSubtype.NOTE,
      context,
    });
  }

  /**
   * Get messages for a record
   *
   * @param model - Model name
   * @param resId - Record ID
   * @param options - Query options (limit, offset, order)
   * @returns Array of messages
   *
   * @example
   * ```typescript
   * const messages = await mailService.getMessages('project.task', taskId, {
   *   limit: 10,
   *   order: 'id DESC'
   * });
   * ```
   */
  async getMessages(
    model: string,
    resId: number,
    options: GetMessagesOptions = {}
  ): Promise<MailMessage[]> {
    const { limit = 100, offset = 0, order = 'id DESC' } = options;

    log('Getting messages for %s/%d', model, resId);

    const messages = await this.client.searchRead<MailMessage>(
      'mail.message',
      [
        ['model', '=', model],
        ['res_id', '=', resId],
      ],
      {
        fields: [
          'id',
          'body',
          'author_id',
          'date',
          'message_type',
          'subtype_id',
          'record_name',
          'model',
          'res_id',
        ],
        limit,
        offset,
        order,
      }
    );

    log('Retrieved %d messages', messages.length);
    return messages;
  }
}
