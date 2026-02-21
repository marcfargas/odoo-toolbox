# Mail Service — `client.mail.*`

Post messages and internal notes on any Odoo record's chatter.

**Requires:** The `mail` module (installed in virtually all Odoo instances). The target model must inherit `mail.thread`.

## Two Methods, Two Intents

| Method | Visibility | Sends Email | Safety | Use for |
|--------|-----------|-------------|--------|---------|
| `postInternalNote()` | Staff only | Never | WRITE | Internal remarks, call logs, action reminders |
| `postOpenMessage()` | All followers (incl. portal) | Yes | DESTRUCTIVE | Customer-facing updates, status notifications |

```typescript testable id="mail-overview" needs="client" creates="res.partner"
import { createClient } from '@marcfargas/odoo-client';
const client = await createClient();

// Internal note — only staff can see it, no emails sent
await client.mail.postInternalNote('crm.lead', 42, '<p>Called customer.</p>');

// Open message — visible to all followers, emails sent
await client.mail.postOpenMessage('res.partner', 7, '<p>Order shipped!</p>');
```

## `postInternalNote(model, resId, body, options?)`

Posts a note visible only to internal (staff) users. No email is ever sent for internal notes.

```typescript testable id="mail-internal-note" needs="client" creates="res.partner,mail.message" expect="result.isInternal === true"
const partnerId = await client.create('res.partner', {
  name: 'Note Demo',
});

const noteId = await client.mail.postInternalNote(
  'res.partner',
  partnerId,
  '<p>Customer called at 3 PM — wants a <strong>callback</strong> on Friday.</p>'
);

const [msg] = await client.read('mail.message', noteId, ['is_internal', 'body']);
return { isInternal: msg.is_internal === true };
```

## `postOpenMessage(model, resId, body, options?)`

Posts a public message visible to all followers, including portal users. Odoo sends email notifications to followers.

⚠️ **DESTRUCTIVE** — this may send emails to external users. Use only when intentional.

```typescript testable id="mail-open-message" needs="client" creates="res.partner,mail.message" expect="result.isPublic === true"
const partnerId = await client.create('res.partner', {
  name: 'Message Demo',
});

const msgId = await client.mail.postOpenMessage(
  'res.partner',
  partnerId,
  '<p>Your order has been <a href="https://example.com">shipped</a>. Expected delivery: Friday.</p>'
);

const [msg] = await client.read('mail.message', msgId, ['is_internal']);
return { isPublic: msg.is_internal === false };
```

## Body Format

The `body` parameter is HTML. Plain text is auto-wrapped in `<p>` tags:

| Input | Result |
|-------|--------|
| `'<p>Called customer.</p>'` | Used as-is |
| `'Called customer.'` | Auto-wrapped → `<p>Called customer.</p>` |
| `''` or `'   '` | **Throws `OdooValidationError`** |

> The service passes `body_is_html: true` to Odoo's `message_post`. Without this, Odoo escapes HTML via `markupsafe.escape()`, turning your `<p>` tags into `&lt;p&gt;`. Never call `message_post` directly without this flag.

## Options: Mentions and Attachments

Both methods accept an optional `options` argument:

```typescript
interface PostMessageOptions {
  /** res.partner IDs to @mention (NOT res.users IDs!) */
  partnerIds?: number[];
  /** Pre-created ir.attachment IDs to attach */
  attachmentIds?: number[];
}
```

### @Mentions

```typescript testable id="mail-mention" needs="client" creates="res.partner,mail.message" expect="result.hasMentions === true"
const partnerId = await client.create('res.partner', { name: 'Mention Test' });

// Mentions use res.partner IDs, not res.users IDs
const [adminUser] = await client.searchRead('res.users', [['login', '=', 'admin']], {
  fields: ['partner_id'],
  limit: 1,
});
const adminPartnerId = adminUser.partner_id[0];

const msgId = await client.mail.postOpenMessage(
  'res.partner',
  partnerId,
  '<p>Please review this contact.</p>',
  { partnerIds: [adminPartnerId] }
);

const [msg] = await client.read('mail.message', msgId, ['partner_ids']);
return { hasMentions: msg.partner_ids.length > 0 };
```

### Attachments

```typescript testable id="mail-attachment" needs="client" creates="res.partner,ir.attachment,mail.message" expect="result.hasAttachment === true"
const partnerId = await client.create('res.partner', { name: 'Attachment Test' });

// 1. Create the attachment first
const attachmentId = await client.create('ir.attachment', {
  name: 'report.txt',
  datas: Buffer.from('Report content here').toString('base64'),
  res_model: 'res.partner',
  res_id: partnerId,
});

// 2. Reference it in the message
const msgId = await client.mail.postOpenMessage(
  'res.partner',
  partnerId,
  '<p>See the attached report.</p>',
  { attachmentIds: [attachmentId] }
);

const [msg] = await client.read('mail.message', msgId, ['attachment_ids']);
return { hasAttachment: msg.attachment_ids.length > 0 };
```

## Reading Messages

Read messages on a record by querying `mail.message`:

```typescript testable id="mail-read-messages" needs="client" creates="res.partner,mail.message" expect="result.count >= 1"
const partnerId = await client.create('res.partner', { name: 'Read Messages Demo' });

await client.mail.postInternalNote('res.partner', partnerId, '<p>Test note.</p>');

const messages = await client.searchRead('mail.message', [
  ['model', '=', 'res.partner'],
  ['res_id', '=', partnerId],
], {
  fields: ['body', 'message_type', 'is_internal', 'author_id', 'date'],
  order: 'date desc',
  limit: 10,
});

return { count: messages.length };
```

## Managing Followers

Followers receive email notifications for open messages. By default, the record creator is auto-subscribed.

### Add a follower

```typescript testable id="mail-add-follower" needs="client" creates="res.partner" expect="result.subscribed === true"
const recordId = await client.create('res.partner', { name: 'Record To Follow' });
const followerId = await client.create('res.partner', {
  name: 'New Follower',
  email: 'follower@example.com',
});

// Use message_subscribe to add a follower
await client.call('res.partner', 'message_subscribe', [[recordId]], {
  partner_ids: [followerId],
});

const followers = await client.searchRead('mail.followers', [
  ['res_model', '=', 'res.partner'],
  ['res_id', '=', recordId],
  ['partner_id', '=', followerId],
], { fields: ['id'] });

return { subscribed: followers.length > 0 };
```

### Remove a follower

```typescript
await client.call('res.partner', 'message_unsubscribe', [[recordId]], {
  partner_ids: [partnerIdToRemove],
});
```

## Suppressing Mail Side-Effects

When doing bulk CRUD operations, suppress auto-tracking and subscription noise using context:

```typescript testable id="mail-suppress" needs="client" creates="res.partner" expect="result.created === true"
// Create without auto-subscribing the creator or creating a 'Created' log message
const partnerId = await client.call('res.partner', 'create', [{
  name: 'Bulk Import Record',
}], {
  context: {
    tracking_disable: true,        // No field tracking messages
    mail_create_nosubscribe: true, // Don't subscribe creator
    mail_create_nolog: true,       // No 'Created' log message
  }
});

return { created: partnerId > 0 };
```

| Context Key | Effect |
|-------------|--------|
| `tracking_disable` | Disable all field tracking change messages |
| `mail_create_nosubscribe` | Don't auto-subscribe the record creator |
| `mail_create_nolog` | Don't create "Record Created" log entry |
| `mail_notrack` | Disable tracking for this specific operation |

## Model Reference

| Model | Description |
|-------|-------------|
| `mail.message` | All messages, notes, and notifications |
| `mail.followers` | Who follows a record (receive notifications) |
| `mail.message.subtype` | Message categories (Discussion vs Note) |
| `mail.tracking.value` | Field value change records |

| Subtype | ID | Used for |
|---------|----|---------|
| `mail.mt_comment` (Discussions) | 1 | Open messages — notifies followers |
| `mail.mt_note` (Note) | 2 | Internal notes — staff only |

---

See also:
- [URLs Service](./urls.md) — link to records from chatter messages
- [CRUD Operations](../client/crud.md) — creating attachments

For agent-optimized CLI examples, see the [odoo skill](../skills/odoo/).
