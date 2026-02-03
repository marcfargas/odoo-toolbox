/**
 * Base schema for mail.message - Odoo messages/chatter.
 *
 * This model stores all messages in Odoo's chatter system,
 * including internal notes, emails, and system notifications.
 *
 * @see https://github.com/odoo/odoo/blob/17.0/addons/mail/models/mail_message.py
 */

import type { BaseModelSchema } from './types.js';

export const MAIL_MESSAGE_BASE: BaseModelSchema = {
  model: 'mail.message',
  description:
    "Odoo messages - stores all chatter messages, emails, and notifications. Linked to records via 'model' and 'res_id' fields.",
  fields: {
    id: {
      type: 'integer',
      description: 'Unique message identifier',
    },
    body: {
      type: 'string',
      description: 'Message content (HTML format)',
      format: 'html',
    },
    subject: {
      type: ['string', 'null'],
      description: 'Message subject (mainly for emails)',
    },
    message_type: {
      type: 'string',
      description: 'Type of message',
      enum: ['email', 'comment', 'notification', 'user_notification', 'auto_comment'],
    },
    subtype_id: {
      type: ['array', 'null'],
      description: 'Message subtype [id, name] for notification routing',
      relation: 'mail.message.subtype',
    },
    model: {
      type: ['string', 'null'],
      description:
        'Technical model name the message is attached to (e.g., "sale.order", "res.partner")',
    },
    res_id: {
      type: ['integer', 'null'],
      description: 'Record ID the message is attached to (combined with model to identify record)',
    },
    record_name: {
      type: ['string', 'null'],
      description: 'Display name of the linked record (computed)',
      readOnly: true,
    },
    author_id: {
      type: ['array', 'null'],
      description: 'Message author [id, name] (res.partner)',
      relation: 'res.partner',
    },
    email_from: {
      type: ['string', 'null'],
      description: 'Email address of sender (for incoming emails)',
    },
    partner_ids: {
      type: 'array',
      items: { type: 'integer' },
      description: 'Recipients (res.partner IDs)',
      relation: 'res.partner',
    },
    parent_id: {
      type: ['array', 'null'],
      description: 'Parent message [id, name] for threading',
      relation: 'mail.message',
    },
    date: {
      type: 'string',
      format: 'date-time',
      description: 'Message timestamp',
    },
    attachment_ids: {
      type: 'array',
      items: { type: 'integer' },
      description: 'Attached files (ir.attachment IDs)',
      relation: 'ir.attachment',
    },
    starred_partner_ids: {
      type: 'array',
      items: { type: 'integer' },
      description: 'Partners who starred this message',
      relation: 'res.partner',
    },
    is_internal: {
      type: 'boolean',
      description: 'True if this is an internal note (not visible to portal users/customers)',
    },
  },
  required: ['id', 'message_type'],
};
