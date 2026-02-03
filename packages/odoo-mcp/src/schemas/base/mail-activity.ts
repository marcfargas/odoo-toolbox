/**
 * Base schema for mail.activity - Odoo scheduled activities.
 *
 * This model stores scheduled activities (to-dos, calls, meetings)
 * linked to records via the chatter system.
 *
 * @see https://github.com/odoo/odoo/blob/17.0/addons/mail/models/mail_activity.py
 */

import type { BaseModelSchema } from './types.js';

export const MAIL_ACTIVITY_BASE: BaseModelSchema = {
  model: 'mail.activity',
  description:
    "Odoo scheduled activities - to-dos, calls, meetings linked to records. Displayed in record's activity panel.",
  fields: {
    id: {
      type: 'integer',
      description: 'Unique activity identifier',
    },
    summary: {
      type: ['string', 'null'],
      description: 'Short activity title/summary',
    },
    note: {
      type: ['string', 'null'],
      description: 'Activity description/details (HTML format)',
      format: 'html',
    },
    activity_type_id: {
      type: ['array', 'null'],
      description: 'Activity type [id, name] (e.g., "To Do", "Call", "Meeting")',
      relation: 'mail.activity.type',
    },
    date_deadline: {
      type: 'string',
      format: 'date',
      description: 'Due date for the activity',
    },
    res_model: {
      type: 'string',
      description: 'Technical model name the activity is linked to (e.g., "sale.order")',
    },
    res_model_id: {
      type: ['array', 'null'],
      description: 'Model reference [id, name]',
      relation: 'ir.model',
    },
    res_id: {
      type: 'integer',
      description: 'Record ID the activity is linked to',
    },
    res_name: {
      type: ['string', 'null'],
      description: 'Display name of the linked record (computed)',
      readOnly: true,
    },
    user_id: {
      type: ['array', 'null'],
      description: 'User assigned to this activity [id, name]',
      relation: 'res.users',
    },
    create_user_id: {
      type: ['array', 'null'],
      description: 'User who created this activity [id, name]',
      relation: 'res.users',
      readOnly: true,
    },
    state: {
      type: 'string',
      description: 'Activity state based on deadline vs today',
      enum: ['overdue', 'today', 'planned'],
      readOnly: true,
    },
    recommended_activity_type_id: {
      type: ['array', 'null'],
      description: 'Suggested next activity type [id, name]',
      relation: 'mail.activity.type',
    },
    previous_activity_type_id: {
      type: ['array', 'null'],
      description: 'Previous activity type that triggered this one [id, name]',
      relation: 'mail.activity.type',
    },
    chaining_type: {
      type: 'string',
      description: 'How to handle chained/suggested activities',
      enum: ['suggest', 'trigger'],
    },
    can_write: {
      type: 'boolean',
      description: 'Whether current user can modify this activity',
      readOnly: true,
    },
  },
  required: ['id', 'activity_type_id', 'date_deadline', 'res_model', 'res_id', 'user_id'],
};
