/**
 * Mail / Chatter standalone functions for Odoo
 *
 * Two functions, two intents — no confusion possible:
 * - postInternalNote()  → staff-only note (subtype: mail.mt_note, is_internal: true)
 * - postOpenMessage()   → public message visible to ALL followers (subtype: mail.mt_comment)
 *
 * Body is ALWAYS HTML. Plain text is auto-wrapped in <p> tags.
 * Empty body throws immediately — Odoo silently accepts it but it's always a bug.
 *
 * Uses direct mail.message create (NOT message_post) because message_post
 * has RPC compatibility issues with external JSON-RPC clients — the body
 * parameter may not be passed correctly through execute_kw.
 *
 * @see https://github.com/odoo/odoo/blob/17.0/addons/mail/models/mail_message.py
 * @see https://github.com/odoo/odoo/blob/17.0/addons/mail/models/mail_thread.py
 */

import type { OdooClient } from '../../client/odoo-client';
import { OdooValidationError } from '../../types/errors';
import type { PostMessageOptions } from './types';

/**
 * Subtype IDs as defined by Odoo's mail module data.
 *
 * These are stable numeric IDs loaded from XML data:
 * - mail.mt_comment (id=1) → Discussions, public, visible to followers
 * - mail.mt_note    (id=2) → Note, internal, staff only
 *
 * @see https://github.com/odoo/odoo/blob/17.0/addons/mail/data/mail_message_subtype_data.xml
 */
const SUBTYPE_COMMENT = 1;
const SUBTYPE_NOTE = 2;

/**
 * Ensure body is valid HTML. Throws on empty/blank input.
 *
 * Rules:
 * - Empty or whitespace-only → throws OdooValidationError
 * - Already has HTML tags → used as-is
 * - Plain text → wrapped in <p>...</p>
 */
export function ensureHtmlBody(body: string): string {
  if (!body || !body.trim()) {
    throw new OdooValidationError(
      'Message body must not be empty. ' +
        "Provide HTML (e.g. '<p>Called the customer, they want a callback.</p>') " +
        'or plain text (auto-wrapped in <p> tags).'
    );
  }

  const trimmed = body.trim();

  // If it already looks like HTML (starts with a tag), use as-is
  if (trimmed.startsWith('<')) {
    return trimmed;
  }

  // Plain text → wrap in <p>
  return `<p>${trimmed}</p>`;
}

/**
 * Build the mail.message values dict from common parameters.
 */
function buildMessageValues(
  model: string,
  resId: number,
  body: string,
  subtypeId: number,
  isInternal: boolean,
  options?: PostMessageOptions
): Record<string, any> {
  const htmlBody = ensureHtmlBody(body);

  const values: Record<string, any> = {
    model,
    res_id: resId,
    body: htmlBody,
    message_type: 'comment',
    subtype_id: subtypeId,
    is_internal: isInternal,
  };

  if (options?.partnerIds?.length) {
    values.partner_ids = [[6, 0, options.partnerIds]];
  }
  if (options?.attachmentIds?.length) {
    values.attachment_ids = [[6, 0, options.attachmentIds]];
  }

  return values;
}

/**
 * Post an internal note on a record's chatter.
 *
 * Internal notes are visible ONLY to internal (staff) users.
 * Portal users and public visitors will NOT see them.
 * No email notification is sent to followers.
 *
 * The target model MUST inherit from mail.thread (most business models do:
 * res.partner, crm.lead, sale.order, account.move, project.task, etc.)
 *
 * @param client - Authenticated OdooClient instance
 * @param model  - Odoo model name (e.g. 'res.partner', 'crm.lead')
 * @param resId  - ID of the record to post on
 * @param body   - Message content. HTML string or plain text (auto-wrapped in <p>).
 *                 Examples:
 *                   '<p>Customer called, wants a <b>callback</b> tomorrow.</p>'
 *                   'Spoke with warehouse, stock arrives Friday.'
 * @param options - Optional: partnerIds to @mention, attachmentIds
 * @returns Created mail.message ID
 */
export async function postInternalNote(
  client: OdooClient,
  model: string,
  resId: number,
  body: string,
  options?: PostMessageOptions
): Promise<number> {
  const values = buildMessageValues(model, resId, body, SUBTYPE_NOTE, true, options);
  return client.create('mail.message', values);
}

/**
 * Post an open (public) message on a record's chatter.
 *
 * Open messages are visible to ALL followers — including portal users
 * and external partners. Email notifications ARE sent to followers.
 *
 * The target model MUST inherit from mail.thread.
 *
 * @param client - Authenticated OdooClient instance
 * @param model  - Odoo model name (e.g. 'res.partner', 'crm.lead')
 * @param resId  - ID of the record to post on
 * @param body   - Message content. HTML string or plain text (auto-wrapped in <p>).
 *                 Examples:
 *                   '<p>Your order has been shipped. Tracking: <a href="...">XYZ123</a></p>'
 *                   'We have received your payment. Thank you!'
 * @param options - Optional: partnerIds to @mention, attachmentIds
 * @returns Created mail.message ID
 */
export async function postOpenMessage(
  client: OdooClient,
  model: string,
  resId: number,
  body: string,
  options?: PostMessageOptions
): Promise<number> {
  const values = buildMessageValues(model, resId, body, SUBTYPE_COMMENT, false, options);
  return client.create('mail.message', values);
}
