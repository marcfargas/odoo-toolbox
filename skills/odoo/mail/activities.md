# Activities

Tasks, reminders, and scheduled actions on Odoo records. Any model with `mail.activity.mixin` supports activities.

Models: `mail.activity` (instances), `mail.activity.type` (definitions).

## Activity Type XML IDs

| XML ID | Type |
|--------|------|
| `mail.mail_activity_data_email` | Email |
| `mail.mail_activity_data_call` | Call |
| `mail.mail_activity_data_meeting` | Meeting |
| `mail.mail_activity_data_todo` | To-Do |
| `mail.mail_activity_data_upload_document` | Upload Document |

```typescript testable id="activities-list-types" needs="client" expect="result.count > 0"
const activityTypes = await client.searchRead('mail.activity.type', [], {
  fields: ['id', 'name', 'category', 'delay_count', 'delay_unit', 'icon'],
  order: 'sequence asc'
});

activityTypes.forEach(at => {
  console.log(`[${at.id}] ${at.name} (${at.category || 'default'})`);
});

return { count: activityTypes.length, types: activityTypes.map(t => t.name) };
```

## Schedule an Activity

**Safety: WRITE** — creates activity, may trigger notifications.

```typescript testable id="activities-schedule" needs="client" creates="res.partner,mail.activity" expect="result.activityId > 0"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Schedule Activity Partner'),
});
trackRecord('res.partner', partnerId);

const deadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

const activityId = await client.call('res.partner', 'activity_schedule', [[partnerId]], {
  act_type_xmlid: 'mail.mail_activity_data_todo',
  summary: 'Review contact information',
  note: '<p>Verify email and phone are up to date</p>',
  date_deadline: deadline,
});

trackRecord('mail.activity', activityId);
return { activityId };
```

### Direct Creation

Use when you need more control (e.g., setting `res_model_id` directly):

```typescript testable id="activities-create-direct" needs="client" creates="res.partner,mail.activity" expect="result.activityId > 0"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Direct Activity Partner'),
});
trackRecord('res.partner', partnerId);

// ⚠️ res_model_id is an ir.model ID, not the model name string
const [modelInfo] = await client.searchRead('ir.model', [
  ['model', '=', 'res.partner']
], { fields: ['id'], limit: 1 });

const [todoType] = await client.searchRead('mail.activity.type', [
  ['name', 'ilike', 'To-Do']
], { fields: ['id'], limit: 1 });

const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

const activityId = await client.create('mail.activity', {
  res_model_id: modelInfo.id,
  res_id: partnerId,
  activity_type_id: todoType?.id || 4,
  summary: 'Follow up on partnership',
  note: '<p>Discuss collaboration opportunities</p>',
  date_deadline: deadline,
});

trackRecord('mail.activity', activityId);
return { activityId };
```

### Assign to Specific User

```typescript testable id="activities-with-assignee" needs="client" creates="res.partner,mail.activity" expect="result.activityId > 0"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Assigned Activity Partner'),
});
trackRecord('res.partner', partnerId);

const session = client.getSession();
const deadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

const activityId = await client.call('res.partner', 'activity_schedule', [[partnerId]], {
  act_type_xmlid: 'mail.mail_activity_data_call',
  summary: 'Customer call',
  note: '<p>Discuss upcoming project requirements</p>',
  user_id: session?.uid,
  date_deadline: deadline,
});

trackRecord('mail.activity', activityId);
return { activityId };
```

## Reading Activities

### From a Record

```typescript testable id="activities-read-record" needs="client" creates="res.partner" expect="result.success === true"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Read Activities Partner'),
});
trackRecord('res.partner', partnerId);

const [partner] = await client.read('res.partner', [partnerId], [
  'activity_ids',           // Activity IDs on this record
  'activity_state',         // 'overdue' | 'today' | 'planned' | false
  'activity_date_deadline', // Next deadline
  'activity_summary',       // Next activity summary
]);

return {
  success: true,
  activityCount: partner.activity_ids?.length || 0,
  state: partner.activity_state || 'none',
};
```

### Search Activities

```typescript testable id="activities-search" needs="client" creates="res.partner,mail.activity" expect="result.found === true"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Search Activities Partner'),
});
trackRecord('res.partner', partnerId);

const deadline = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const activityId = await client.call('res.partner', 'activity_schedule', [[partnerId]], {
  act_type_xmlid: 'mail.mail_activity_data_todo',
  summary: 'Test activity for search',
  date_deadline: deadline,
});
trackRecord('mail.activity', activityId);

const activities = await client.searchRead('mail.activity', [
  ['res_model', '=', 'res.partner'],
  ['res_id', '=', partnerId]
], {
  fields: ['summary', 'note', 'date_deadline', 'activity_type_id', 'user_id', 'state'],
  order: 'date_deadline asc'
});

return { found: activities.length > 0, activities };
```

Activity states: `overdue` (past deadline), `today` (due today), `planned` (future).

## Completing Activities

### Mark as Done

```typescript testable id="activities-complete" needs="client" creates="res.partner,mail.activity" expect="result.completed === true"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Complete Activity Partner'),
});
trackRecord('res.partner', partnerId);

const deadline = new Date().toISOString().split('T')[0];
const activityId = await client.call('res.partner', 'activity_schedule', [[partnerId]], {
  act_type_xmlid: 'mail.mail_activity_data_todo',
  summary: 'Test activity to complete',
  date_deadline: deadline,
});

await client.call('mail.activity', 'action_feedback', [[activityId]], {
  feedback: 'Task completed successfully!',
});

const remaining = await client.search('mail.activity', [['id', '=', activityId]]);

return { completed: remaining.length === 0 };
```

### Complete and Schedule Next

```typescript testable id="activities-complete-schedule-next" needs="client" creates="res.partner,mail.activity" expect="result.nextScheduled === true"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Chain Activity Partner'),
});
trackRecord('res.partner', partnerId);

const deadline = new Date().toISOString().split('T')[0];
const activityId = await client.call('res.partner', 'activity_schedule', [[partnerId]], {
  act_type_xmlid: 'mail.mail_activity_data_call',
  summary: 'Initial call',
  date_deadline: deadline,
});

await client.call('mail.activity', 'action_feedback_schedule_next', [[activityId]], {
  feedback: 'Initial call completed, scheduling follow-up meeting',
});

const nextDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const nextActivityId = await client.call('res.partner', 'activity_schedule', [[partnerId]], {
  act_type_xmlid: 'mail.mail_activity_data_meeting',
  summary: 'Follow-up meeting',
  date_deadline: nextDeadline,
});
trackRecord('mail.activity', nextActivityId);

const activities = await client.search('mail.activity', [
  ['res_model', '=', 'res.partner'],
  ['res_id', '=', partnerId]
]);

return { nextScheduled: activities.length > 0 };
```

### Cancel (Delete)

```typescript testable id="activities-cancel" needs="client" creates="res.partner" expect="result.canceled === true"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Cancel Activity Partner'),
});
trackRecord('res.partner', partnerId);

const deadline = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const activityId = await client.call('res.partner', 'activity_schedule', [[partnerId]], {
  act_type_xmlid: 'mail.mail_activity_data_todo',
  summary: 'Activity to cancel',
  date_deadline: deadline,
});

await client.unlink('mail.activity', activityId);

const remaining = await client.search('mail.activity', [['id', '=', activityId]]);

return { canceled: remaining.length === 0 };
```

## Key Fields

| Field | Type | Notes |
|-------|------|-------|
| `res_model_id` | Many2One | **ir.model ID, not model name string** |
| `res_id` | Integer | Target record ID |
| `activity_type_id` | Many2One | Activity type |
| `summary` | Char | Short title |
| `note` | Html | Description |
| `date_deadline` | Date | Due date (YYYY-MM-DD) |
| `user_id` | Many2One | Assigned user |
| `state` | Selection | `overdue` / `today` / `planned` (computed) |

## Verification Patterns

After scheduling an activity, confirm it appears in `mail.activity` before proceeding.

### Schedule → Verify Exists

```typescript testable id="activities-verify-scheduled" needs="client" creates="res.partner,mail.activity" expect="result.found === true && result.summaryMatches === true"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Verify Activity Partner'),
});
trackRecord('res.partner', partnerId);

const deadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

await client.call('res.partner', 'activity_schedule', [[partnerId]], {
  act_type_xmlid: 'mail.mail_activity_data_todo',
  summary: 'Verification call',
  note: '<p>Confirm this activity was scheduled</p>',
  date_deadline: deadline,
});

const activities = await client.searchRead('mail.activity', [
  ['res_model', '=', 'res.partner'],
  ['res_id', '=', partnerId],
], {
  fields: ['summary', 'date_deadline', 'state', 'activity_type_id'],
  limit: 5,
});

return {
  found: activities.length > 0,
  summaryMatches: activities[0]?.summary === 'Verification call',
  state: activities[0]?.state,
};
```

### Verify via Record's activity_state Field

```typescript testable id="activities-verify-state" needs="client" creates="res.partner,mail.activity" expect="result.hasActivity === true"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Activity State Partner'),
});
trackRecord('res.partner', partnerId);

const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

const activityId = await client.call('res.partner', 'activity_schedule', [[partnerId]], {
  act_type_xmlid: 'mail.mail_activity_data_call',
  summary: 'State check call',
  date_deadline: deadline,
});
trackRecord('mail.activity', activityId);

// Read the record's computed activity summary fields
const [partner] = await client.read('res.partner', [partnerId], [
  'activity_ids',
  'activity_state',
  'activity_summary',
  'activity_date_deadline',
]);

return {
  hasActivity: partner.activity_ids.length > 0,
  state: partner.activity_state,
  nextDeadline: partner.activity_date_deadline,
};
```
