/**
 * Types for mail / chatter services.
 */

/**
 * Options for posting a message or note to a record's chatter.
 */
export interface PostMessageOptions {
  /**
   * Partner IDs to @mention. Mentioned partners receive a notification.
   * These are res.partner IDs (not res.users IDs).
   *
   * To find a user's partner ID:
   *   const [user] = await client.read('res.users', userId, ['partner_id']);
   *   const partnerId = user.partner_id[0];
   */
  partnerIds?: number[];

  /**
   * Pre-created ir.attachment IDs to attach to the message.
   * Attachments must be created first via client.create('ir.attachment', {...}).
   */
  attachmentIds?: number[];
}
