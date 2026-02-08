# Chatter & Messages

Working with the Odoo chatter (mail.thread) system for posting messages and notes on records.

## Overview

The Odoo chatter system allows posting messages, notes, and tracking changes on any model that inherits from `mail.thread`. This includes most business documents like leads, sales orders, invoices, partners, etc.

## Prerequisites

- Authenticated OdooClient connection
- Target model must inherit from `mail.thread` mixin
- Module: **mail** (base module, typically always installed)

## Key Models

| Model | Description |
|-------|-------------|
| `mail.message` | Stores all messages and notifications |
| `mail.message.subtype` | Defines message categories (comment, note, etc.) |
| `mail.followers` | Tracks who follows a record |
| `mail.tracking.value` | Stores field value changes |

## Message Subtypes

| Subtype XML ID | ID | Name | Internal | Description |
|----------------|-----|------|----------|-------------|
| `mail.mt_comment` | 1 | Discussions | false | Public message visible to followers |
| `mail.mt_note` | 2 | Note | true | Internal note for staff only |
| `mail.mt_activities` | 3 | Activities | true | Activity-related notifications |

## Message Types

| message_type | Description |
|--------------|-------------|
| `comment` | User comment (internal note or public message) |
| `notification` | System notification |
| `email` | Incoming email |
| `email_outgoing` | Outgoing email |
| `user_notification` | User-specific notification |

## Posting Messages

### Direct mail.message Create (Recommended)

Use direct `mail.message` create for reliable message posting. This approach ensures HTML is preserved and all fields are set correctly.

**Note**: The `message_post` method exists but has RPC compatibility issues with external clients. Direct `mail.message` create is the recommended approach.

### Post a Public Message

Public messages use `subtype_id: 1` (Discussions) and are visible to followers.

```typescript testable id="chatter-post-public" needs="client" creates="res.partner,mail.message" expect="result.isPublic === true"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Public Message Test'),
});
trackRecord('res.partner', partnerId);

// Post a public message (visible to followers)
const messageId = await client.create('mail.message', {
  model: 'res.partner',
  res_id: partnerId,
  body: '<p>This is a <b>public message</b> visible to followers.</p>',
  message_type: 'comment',
  subtype_id: 1,  // Discussions subtype (public)
});
trackRecord('mail.message', messageId);

// Verify the message
const [msg] = await client.read('mail.message', messageId, ['body', 'is_internal', 'subtype_id']);
return {
  messageId,
  isPublic: msg.is_internal === false,
  bodyPreserved: msg.body.includes('<b>public message</b>')
};
```

### Post an Internal Note

Internal notes use `subtype_id: 2` (Note) AND `is_internal: true`. Both are required for proper internal visibility.

```typescript testable id="chatter-post-note" needs="client" creates="res.partner,mail.message" expect="result.isInternal === true"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Internal Note Test'),
});
trackRecord('res.partner', partnerId);

// Post an internal note (staff only)
const messageId = await client.create('mail.message', {
  model: 'res.partner',
  res_id: partnerId,
  body: '<p>This is an <em>internal note</em> visible only to staff.</p>',
  message_type: 'comment',
  subtype_id: 2,      // Note subtype
  is_internal: true,  // Required for internal visibility
});
trackRecord('mail.message', messageId);

// Verify the message
const [msg] = await client.read('mail.message', messageId, ['body', 'is_internal', 'subtype_id']);
return {
  messageId,
  isInternal: msg.is_internal === true,
  subtypeName: msg.subtype_id[1]  // Should be "Note"
};
```

## @Mentioning Users

To mention users in a message, include their partner IDs in the `partner_ids` field. Use the Many2many write format: `[[6, 0, [id1, id2, ...]]]`.

### Finding Users to Mention

```typescript testable id="chatter-find-users" needs="client" expect="result.foundUsers > 0"
// Search for users by name (partial match)
const users = await client.searchRead('res.users', [
  ['name', 'ilike', 'admin']
], {
  fields: ['id', 'name', 'partner_id'],
  limit: 5
});

// The partner_id is what you need for @mentions
const mentionableUsers = users.map(u => ({
  userId: u.id,
  name: u.name,
  partnerId: u.partner_id[0]  // Use this for partner_ids
}));

return { foundUsers: mentionableUsers.length, users: mentionableUsers };
```

### Post Message with @Mention

```typescript testable id="chatter-post-mention" needs="client" creates="res.partner,mail.message" expect="result.hasMentions === true"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Mention Test'),
});
trackRecord('res.partner', partnerId);

// Get admin user's partner ID for mention
const [adminUser] = await client.searchRead('res.users', [
  ['login', '=', 'admin']
], { fields: ['partner_id'], limit: 1 });
const adminPartnerId = adminUser.partner_id[0];

// Post message with @mention
const messageId = await client.create('mail.message', {
  model: 'res.partner',
  res_id: partnerId,
  body: '<p>Please review this record.</p>',
  message_type: 'comment',
  subtype_id: 1,  // Public message
  partner_ids: [[6, 0, [adminPartnerId]]],  // Many2many write format
});
trackRecord('mail.message', messageId);

// Verify mentions
const [msg] = await client.read('mail.message', messageId, ['partner_ids']);
return {
  messageId,
  hasMentions: msg.partner_ids.length > 0,
  mentionedPartners: msg.partner_ids
};
```

## HTML Formatting

The `body` field is an HTML field. Odoo processes HTML and may modify certain elements for security or consistency.

### HTML Behavior Summary

| Element | Behavior |
|---------|----------|
| `<b>`, `<em>`, `<u>`, `<i>` | **Preserved** - Basic formatting |
| `<a href="...">` | **Preserved** - Links work |
| `<ul>`, `<ol>`, `<li>` | **Preserved** - Lists |
| `<table>`, `<tr>`, `<td>` | **Preserved** - Tables |
| `<h1>`-`<h6>` | **Preserved** - Headings |
| `<pre>`, `<code>` | **Preserved** - Code blocks |
| `<span class="...">` | **Preserved** - Spans with classes |
| `style="..."` | **Preserved** - Inline styles |
| `<br/>` | **Normalized** - Converted to `<br>` |
| `<div>` | **Stripped** - Content extracted, tag removed |
| `<script>` | **Stripped** - Security: completely removed |
| `<img src="data:...">` | **Converted** - Data URLs become Odoo attachments |

### Supported HTML Elements

```typescript testable id="chatter-html-formatting" needs="client" creates="res.partner,mail.message" expect="result.htmlPreserved === true"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('HTML Formatting Test'),
});
trackRecord('res.partner', partnerId);

// Post message with various HTML formatting
const htmlBody = `
<p>This message demonstrates HTML support:</p>
<ul>
  <li><b>Bold text</b></li>
  <li><em>Italic text</em></li>
  <li><u>Underlined text</u></li>
  <li><a href="https://example.com">Links</a></li>
</ul>
<p>Line breaks<br/>are preserved.</p>
`;

const messageId = await client.create('mail.message', {
  model: 'res.partner',
  res_id: partnerId,
  body: htmlBody,
  message_type: 'comment',
  subtype_id: 1,
});
trackRecord('mail.message', messageId);

// Verify HTML is preserved
const [msg] = await client.read('mail.message', messageId, ['body']);
return {
  messageId,
  htmlPreserved: msg.body.includes('<b>Bold text</b>') && msg.body.includes('<em>Italic text</em>')
};
```

## Reading Messages from a Record

### Search Messages by Model and Record

```typescript testable id="chatter-read-messages" needs="client" creates="res.partner,mail.message" expect="result.messageCount >= 1"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Read Messages Test'),
});
trackRecord('res.partner', partnerId);

// Create a test message
const messageId = await client.create('mail.message', {
  model: 'res.partner',
  res_id: partnerId,
  body: '<p>Test message for reading</p>',
  message_type: 'comment',
  subtype_id: 1,
});
trackRecord('mail.message', messageId);

// Read all messages on the record
const messages = await client.searchRead('mail.message', [
  ['model', '=', 'res.partner'],
  ['res_id', '=', partnerId]
], {
  fields: ['body', 'message_type', 'subtype_id', 'date', 'author_id', 'is_internal'],
  order: 'date desc',
  limit: 10
});

return { messageCount: messages.length, messages };
```

### Using message_ids Field

Records with chatter have a `message_ids` field linking to their messages:

```typescript
// Read message IDs from the record
const [partner] = await client.read('res.partner', [partnerId], ['message_ids']);
const messageIds = partner.message_ids;  // Array of message IDs

// Then read the actual messages
if (messageIds.length > 0) {
  const messages = await client.read('mail.message', messageIds, [
    'body', 'message_type', 'author_id', 'date'
  ]);
}
```

## Checking if Model Has Chatter

```typescript testable id="chatter-check-mixin" needs="client" expect="result.hasMailThread === true"
// Check if res.partner has mail.thread mixin
const models = await client.searchRead('ir.model', [
  ['model', '=', 'res.partner']
], { fields: ['model', 'is_mail_thread'] });

const hasMailThread = models[0]?.is_mail_thread || false;
return { hasMailThread };
```

## Posting with Attachments

### Create Attachment First, Then Reference

```typescript testable id="chatter-attachment" needs="client" creates="res.partner,ir.attachment,mail.message" expect="result.hasAttachment === true"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Attachment Test'),
});
trackRecord('res.partner', partnerId);

// Create attachment first
const fileContent = Buffer.from('Hello World - Test Document').toString('base64');
const attachmentId = await client.create('ir.attachment', {
  name: 'test-document.txt',
  datas: fileContent,
  res_model: 'res.partner',
  res_id: partnerId,
});
trackRecord('ir.attachment', attachmentId);

// Post message with attachment reference
const messageId = await client.create('mail.message', {
  model: 'res.partner',
  res_id: partnerId,
  body: '<p>Message with attachment</p>',
  message_type: 'comment',
  subtype_id: 1,
  attachment_ids: [[6, 0, [attachmentId]]],  // Many2many write format
});
trackRecord('mail.message', messageId);

// Verify
const [msg] = await client.read('mail.message', messageId, ['attachment_ids']);
return { messageId, hasAttachment: msg.attachment_ids.length > 0 };
```

## Managing Followers

### Get Current Followers

```typescript testable id="chatter-get-followers" needs="client" creates="res.partner" expect="result.success === true"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Followers Test'),
});
trackRecord('res.partner', partnerId);

// Get current followers
const followers = await client.searchRead('mail.followers', [
  ['res_model', '=', 'res.partner'],
  ['res_id', '=', partnerId]
], { fields: ['partner_id', 'subtype_ids'] });

return { success: true, followerCount: followers.length, followers };
```

### Add a Follower

```typescript testable id="chatter-add-follower" needs="client" creates="res.partner,mail.followers" expect="result.subscribed === true"
// Create a record to follow
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Record To Follow'),
});
trackRecord('res.partner', partnerId);

// Create a partner to be the follower
const followerId = await client.create('res.partner', {
  name: uniqueTestName('Follower Partner'),
  email: 'follower@example.com',
});
trackRecord('res.partner', followerId);

// Add follower using message_subscribe
await client.call('res.partner', 'message_subscribe', [[partnerId]], {
  partner_ids: [followerId],
});

// Verify subscription
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

## Context Variables for Mail Control

Use context variables to control mail behavior during CRUD operations:

| Context Variable | Effect |
|------------------|--------|
| `tracking_disable=True` | Disable automatic field tracking messages |
| `mail_create_nosubscribe=True` | Don't auto-subscribe record creator |
| `mail_create_nolog=True` | Don't create creation log message |
| `mail_notrack=True` | Disable all tracking for this operation |
| `mail_post_autofollow=False` | Don't auto-follow when posting |

### Create Record Without Mail Activity

```typescript testable id="chatter-context-disable" needs="client" creates="res.partner" expect="result.created === true"
// Create record without auto-subscribe and logging
const partnerId = await client.call('res.partner', 'create', [{
  name: uniqueTestName('No Mail Partner'),
}], {
  context: {
    tracking_disable: true,
    mail_create_nosubscribe: true,
    mail_create_nolog: true,
  }
});

trackRecord('res.partner', partnerId);
return { created: partnerId > 0 };
```

## Important Notes

### Why Direct Create Instead of message_post?

The `message_post` method is designed for server-side use and has RPC compatibility issues with external JSON-RPC clients. Specifically:
- The `body` parameter may not be passed correctly
- The `message_type` may default incorrectly

Direct `mail.message` create:
- Reliably preserves HTML formatting
- Correctly sets all message fields
- Works consistently with external RPC clients

### is_internal vs Subtype Internal Flag

The `is_internal` field on `mail.message` controls visibility independently from the subtype's `internal` flag. For internal notes:
- Set `subtype_id: 2` (Note subtype)
- Set `is_internal: true` explicitly

### Many2many Field Write Format

Fields like `partner_ids` and `attachment_ids` use the Many2many write format:
- `[[6, 0, [id1, id2]]]` - Replace with these IDs
- `[[4, id]]` - Add a single ID
- `[[3, id]]` - Remove a single ID

## Related Documents

- [activities.md](./activities.md) - Activity management
- [discuss.md](./discuss.md) - Chat channels and direct messages
- [crud.md](../base/crud.md) - CRUD operations
- [field-types.md](../base/field-types.md) - Field type behaviors
