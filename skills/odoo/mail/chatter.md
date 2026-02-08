# Chatter & Messages

Post messages and notes on any Odoo record that has a chatter (mail.thread mixin).

## Prerequisites

- Authenticated OdooClient connection
- Target model must inherit from `mail.thread` mixin
- Module: **mail** (typically always installed in any Odoo instance)

## Posting Messages — Use the Service Accessor

Two functions, two intents — **no confusion possible**:

| Function | Visibility | Notifications | Use for |
|----------|-----------|---------------|---------|
| `postInternalNote()` | Staff only | None | Internal remarks, call logs, reminders |
| `postOpenMessage()` | ALL followers (incl. portal) | Email sent | Customer-facing updates, status changes |

Access via the `client.mail` service accessor:

```typescript
import { createClient } from '@odoo-toolbox/client';
const client = await createClient();

await client.mail.postInternalNote('crm.lead', 42, '<p>Called customer.</p>');
await client.mail.postOpenMessage('res.partner', 7, '<p>Order shipped.</p>');
```

### Body Format — CRITICAL

The body is **always HTML**. Common mistake: passing an empty string or `undefined` → **throws `OdooValidationError`**.

| Input | Result |
|-------|--------|
| `'<p>Called customer, wants callback.</p>'` | Used as-is |
| `'<ul><li>Item 1</li></ul>'` | Used as-is |
| `'Called customer, wants callback.'` | Auto-wrapped → `<p>Called customer, wants callback.</p>` |
| `''` or `'   '` | **Throws OdooValidationError** |

### Post an Internal Note

```typescript testable id="chatter-post-note" needs="client" creates="res.partner,mail.message" expect="result.isInternal === true"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Internal Note Test'),
});
trackRecord('res.partner', partnerId);

// Post an internal note — visible ONLY to staff, NOT to portal/public
const noteId = await client.mail.postInternalNote(
  'res.partner',
  partnerId,
  '<p>Customer called, wants a <b>callback</b> tomorrow morning.</p>'
);
trackRecord('mail.message', noteId);

// Verify
const [msg] = await client.read('mail.message', noteId, ['body', 'is_internal', 'subtype_id']);
return {
  isInternal: msg.is_internal === true,
  subtypeIsNote: msg.subtype_id[0] === 2,
  bodyPreserved: msg.body.includes('<b>callback</b>')
};
```

### Post an Open (Public) Message

```typescript testable id="chatter-post-public" needs="client" creates="res.partner,mail.message" expect="result.isPublic === true"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Public Message Test'),
});
trackRecord('res.partner', partnerId);

// Post a public message — visible to ALL followers, sends email notifications
const msgId = await client.mail.postOpenMessage(
  'res.partner',
  partnerId,
  '<p>Your order has been shipped. Tracking: <a href="https://example.com">XYZ123</a></p>'
);
trackRecord('mail.message', msgId);

// Verify
const [msg] = await client.read('mail.message', msgId, ['body', 'is_internal', 'subtype_id']);
return {
  isPublic: msg.is_internal === false,
  subtypeIsComment: msg.subtype_id[0] === 1,
  bodyPreserved: msg.body.includes('shipped')
};
```

### Plain Text Works Too

```typescript
// No HTML? Plain text is auto-wrapped in <p> tags
await client.mail.postInternalNote(
  'crm.lead', leadId,
  'Spoke with warehouse — stock arrives Friday.'
);
// Stored as: <p>Spoke with warehouse — stock arrives Friday.</p>
```

### Post with @Mentions

```typescript testable id="chatter-post-mention" needs="client" creates="res.partner,mail.message" expect="result.hasMentions === true"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Mention Test'),
});
trackRecord('res.partner', partnerId);

// Get admin user's partner ID for mention
// Note: @mentions use res.partner IDs, NOT res.users IDs
const [adminUser] = await client.searchRead('res.users', [
  ['login', '=', 'admin']
], { fields: ['partner_id'], limit: 1 });
const adminPartnerId = adminUser.partner_id[0];

const msgId = await client.mail.postOpenMessage(
  'res.partner',
  partnerId,
  '<p>Please review this record.</p>',
  { partnerIds: [adminPartnerId] }
);
trackRecord('mail.message', msgId);

// Verify mentions
const [msg] = await client.read('mail.message', msgId, ['partner_ids']);
return {
  hasMentions: msg.partner_ids.length > 0,
  mentionedPartners: msg.partner_ids
};
```

### Post with Attachments

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

// Post with attachment
const msgId = await client.mail.postOpenMessage(
  'res.partner',
  partnerId,
  '<p>Document attached for your review.</p>',
  { attachmentIds: [attachmentId] }
);
trackRecord('mail.message', msgId);

// Verify
const [msg] = await client.read('mail.message', msgId, ['attachment_ids']);
return { hasAttachment: msg.attachment_ids.length > 0 };
```

## PostMessageOptions

```typescript
interface PostMessageOptions {
  /** res.partner IDs to @mention (NOT res.users IDs). Mentioned partners receive a notification. */
  partnerIds?: number[];
  /** Pre-created ir.attachment IDs to attach to the message. */
  attachmentIds?: number[];
}
```

## Reading Messages from a Record

### Search Messages by Model and Record

```typescript testable id="chatter-read-messages" needs="client" creates="res.partner,mail.message" expect="result.messageCount >= 1"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Read Messages Test'),
});
trackRecord('res.partner', partnerId);

await client.mail.postInternalNote('res.partner', partnerId, '<p>Test message for reading</p>');

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
const [partner] = await client.read('res.partner', [partnerId], ['message_ids']);
const messageIds = partner.message_ids;  // Array of message IDs

if (messageIds.length > 0) {
  const messages = await client.read('mail.message', messageIds, [
    'body', 'message_type', 'author_id', 'date', 'is_internal'
  ]);
}
```

## Checking if Model Has Chatter

```typescript testable id="chatter-check-mixin" needs="client" expect="result.hasMailThread === true"
const models = await client.searchRead('ir.model', [
  ['model', '=', 'res.partner']
], { fields: ['model', 'is_mail_thread'] });

const hasMailThread = models[0]?.is_mail_thread || false;
return { hasMailThread };
```

## Managing Followers

### Get Current Followers

```typescript testable id="chatter-get-followers" needs="client" creates="res.partner" expect="result.success === true"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Followers Test'),
});
trackRecord('res.partner', partnerId);

const followers = await client.searchRead('mail.followers', [
  ['res_model', '=', 'res.partner'],
  ['res_id', '=', partnerId]
], { fields: ['partner_id', 'subtype_ids'] });

return { success: true, followerCount: followers.length, followers };
```

### Add a Follower

```typescript testable id="chatter-add-follower" needs="client" creates="res.partner,mail.followers" expect="result.subscribed === true"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Record To Follow'),
});
trackRecord('res.partner', partnerId);

const followerId = await client.create('res.partner', {
  name: uniqueTestName('Follower Partner'),
  email: 'follower@example.com',
});
trackRecord('res.partner', followerId);

await client.call('res.partner', 'message_subscribe', [[partnerId]], {
  partner_ids: [followerId],
});

const followers = await client.searchRead('mail.followers', [
  ['res_model', '=', 'res.partner'],
  ['res_id', '=', partnerId],
  ['partner_id', '=', followerId]
], { fields: ['id'] });

return { subscribed: followers.length > 0 };
```

### Remove a Follower

```typescript
await client.call('res.partner', 'message_unsubscribe', [[recordId]], {
  partner_ids: [partnerId],
});
```

## Context Variables for Mail Control

Use context variables to suppress mail side-effects during CRUD operations:

| Context Variable | Effect |
|------------------|--------|
| `tracking_disable=True` | Disable automatic field tracking messages |
| `mail_create_nosubscribe=True` | Don't auto-subscribe record creator |
| `mail_create_nolog=True` | Don't create creation log message |
| `mail_notrack=True` | Disable all tracking for this operation |
| `mail_post_autofollow=False` | Don't auto-follow when posting |

```typescript testable id="chatter-context-disable" needs="client" creates="res.partner" expect="result.created === true"
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

## HTML Formatting Reference

The `body` field is HTML. Odoo sanitizes it on save:

| Element | Behavior |
|---------|----------|
| `<b>`, `<em>`, `<u>`, `<i>` | **Preserved** |
| `<a href="...">` | **Preserved** |
| `<ul>`, `<ol>`, `<li>` | **Preserved** |
| `<table>`, `<tr>`, `<td>` | **Preserved** |
| `<h1>`–`<h6>` | **Preserved** |
| `<pre>`, `<code>` | **Preserved** |
| `<br/>` | **Normalized** → `<br>` |
| `<div>` | **Stripped** — content kept, tag removed |
| `<script>` | **Stripped** — security |
| `<img src="data:...">` | **Converted** — becomes Odoo attachment |

## Reference: Key Models and Constants

### Models

| Model | Description |
|-------|-------------|
| `mail.message` | All messages and notifications |
| `mail.message.subtype` | Message categories |
| `mail.followers` | Who follows a record |
| `mail.tracking.value` | Field value change tracking |

### Message Subtypes

| Subtype XML ID | ID | Name | Internal | Description |
|----------------|-----|------|----------|-------------|
| `mail.mt_comment` | 1 | Discussions | false | Public, visible to followers |
| `mail.mt_note` | 2 | Note | true | Staff only |
| `mail.mt_activities` | 3 | Activities | true | Activity notifications |

### Message Types

| message_type | Description |
|--------------|-------------|
| `comment` | User message (note or public — determined by subtype) |
| `notification` | System notification |
| `email` | Incoming email |
| `email_outgoing` | Outgoing email |
| `user_notification` | User-specific notification |

### Why Direct Create Instead of message_post?

The `message_post` RPC method is designed for server-side Python. External JSON-RPC clients
have known issues: the `body` kwarg may be silently dropped, `message_type` may default wrong.
The helpers use direct `mail.message` create, which works reliably via RPC.

### is_internal + subtype: Both Required

For internal notes, **both** `subtype_id: 2` AND `is_internal: true` must be set.
The `is_internal` field on `mail.message` controls visibility independently from the
subtype's `internal` flag. The helpers set both correctly.

### Many2many Field Write Format

Fields like `partner_ids` and `attachment_ids` use the Many2many write format:
- `[[6, 0, [id1, id2]]]` — Replace with these IDs
- `[[4, id]]` — Add a single ID
- `[[3, id]]` — Remove a single ID

The helpers accept plain arrays (`partnerIds: [1, 2]`) and handle the encoding.

## Related Documents

- [activities.md](./activities.md) — Activity management
- [discuss.md](./discuss.md) — Chat channels and direct messages
- [../base/modules.md](../base/modules.md) — Module installation
- [../base/crud.md](../base/crud.md) — CRUD operations
- [../base/field-types.md](../base/field-types.md) — Field type behaviors
