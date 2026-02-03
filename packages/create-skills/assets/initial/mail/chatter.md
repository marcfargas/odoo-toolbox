# Chatter & Messages

Working with the Odoo chatter (mail.thread) system for posting messages and notes on records.

## Overview

The Odoo chatter system allows posting messages, notes, and tracking changes on any model that inherits from `mail.thread`. This includes most business documents like CRM leads, sales orders, invoices, partners, etc.

## Prerequisites

- Authenticated OdooClient connection
- Target model must inherit from `mail.thread` mixin
- Module: **mail** (base module, typically always installed)

## Key Models

| Model | Description |
|-------|-------------|
| `mail.message` | Stores all messages and notifications |
| `mail.followers` | Tracks who follows a record |
| `mail.tracking.value` | Stores field value changes |

## Message Types

| message_type | subtype_xmlid | Description |
|--------------|---------------|-------------|
| `comment` | `mail.mt_note` | Internal note (private to internal users) |
| `comment` | `mail.mt_comment` | Message sent to followers (emails) |
| `notification` | - | System notification |
| `email` | - | Incoming email |
| `user_notification` | - | User notification |

## Checking if Model Has Chatter

```typescript testable id="chatter-check-mixin" needs="client" expect="result.hasMailThread === true"
// Check if res.partner has mail.thread mixin
const models = await client.searchRead('ir.model', [
  ['model', '=', 'res.partner']
], { fields: ['model', 'is_mail_thread'] });

const hasMailThread = models[0]?.is_mail_thread || false;
return { hasMailThread };
```

## Reading Messages from a Record

### Using mail.message Directly

```typescript testable id="chatter-read-messages" needs="client" creates="res.partner" expect="result.success === true"
// Create a test partner
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Chatter Read Test'),
});
trackRecord('res.partner', partnerId);

// Search mail.message for messages on this record
const messages = await client.searchRead('mail.message', [
  ['model', '=', 'res.partner'],
  ['res_id', '=', partnerId]
], {
  fields: ['body', 'message_type', 'subtype_id', 'date', 'author_id'],
  order: 'date desc',
  limit: 10
});

return { success: true, messageCount: messages.length };
```

### Using message_ids Field

```typescript
// Read message IDs from the record (returns IDs only)
const [partner] = await client.read('res.partner', [partnerId], ['message_ids']);
const messageIds = partner.message_ids;  // Array of message IDs

// Then read the actual messages
if (messageIds.length > 0) {
  const messages = await client.read('mail.message', messageIds, [
    'body', 'message_type', 'author_id', 'date'
  ]);
}
```

## Posting Messages

### Internal Note (Private)

Internal notes are only visible to internal users and are NOT sent to external followers.

```typescript testable id="chatter-post-note" needs="client" creates="res.partner,mail.message" expect="result.messageId > 0"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Note Test Partner'),
});
trackRecord('res.partner', partnerId);

// Post an internal note
const messageId = await client.call('res.partner', 'message_post', [[partnerId]], {
  body: '<p>This is an internal note visible only to internal users.</p>',
  message_type: 'comment',
  subtype_xmlid: 'mail.mt_note',  // Internal note subtype
});

trackRecord('mail.message', messageId);
return { messageId };
```

### External Message (Email to Followers)

External messages are sent as emails to all followers of the record.

```typescript testable id="chatter-post-message" needs="client" creates="res.partner,mail.message" expect="result.messageId > 0"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Message Test Partner'),
  email: 'test@example.com',
});
trackRecord('res.partner', partnerId);

// Post a message that will be emailed to followers
const messageId = await client.call('res.partner', 'message_post', [[partnerId]], {
  body: '<p>This message will be sent to all followers.</p>',
  message_type: 'comment',
  subtype_xmlid: 'mail.mt_comment',  // External comment subtype
});

trackRecord('mail.message', messageId);
return { messageId };
```

## Posting with Attachments

### Inline Attachments (New Files)

Pass files directly with the message as base64 encoded content.

```typescript testable id="chatter-post-attachment" needs="client" creates="res.partner,mail.message" expect="result.messageId > 0"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Attachment Test Partner'),
});
trackRecord('res.partner', partnerId);

// Create a simple text file as base64
const fileContent = Buffer.from('Hello World - Test Document').toString('base64');

// Post with inline attachment
const messageId = await client.call('res.partner', 'message_post', [[partnerId]], {
  body: '<p>Message with attachment</p>',
  message_type: 'comment',
  subtype_xmlid: 'mail.mt_note',
  attachments: [
    ['document.txt', fileContent]  // [filename, base64_content]
  ],
});

trackRecord('mail.message', messageId);
return { messageId };
```

### Using Existing Attachments

First create the attachment, then reference it in the message.

```typescript testable id="chatter-existing-attachment" needs="client" creates="res.partner,ir.attachment,mail.message" expect="result.messageId > 0"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Existing Attachment Partner'),
});
trackRecord('res.partner', partnerId);

// Create attachment first
const fileContent = Buffer.from('PDF content here').toString('base64');
const attachmentId = await client.create('ir.attachment', {
  name: 'report.pdf',
  datas: fileContent,
  res_model: 'res.partner',
  res_id: partnerId,
});
trackRecord('ir.attachment', attachmentId);

// Post message with existing attachment
const messageId = await client.call('res.partner', 'message_post', [[partnerId]], {
  body: '<p>Message with existing attachment</p>',
  message_type: 'comment',
  subtype_xmlid: 'mail.mt_note',
  attachment_ids: [attachmentId],
});

trackRecord('mail.message', messageId);
return { messageId };
```

## Context Variables for Mail Control

Use context variables to control mail behavior during CRUD operations.

### Disabling Mail on Create

```typescript testable id="chatter-context-disable" needs="client" creates="res.partner" expect="result.created === true"
// Create record without auto-subscribe and logging
const partnerId = await client.call('res.partner', 'create', [{
  name: uniqueTestName('No Mail Partner'),
}], {
  context: {
    tracking_disable: true,        // Disable field change tracking
    mail_create_nosubscribe: true, // Don't auto-subscribe creator
    mail_create_nolog: true,       // Don't log creation message
  }
});

trackRecord('res.partner', partnerId);
return { created: partnerId > 0 };
```

### Context Variables Reference

| Context Variable | Effect |
|------------------|--------|
| `tracking_disable=True` | Disable automatic field tracking messages |
| `mail_create_nosubscribe=True` | Don't auto-subscribe record creator |
| `mail_create_nolog=True` | Don't create creation log message |
| `mail_notrack=True` | Disable all tracking for this operation |
| `mail_post_autofollow=False` | Don't auto-follow when posting |
| `mail_activity_quick_update=True` | Lightweight activity updates |

### Update with Manual Note

When updating a record and wanting to log a note about the change:

```typescript testable id="chatter-update-with-note" needs="client" creates="res.partner,mail.message" expect="result.notePosted === true"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Update Note Partner'),
  phone: '555-0000',
});
trackRecord('res.partner', partnerId);

// Update the record
await client.write('res.partner', partnerId, {
  phone: '555-1234',
});

// Post a note about what changed
const messageId = await client.call('res.partner', 'message_post', [[partnerId]], {
  body: '<p>Updated phone number from 555-0000 to 555-1234.</p>',
  message_type: 'comment',
  subtype_xmlid: 'mail.mt_note',
});

trackRecord('mail.message', messageId);
return { notePosted: messageId > 0 };
```

## Managing Followers

### Get Current Followers

```typescript testable id="chatter-get-followers" needs="client" creates="res.partner" expect="result.success === true"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Followers Test Partner'),
});
trackRecord('res.partner', partnerId);

// Get current followers
const followers = await client.searchRead('mail.followers', [
  ['res_model', '=', 'res.partner'],
  ['res_id', '=', partnerId]
], { fields: ['partner_id', 'subtype_ids'] });

return { success: true, followerCount: followers.length };
```

### Add a Follower

```typescript testable id="chatter-add-follower" needs="client" creates="res.partner" expect="result.subscribed === true"
// Create a partner to follow and another to be the follower
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Record To Follow'),
});
trackRecord('res.partner', partnerId);

const followerId = await client.create('res.partner', {
  name: uniqueTestName('Follower Partner'),
  email: 'follower@example.com',
});
trackRecord('res.partner', followerId);

// Subscribe the follower to the record
await client.call('res.partner', 'message_subscribe', [[partnerId]], {
  partner_ids: [followerId],
});

// Verify
const followers = await client.searchRead('mail.followers', [
  ['res_model', '=', 'res.partner'],
  ['res_id', '=', partnerId],
  ['partner_id', '=', followerId]
], { fields: ['id'] });

return { subscribed: followers.length > 0 };
```

### Remove a Follower

```typescript
// Unsubscribe a partner from the record
await client.call('res.partner', 'message_unsubscribe', [[recordId]], {
  partner_ids: [partnerId],
});
```

## Reading Message Details

### Full Message Fields

```typescript
const messages = await client.searchRead('mail.message', [
  ['model', '=', 'res.partner'],
  ['res_id', '=', partnerId]
], {
  fields: [
    'body',              // HTML content
    'message_type',      // comment, notification, email, etc.
    'subtype_id',        // [id, name] of message subtype
    'author_id',         // [id, name] of author
    'date',              // Datetime string
    'attachment_ids',    // Array of attachment IDs
    'partner_ids',       // Recipients
    'starred',           // Boolean - starred by current user
    'tracking_value_ids' // Field change tracking values
  ],
  order: 'date desc'
});
```

### Reading Tracking Values

When a record has tracked fields, changes are recorded:

```typescript
// Get messages with tracking info
const messages = await client.searchRead('mail.message', [
  ['model', '=', 'crm.lead'],
  ['res_id', '=', leadId],
  ['tracking_value_ids', '!=', false]
], {
  fields: ['body', 'tracking_value_ids', 'date']
});

// For each message, read the tracking values
for (const msg of messages) {
  if (msg.tracking_value_ids.length > 0) {
    const trackingValues = await client.read('mail.tracking.value', msg.tracking_value_ids, [
      'field_id', 'old_value_char', 'new_value_char',
      'old_value_integer', 'new_value_integer'
    ]);
    console.log('Field changes:', trackingValues);
  }
}
```

## Related Documents

- [activities.md](./activities.md) - Activity management
- [discuss.md](./discuss.md) - Chat channels
- [crud.md](../base/crud.md) - CRUD operations
- [field-types.md](../base/field-types.md) - Field type behaviors
