/**
 * FollowerService - Business logic for Odoo follower management
 *
 * Provides high-level API for:
 * - Listing followers on records
 * - Adding followers (partners) to records
 * - Removing followers from records
 *
 * @see https://github.com/odoo/odoo/blob/17.0/addons/mail/models/mail_followers.py
 * @see https://github.com/odoo/odoo/blob/17.0/addons/mail/models/mail_thread.py - message_subscribe/message_unsubscribe
 */

import debug from 'debug';
import type { OdooClient } from '../client/odoo-client';

const log = debug('odoo-client:follower-service');

export interface Follower {
  id: number;
  partner_id: [number, string];
  res_model: string;
  res_id: number;
  name?: string;
  email?: string;
}

/**
 * Service for managing followers in Odoo
 *
 * Followers are partners who receive notifications about updates to a record.
 * This service provides methods to list, add, and remove followers.
 */
export class FollowerService {
  constructor(private client: OdooClient) {}

  /**
   * List followers for a record
   *
   * @param model - Model name (e.g., 'project.task')
   * @param resId - Record ID
   * @returns Array of followers
   *
   * @example
   * ```typescript
   * const followers = await followerService.list('project.task', taskId);
   * console.log('Followers:', followers.map(f => f.partner_id[1]));
   * ```
   */
  async list(model: string, resId: number): Promise<Follower[]> {
    log('Listing followers for %s/%d', model, resId);

    const followers = await this.client.searchRead<Follower>(
      'mail.followers',
      [
        ['res_model', '=', model],
        ['res_id', '=', resId],
      ],
      {
        fields: ['id', 'partner_id', 'res_model', 'res_id', 'name', 'email'],
      }
    );

    log('Found %d followers', followers.length);
    return followers;
  }

  /**
   * Add followers to a record
   *
   * Uses the message_subscribe method which is the standard way to add followers.
   *
   * @param model - Model name
   * @param resId - Record ID
   * @param partnerIds - Partner IDs to add as followers
   * @param context - Additional context
   *
   * @see https://github.com/odoo/odoo/blob/17.0/addons/mail/models/mail_thread.py:message_subscribe
   *
   * @example
   * ```typescript
   * await followerService.add('project.task', taskId, [partnerId1, partnerId2]);
   * ```
   */
  async add(
    model: string,
    resId: number,
    partnerIds: number[],
    context: Record<string, any> = {}
  ): Promise<void> {
    if (partnerIds.length === 0) {
      log('No partners to add as followers');
      return;
    }

    log('Adding %d followers to %s/%d', partnerIds.length, model, resId);

    await this.client.call(model, 'message_subscribe', [[resId]], {
      partner_ids: partnerIds,
      context,
    });

    log('Added followers successfully');
  }

  /**
   * Remove followers from a record
   *
   * Uses the message_unsubscribe method which is the standard way to remove followers.
   *
   * @param model - Model name
   * @param resId - Record ID
   * @param partnerIds - Partner IDs to remove as followers
   * @param context - Additional context
   *
   * @see https://github.com/odoo/odoo/blob/17.0/addons/mail/models/mail_thread.py:message_unsubscribe
   *
   * @example
   * ```typescript
   * await followerService.remove('project.task', taskId, [partnerId]);
   * ```
   */
  async remove(
    model: string,
    resId: number,
    partnerIds: number[],
    context: Record<string, any> = {}
  ): Promise<void> {
    if (partnerIds.length === 0) {
      log('No partners to remove as followers');
      return;
    }

    log('Removing %d followers from %s/%d', partnerIds.length, model, resId);

    await this.client.call(model, 'message_unsubscribe', [[resId]], {
      partner_ids: partnerIds,
      context,
    });

    log('Removed followers successfully');
  }
}
