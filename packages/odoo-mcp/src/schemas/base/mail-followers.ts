/**
 * Base schema for mail.followers - Odoo record followers.
 *
 * This model stores subscriptions to records - who gets notified
 * about changes and messages on a record.
 *
 * @see https://github.com/odoo/odoo/blob/17.0/addons/mail/models/mail_followers.py
 */

import type { BaseModelSchema } from './types.js';

export const MAIL_FOLLOWERS_BASE: BaseModelSchema = {
  model: 'mail.followers',
  description:
    'Odoo record followers - subscriptions to records. Followers receive notifications about changes and messages.',
  fields: {
    id: {
      type: 'integer',
      description: 'Unique follower subscription identifier',
    },
    res_model: {
      type: 'string',
      description: 'Technical model name being followed (e.g., "sale.order")',
    },
    res_id: {
      type: 'integer',
      description: 'Record ID being followed',
    },
    partner_id: {
      type: ['array', 'null'],
      description: 'Following partner [id, name]',
      relation: 'res.partner',
    },
    subtype_ids: {
      type: 'array',
      items: { type: 'integer' },
      description: 'Subscribed message subtypes (controls which notifications they receive)',
      relation: 'mail.message.subtype',
    },
    name: {
      type: ['string', 'null'],
      description: 'Follower name (computed from partner)',
      readOnly: true,
    },
    email: {
      type: ['string', 'null'],
      description: 'Follower email (computed from partner)',
      readOnly: true,
    },
    is_active: {
      type: 'boolean',
      description: 'Whether the follower subscription is active',
      readOnly: true,
    },
  },
  required: ['id', 'res_model', 'res_id', 'partner_id'],
};
