/**
 * ActivityService - Business logic for Odoo activity management
 *
 * Provides high-level API for:
 * - Scheduling activities
 * - Completing activities with feedback
 * - Canceling activities
 * - Listing activities
 * - Resolving activity types
 *
 * @see https://github.com/odoo/odoo/blob/17.0/addons/mail/models/mail_activity.py
 */

import debug from 'debug';
import type { OdooClient } from '../client/odoo-client';

const log = debug('odoo-client:activity-service');

export interface ScheduleActivityOptions {
  /** Activity type ID or name */
  activityTypeId: number | string;
  /** Summary/title of the activity */
  summary?: string;
  /** Note/description for the activity */
  note?: string;
  /** Due date (ISO format: YYYY-MM-DD) */
  dateDeadline?: string;
  /** User ID assigned to the activity */
  userId?: number;
  /** Additional context */
  context?: Record<string, any>;
}

export interface GetActivitiesOptions {
  /** Filter by activity type */
  activityTypeId?: number;
  /** Filter by assigned user */
  userId?: number;
  /** Filter by state */
  state?: 'overdue' | 'today' | 'planned';
  /** Maximum results to return */
  limit?: number;
}

export interface Activity {
  id: number;
  activity_type_id: [number, string];
  summary: string;
  note: string | false;
  date_deadline: string;
  user_id: [number, string];
  res_model: string;
  res_id: number;
  res_name: string;
  state: string;
}

/**
 * Resolve activity type from ID, XML ID, or name
 *
 * Accepts:
 * - Numeric ID (returns as-is)
 * - XML ID (e.g., 'mail.mail_activity_data_todo')
 * - Activity type name (e.g., 'To Do', 'Call')
 *
 * @param client - OdooClient instance
 * @param type - Activity type identifier
 * @returns Activity type ID
 * @throws Error if activity type cannot be resolved
 *
 * @see https://github.com/odoo/odoo/blob/17.0/addons/mail/data/mail_activity_data.xml
 */
export async function resolveActivityTypeId(
  client: OdooClient,
  type: number | string
): Promise<number> {
  // If it's already a number, return it
  if (typeof type === 'number') {
    return type;
  }

  log('Resolving activity type: %s', type);

  // Try as XML ID first (e.g., 'mail.mail_activity_data_todo')
  if (type.includes('.')) {
    try {
      const [module, name] = type.split('.');
      const xmlIdRecords = await client.call<any[]>('ir.model.data', 'search_read', [
        [
          ['module', '=', module],
          ['name', '=', name],
          ['model', '=', 'mail.activity.type'],
        ],
        { fields: ['res_id'], limit: 1 },
      ]);

      if (xmlIdRecords.length > 0) {
        log('Resolved XML ID %s to activity type ID %d', type, xmlIdRecords[0].res_id);
        return xmlIdRecords[0].res_id;
      }
    } catch (error) {
      log('Failed to resolve XML ID %s: %s', type, error);
    }
  }

  // Try as activity type name (e.g., 'To Do', 'Call')
  try {
    const activityTypes = await client.searchRead<{ id: number; name: string }>(
      'mail.activity.type',
      [['name', '=ilike', type]],
      { fields: ['id', 'name'], limit: 1 }
    );

    if (activityTypes.length > 0) {
      log('Resolved name %s to activity type ID %d', type, activityTypes[0].id);
      return activityTypes[0].id;
    }
  } catch (error) {
    log('Failed to resolve activity type name %s: %s', type, error);
  }

  throw new Error(`Unable to resolve activity type: ${type}`);
}

/**
 * Service for managing activities in Odoo
 *
 * Activities are tasks or reminders associated with records.
 * Common in CRM, projects, and other modules that track follow-ups.
 */
export class ActivityService {
  constructor(private client: OdooClient) {}

  /**
   * Schedule a new activity on a record
   *
   * @param model - Model name (e.g., 'crm.lead')
   * @param resId - Record ID
   * @param options - Activity details
   * @returns Activity ID
   *
   * @example
   * ```typescript
   * const activityId = await activityService.schedule('crm.lead', leadId, {
   *   activityTypeId: 'mail.mail_activity_data_call',
   *   summary: 'Follow up call',
   *   dateDeadline: '2024-12-31',
   *   userId: 2
   * });
   * ```
   */
  async schedule(model: string, resId: number, options: ScheduleActivityOptions): Promise<number> {
    const { activityTypeId, summary, note, dateDeadline, userId, context = {} } = options;

    log('Scheduling activity on %s/%d', model, resId);

    // Resolve activity type to numeric ID
    const resolvedTypeId = await resolveActivityTypeId(this.client, activityTypeId);

    // Get the model ID for res_model_id field
    const modelRecords = await this.client.searchRead<{ id: number }>(
      'ir.model',
      [['model', '=', model]],
      { fields: ['id'], limit: 1 }
    );

    if (modelRecords.length === 0) {
      throw new Error(`Model not found: ${model}`);
    }

    const values: Record<string, any> = {
      res_model: model,
      res_model_id: modelRecords[0].id,
      res_id: resId,
      activity_type_id: resolvedTypeId,
    };

    if (summary) values.summary = summary;
    if (note) values.note = note;
    if (dateDeadline) values.date_deadline = dateDeadline;
    if (userId) values.user_id = userId;

    const activityId = await this.client.create('mail.activity', values, context);

    log('Created activity ID %d', activityId);
    return activityId;
  }

  /**
   * Complete one or more activities with optional feedback
   *
   * Calls action_feedback on each activity, which marks it as done
   * and posts a message on the related record.
   *
   * @param activityIds - Activity IDs to complete
   * @param feedback - Optional feedback message
   * @param context - Additional context
   *
   * @see https://github.com/odoo/odoo/blob/17.0/addons/mail/models/mail_activity.py:action_feedback
   *
   * @example
   * ```typescript
   * await activityService.complete([activityId1, activityId2], 'Task completed successfully');
   * ```
   */
  async complete(
    activityIds: number[],
    feedback?: string,
    context: Record<string, any> = {}
  ): Promise<void> {
    log('Completing %d activities', activityIds.length);

    for (const activityId of activityIds) {
      const kwargs: Record<string, any> = { context };
      if (feedback) {
        kwargs.feedback = feedback;
      }

      await this.client.call('mail.activity', 'action_feedback', [[activityId]], kwargs);
      log('Completed activity ID %d', activityId);
    }
  }

  /**
   * Cancel one or more activities
   *
   * Unlinks the activities without posting feedback.
   *
   * @param activityIds - Activity IDs to cancel
   *
   * @example
   * ```typescript
   * await activityService.cancel([activityId]);
   * ```
   */
  async cancel(activityIds: number[]): Promise<void> {
    log('Canceling %d activities', activityIds.length);
    await this.client.unlink('mail.activity', activityIds);
    log('Canceled activities');
  }

  /**
   * Get activities for a record or globally
   *
   * @param model - Model name (optional, filters by model if provided)
   * @param resId - Record ID (optional, filters by record if provided)
   * @param options - Filter and pagination options
   * @returns Array of activities
   *
   * @example
   * ```typescript
   * // Get all activities for a specific record
   * const activities = await activityService.getActivities('crm.lead', leadId);
   *
   * // Get all overdue activities assigned to user
   * const overdueActivities = await activityService.getActivities(undefined, undefined, {
   *   state: 'overdue',
   *   userId: 2
   * });
   * ```
   */
  async getActivities(
    model?: string,
    resId?: number,
    options: GetActivitiesOptions = {}
  ): Promise<Activity[]> {
    const { activityTypeId, userId, state, limit = 100 } = options;

    const domain: any[] = [];

    if (model) {
      domain.push(['res_model', '=', model]);
    }
    if (resId !== undefined) {
      domain.push(['res_id', '=', resId]);
    }
    if (activityTypeId) {
      domain.push(['activity_type_id', '=', activityTypeId]);
    }
    if (userId) {
      domain.push(['user_id', '=', userId]);
    }
    if (state) {
      domain.push(['state', '=', state]);
    }

    log('Getting activities with domain: %o', domain);

    const activities = await this.client.searchRead<Activity>('mail.activity', domain, {
      fields: [
        'id',
        'activity_type_id',
        'summary',
        'note',
        'date_deadline',
        'user_id',
        'res_model',
        'res_id',
        'res_name',
        'state',
      ],
      limit,
    });

    log('Retrieved %d activities', activities.length);
    return activities;
  }
}
