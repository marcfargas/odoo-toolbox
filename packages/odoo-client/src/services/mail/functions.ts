/**
 * Mail / Chatter standalone functions for Odoo
 *
 * Two functions, two intents — no confusion possible:
 * - postInternalNote()  → staff-only note (subtype: mail.mt_note)
 * - postOpenMessage()   → public message visible to ALL followers (subtype: mail.mt_comment)
 *
 * Body is ALWAYS HTML. Plain text is auto-wrapped in <p> tags.
 * Empty body throws immediately — Odoo silently accepts it but it's always a bug.
 *
 * ## Implementation: message_post with body_is_html
 *
 * Uses Odoo's `message_post()` RPC method, which handles the full messaging
 * pipeline: follower notifications, auto-subscription, reply-to, post-hooks.
 *
 * The `body_is_html=True` kwarg is required because `message_post` escapes
 * plain strings via `markupsafe.escape()`. This kwarg converts the body to
 * a `Markup` object server-side, preserving HTML as-is.
 *
 * Verified empirically against Odoo 17:
 * - message_post without body_is_html → HTML escaped (broken)
 * - message_post with body_is_html    → HTML preserved ✓
 * - Follower notifications created    → ✓ (for mt_comment subtype)
 * - Internal notes (mt_note)          → no notifications (correct)
 * - Return value                      → message ID (number)
 *
 * @see https://github.com/odoo/odoo/blob/17.0/addons/mail/models/mail_thread.py — message_post
 */

import type { OdooClient } from '../../client/odoo-client';
import { OdooValidationError } from '../../types/errors';
import type { PostMessageOptions } from './types';

/** Subtype XML IDs as defined by Odoo's mail module data. */
const SUBTYPE_COMMENT_XMLID = 'mail.mt_comment';
const SUBTYPE_NOTE_XMLID = 'mail.mt_note';

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
 * Call message_post on a record. Handles body_is_html, is_internal, and common parameters.
 *
 * IMPORTANT: message_post does NOT set is_internal from the subtype.
 * We must pass is_internal explicitly for internal notes.
 * Verified empirically: mt_note without is_internal=true → is_internal stays false.
 *
 * @returns Created mail.message ID
 */
async function callMessagePost(
  client: OdooClient,
  model: string,
  resId: number,
  body: string,
  subtypeXmlid: string,
  isInternal: boolean,
  options?: PostMessageOptions
): Promise<number> {
  const htmlBody = ensureHtmlBody(body);

  const kwargs: Record<string, any> = {
    body: htmlBody,
    body_is_html: true,
    message_type: 'comment',
    subtype_xmlid: subtypeXmlid,
    is_internal: isInternal,
  };

  if (options?.partnerIds?.length) {
    kwargs.partner_ids = options.partnerIds;
  }
  if (options?.attachmentIds?.length) {
    kwargs.attachment_ids = options.attachmentIds;
  }

  // message_post return type varies by Odoo version:
  //   Odoo 17/18 → integer    (the new message ID)
  //   Odoo 19    → [integer]  (single-element array wrapping the ID)
  // Also handle { id: number } defensively for any future variation.
  // Observed empirically on live Odoo 19 — not documented in official sources.
  const result = await client.call<number | number[] | Record<string, unknown>>(
    model,
    'message_post',
    [[resId]],
    kwargs
  );
  if (typeof result === 'number') return result;
  if (Array.isArray(result) && result.length > 0 && typeof result[0] === 'number') {
    return result[0];
  }
  if (
    result !== null &&
    typeof result === 'object' &&
    typeof (result as Record<string, unknown>).id === 'number'
  ) {
    return (result as { id: number }).id;
  }
  throw new Error(`message_post returned unexpected type: ${JSON.stringify(result)}`);
}

/**
 * Post an internal note on a record's chatter.
 *
 * Internal notes use the `mail.mt_note` subtype — visible only to internal
 * (staff) users. Portal users and public visitors will NOT see them.
 * No email notification is sent to followers (this is standard Odoo behavior
 * for notes).
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
  return callMessagePost(client, model, resId, body, SUBTYPE_NOTE_XMLID, true, options);
}

/**
 * Post an open (public) message on a record's chatter.
 *
 * Open messages use the `mail.mt_comment` subtype — visible to ALL followers,
 * including portal users and external partners. Email notifications ARE sent
 * to followers (standard Odoo behavior for comments).
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
  return callMessagePost(client, model, resId, body, SUBTYPE_COMMENT_XMLID, false, options);
}
