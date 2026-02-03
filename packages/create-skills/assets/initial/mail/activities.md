# Activities

Working with Odoo activities (mail.activity) for task and reminder management.

> **MCP Tools**: Use `odoo_schedule_activity` to create activities, `odoo_complete_activity` to mark done or cancel, and `odoo_get_activities` to list activities by model, record, or user.

## Overview

Activities are tasks, reminders, or scheduled actions on records. Any model inheriting from `mail.activity.mixin` can have activities. This provides a unified way to track to-dos, calls, meetings, and other actions across the system.

## Prerequisites

- Authenticated OdooClient connection
- Target model must inherit from `mail.activity.mixin`
- Module: **mail** (base module)

## Key Models

| Model | Description |
|-------|-------------|
| `mail.activity` | Activity instances on records |
| `mail.activity.type` | Activity type definitions (Call, Meeting, To-Do, etc.) |

## Activity Types

### Listing Available Types

```typescript testable id="activities-list-types" needs="client" expect="result.count > 0"
// Get available activity types
const activityTypes = await client.searchRead('mail.activity.type', [], {
  fields: ['id', 'name', 'category', 'delay_count', 'delay_unit', 'icon'],
  order: 'sequence asc'
});

activityTypes.forEach(at => {
  console.log(`[${at.id}] ${at.name} (${at.category || 'default'})`);
});

return { count: activityTypes.length, types: activityTypes.map(t => t.name) };
```

### Common Activity Type XML IDs

| XML ID | Type |
|--------|------|
| `mail.mail_activity_data_email` | Email |
| `mail.mail_activity_data_call` | Call |
| `mail.mail_activity_data_meeting` | Meeting |
| `mail.mail_activity_data_todo` | To-Do |
| `mail.mail_activity_data_upload_document` | Upload Document |

*Note: Actual IDs may vary by Odoo instance. Always use XML IDs or query `mail.activity.type` to get values.*

## Creating Activities

### Using activity_schedule (Recommended)

The `activity_schedule` method is the simplest way to create activities.

```typescript testable id="activities-schedule" needs="client" creates="res.partner,mail.activity" expect="result.activityId > 0"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Schedule Activity Partner'),
});
trackRecord('res.partner', partnerId);

// Calculate deadline 3 days from now
const deadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

// Schedule activity using the model method
const activityId = await client.call('res.partner', 'activity_schedule', [[partnerId]], {
  act_type_xmlid: 'mail.mail_activity_data_todo',  // XML ID for To-Do
  summary: 'Review contact information',
  note: '<p>Verify email and phone are up to date</p>',
  date_deadline: deadline,
});

trackRecord('mail.activity', activityId);
return { activityId };
```

### Direct Creation

For more control, create activities directly on `mail.activity`.

```typescript testable id="activities-create-direct" needs="client" creates="res.partner,mail.activity" expect="result.activityId > 0"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Direct Activity Partner'),
});
trackRecord('res.partner', partnerId);

// Get the model ID for res.partner
const [modelInfo] = await client.searchRead('ir.model', [
  ['model', '=', 'res.partner']
], { fields: ['id'], limit: 1 });

// Find To-Do activity type
const [todoType] = await client.searchRead('mail.activity.type', [
  ['name', 'ilike', 'To-Do']
], { fields: ['id'], limit: 1 });

const activityTypeId = todoType?.id || 4;  // Fallback to common ID

// Calculate deadline
const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

// Create activity directly
const activityId = await client.create('mail.activity', {
  res_model_id: modelInfo.id,
  res_id: partnerId,
  activity_type_id: activityTypeId,
  summary: 'Follow up on partnership',
  note: '<p>Discuss collaboration opportunities</p>',
  date_deadline: deadline,
});

trackRecord('mail.activity', activityId);
return { activityId };
```

### Activity with Specific Assignee

```typescript testable id="activities-with-assignee" needs="client" creates="res.partner,mail.activity" expect="result.activityId > 0"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Assigned Activity Partner'),
});
trackRecord('res.partner', partnerId);

// Get current user ID from session
const session = client.getSession();
const userId = session?.uid;

const deadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

// Schedule activity assigned to specific user
const activityId = await client.call('res.partner', 'activity_schedule', [[partnerId]], {
  act_type_xmlid: 'mail.mail_activity_data_call',
  summary: 'Customer call',
  note: '<p>Discuss upcoming project requirements</p>',
  user_id: userId,  // Assign to specific user
  date_deadline: deadline,
});

trackRecord('mail.activity', activityId);
return { activityId };
```

## Reading Activities

### From a Specific Record

```typescript testable id="activities-read-record" needs="client" creates="res.partner" expect="result.success === true"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Read Activities Partner'),
});
trackRecord('res.partner', partnerId);

// Read activity-related fields from the record
const [partner] = await client.read('res.partner', [partnerId], [
  'activity_ids',           // List of activity IDs
  'activity_state',         // 'overdue', 'today', 'planned', or false
  'activity_date_deadline', // Next deadline
  'activity_summary',       // Next activity summary
  'activity_type_id',       // Next activity type [id, name]
]);

return {
  success: true,
  activityCount: partner.activity_ids?.length || 0,
  state: partner.activity_state || 'none',
  nextDeadline: partner.activity_date_deadline
};
```

### Search Activities Directly

```typescript testable id="activities-search" needs="client" creates="res.partner,mail.activity" expect="result.found === true"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Search Activities Partner'),
});
trackRecord('res.partner', partnerId);

// Create an activity first
const deadline = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const activityId = await client.call('res.partner', 'activity_schedule', [[partnerId]], {
  act_type_xmlid: 'mail.mail_activity_data_todo',
  summary: 'Test activity for search',
  date_deadline: deadline,
});
trackRecord('mail.activity', activityId);

// Search activities on this record
const activities = await client.searchRead('mail.activity', [
  ['res_model', '=', 'res.partner'],
  ['res_id', '=', partnerId]
], {
  fields: ['summary', 'note', 'date_deadline', 'activity_type_id', 'user_id', 'state'],
  order: 'date_deadline asc'
});

return { found: activities.length > 0, activities };
```

## Activity States

| State | Description |
|-------|-------------|
| `overdue` | Past deadline |
| `today` | Due today |
| `planned` | Future deadline |

### Finding Overdue Activities

```typescript
// Get all overdue activities for current user
const session = client.getSession();
const today = new Date().toISOString().split('T')[0];

const overdueActivities = await client.searchRead('mail.activity', [
  ['user_id', '=', session?.uid],
  ['date_deadline', '<', today]
], {
  fields: ['res_model', 'res_id', 'summary', 'date_deadline', 'activity_type_id'],
  order: 'date_deadline asc'
});

console.log(`Found ${overdueActivities.length} overdue activities`);
```

## Completing Activities

### Mark as Done

```typescript testable id="activities-complete" needs="client" creates="res.partner,mail.activity" expect="result.completed === true"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Complete Activity Partner'),
});
trackRecord('res.partner', partnerId);

// Create an activity
const deadline = new Date().toISOString().split('T')[0];  // Today
const activityId = await client.call('res.partner', 'activity_schedule', [[partnerId]], {
  act_type_xmlid: 'mail.mail_activity_data_todo',
  summary: 'Test activity to complete',
  date_deadline: deadline,
});
// Don't track - we're going to complete it

// Mark activity as done with optional feedback
await client.call('mail.activity', 'action_feedback', [[activityId]], {
  feedback: 'Task completed successfully!',
});

// Verify activity is gone
const remaining = await client.search('mail.activity', [['id', '=', activityId]]);

return { completed: remaining.length === 0 };
```

### Complete and Schedule Next

Chain activities together by completing one and scheduling a follow-up.

```typescript testable id="activities-complete-schedule-next" needs="client" creates="res.partner,mail.activity" expect="result.nextScheduled === true"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Chain Activity Partner'),
});
trackRecord('res.partner', partnerId);

// Create initial activity
const deadline = new Date().toISOString().split('T')[0];
const activityId = await client.call('res.partner', 'activity_schedule', [[partnerId]], {
  act_type_xmlid: 'mail.mail_activity_data_call',
  summary: 'Initial call',
  date_deadline: deadline,
});

// Calculate next deadline
const nextDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

// Complete and schedule follow-up
await client.call('mail.activity', 'action_feedback_schedule_next', [[activityId]], {
  feedback: 'Initial call completed, scheduling follow-up meeting',
});

// Manually create the next activity since action_feedback_schedule_next behavior varies
const nextActivityId = await client.call('res.partner', 'activity_schedule', [[partnerId]], {
  act_type_xmlid: 'mail.mail_activity_data_meeting',
  summary: 'Follow-up meeting',
  date_deadline: nextDeadline,
});
trackRecord('mail.activity', nextActivityId);

// Verify new activity exists
const activities = await client.search('mail.activity', [
  ['res_model', '=', 'res.partner'],
  ['res_id', '=', partnerId]
]);

return { nextScheduled: activities.length > 0 };
```

### Cancel Activity

Delete an activity without completing it.

```typescript testable id="activities-cancel" needs="client" creates="res.partner" expect="result.canceled === true"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Cancel Activity Partner'),
});
trackRecord('res.partner', partnerId);

// Create an activity
const deadline = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const activityId = await client.call('res.partner', 'activity_schedule', [[partnerId]], {
  act_type_xmlid: 'mail.mail_activity_data_todo',
  summary: 'Activity to cancel',
  date_deadline: deadline,
});
// Don't track - we're going to delete it

// Cancel by deleting
await client.unlink('mail.activity', activityId);

// Verify deletion
const remaining = await client.search('mail.activity', [['id', '=', activityId]]);

return { canceled: remaining.length === 0 };
```

## Batch Operations

### Complete Multiple Activities

```typescript
// Get all overdue activities for current user
const session = client.getSession();
const today = new Date().toISOString().split('T')[0];

const overdueActivities = await client.searchRead('mail.activity', [
  ['user_id', '=', session?.uid],
  ['date_deadline', '<', today]
], { fields: ['id'] });

const activityIds = overdueActivities.map(a => a.id);

if (activityIds.length > 0) {
  // Complete all at once
  await client.call('mail.activity', 'action_feedback', [activityIds], {
    feedback: 'Bulk completed - clearing overdue items',
  });

  console.log(`Completed ${activityIds.length} overdue activities`);
}
```

### Reassign Activities

```typescript
// Find activities assigned to one user
const oldUserId = 10;
const newUserId = 15;

const activities = await client.search('mail.activity', [
  ['user_id', '=', oldUserId]
]);

if (activities.length > 0) {
  // Reassign to new user
  await client.write('mail.activity', activities, {
    user_id: newUserId,
  });

  console.log(`Reassigned ${activities.length} activities`);
}
```

## Activity Fields Reference

| Field | Type | Description |
|-------|------|-------------|
| `res_model_id` | Many2One | Target model (ir.model) |
| `res_model` | Char | Model name (computed) |
| `res_id` | Integer | Target record ID |
| `activity_type_id` | Many2One | Activity type (mail.activity.type) |
| `summary` | Char | Short summary/title |
| `note` | Html | Detailed description |
| `date_deadline` | Date | Due date (YYYY-MM-DD) |
| `user_id` | Many2One | Assigned user (res.users) |
| `state` | Selection | overdue, today, or planned (computed) |
| `create_uid` | Many2One | Creator |
| `create_date` | Datetime | Creation time |

## Related Documents

- [chatter.md](./chatter.md) - Chatter messages
- [discuss.md](./discuss.md) - Chat channels
- [search.md](../base/search.md) - Search patterns
- [crud.md](../base/crud.md) - CRUD operations
