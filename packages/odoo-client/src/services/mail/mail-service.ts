/**
 * Mail service — the typed interface exposed via `client.mail.*`
 *
 * This is the public API shape. Implementation delegates to standalone
 * functions in functions.ts, binding the client reference.
 */

import type { OdooClient } from '../../client/odoo-client';
import type { PostMessageOptions } from './types';
import {
  postInternalNote as _postInternalNote,
  postOpenMessage as _postOpenMessage,
} from './functions';

/**
 * Mail service providing chatter operations on Odoo records.
 *
 * Access via `client.mail` — never instantiate directly.
 *
 * Two methods, two intents:
 * - `postInternalNote()` → staff-only note (invisible to portal/public)
 * - `postOpenMessage()`  → public message visible to ALL followers
 */
export class MailService {
  /** @internal */
  constructor(private client: OdooClient) {}

  /**
   * Post an internal note on a record's chatter.
   *
   * Internal notes are visible ONLY to internal (staff) users.
   * No email notification is sent. Use for internal communication
   * that customers/portal users must not see.
   *
   * @param model  - Odoo model (must inherit mail.thread)
   * @param resId  - Record ID to post on
   * @param body   - HTML string or plain text (auto-wrapped in `<p>`).
   *                 Example: `'<p>Customer called, wants a <b>callback</b>.</p>'`
   *                 Example: `'Spoke with warehouse — stock arrives Friday.'`
   *                 Empty body throws OdooValidationError.
   * @param options - Optional: partnerIds to @mention, attachmentIds
   * @returns Created mail.message ID
   */
  async postInternalNote(
    model: string,
    resId: number,
    body: string,
    options?: PostMessageOptions
  ): Promise<number> {
    return _postInternalNote(this.client, model, resId, body, options);
  }

  /**
   * Post an open (public) message on a record's chatter.
   *
   * Open messages are visible to ALL followers — including portal users
   * and external partners. Email notifications ARE sent to followers.
   * Use for customer-facing communication and public status updates.
   *
   * @param model  - Odoo model (must inherit mail.thread)
   * @param resId  - Record ID to post on
   * @param body   - HTML string or plain text (auto-wrapped in `<p>`).
   *                 Example: `'<p>Your order has been shipped.</p>'`
   *                 Example: `'Payment received. Thank you!'`
   *                 Empty body throws OdooValidationError.
   * @param options - Optional: partnerIds to @mention, attachmentIds
   * @returns Created mail.message ID
   */
  async postOpenMessage(
    model: string,
    resId: number,
    body: string,
    options?: PostMessageOptions
  ): Promise<number> {
    return _postOpenMessage(this.client, model, resId, body, options);
  }
}
