# Chatter & Messages

Post messages and notes on any Odoo record that has a chatter (mail.thread mixin).

## CLI

Both mail commands are **WRITE** — require `--confirm`.

| Command | Visibility | Email sent | Safety |
|---------|-----------|-----------|--------|
| `odoo mail note` | Staff only | None | WRITE |
| `odoo mail post` | All followers incl. portal | ✅ To followers | WRITE |

### Post an internal note (staff only, no email)

```bash
# Inline message
odoo mail note crm.lead 42 "Called customer, will decide by Friday" --confirm

# HTML message
odoo mail note crm.lead 42 "<p>Called customer, <b>decision by Friday</b></p>" --html --confirm

# Read message from file
odoo mail note project.task 17 --message-file meeting-notes.html --html --confirm

# Read message from stdin (useful in pipelines)
git log --oneline -5 | odoo mail note project.task 17 --message-file - --confirm

# With subject
odoo mail note crm.lead 42 --subject "Contract Review" --message-file contract.html --html --confirm

# Dry run — show what would be posted
odoo mail note crm.lead 42 "Test note" --confirm --dry-run
```

### Post a public message (notifies followers)

```bash
# Basic public message
odoo mail post sale.order 88 "Your order has been shipped" --confirm

# Notify specific partners
odoo mail post crm.lead 42 --partner-ids 7,15 "Meeting confirmed for Thursday" --confirm

# HTML message from file
odoo mail post res.partner 7 --message-file update.html --html \
  --subject "Account Update" --confirm
```

### Flags

| Flag | Description |
|------|-------------|
| `--confirm` | Required (WRITE operation) |
| `--dry-run` | Show what would be posted without executing |
| `--html` | Treat message body as HTML (default: plain text, auto-wrapped in `<p>`) |
| `--subject <text>` | Subject line |
| `--message-file <file>` | Read message from file (`-` for stdin) |
| `--partner-ids <n,n,...>` | (`post` only) Notify these `res.partner` IDs |

---

## Library API

## Prerequisites

- Authenticated OdooClient connection
- Target model must inherit from `mail.thread` mixin
- Module: **mail** (typically always installed in any Odoo instance)

## Two Functions, Two Intents

| Function | Visibility | Notifications | Use for |
|----------|-----------|---------------|---------|
| `postInternalNote()` | Staff only | None | Internal remarks, call logs, reminders |
| `postOpenMessage()` | ALL followers (incl. portal) | Email sent to followers | Customer-facing updates, status changes |

```typescript
import { createClient } from '@marcfargas/odoo-client';
const client = await createClient();

// Internal note — staff only, no emails sent
await client.mail.postInternalNote('crm.lead', 42, '<p>Called customer.</p>');

// Open message — visible to everyone, followers get notified by email
await client.mail.postOpenMessage('res.partner', 7, '<p>Order shipped.</p>');
```

Both use `message_post` under the hood, with full Odoo behavior:
follower notifications, auto-subscription, reply-to computation, post-hooks.

### Body Format

The body is **HTML**. Plain text is auto-wrapped in `<p>` tags. Empty body throws.

| Input | Result |
|-------|--------|
| `'<p>Called customer.</p>'` | Used as-is |
| `'Called customer.'` | Auto-wrapped → `<p>Called customer.</p>` |
| `''` or `'   '` | **Throws OdooValidationError** |

### Post an Internal Note

```typescript testable id="chatter-post-note" needs="client" creates="res.partner,mail.message" expect="result.isInternal === true"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Internal Note Test'),
});
trackRecord('res.partner', partnerId);

const noteId = await client.mail.postInternalNote(
  'res.partner',
  partnerId,
  '<p>Customer called, wants a <b>callback</b> tomorrow morning.</p>'
);
trackRecord('mail.message', noteId);

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

const msgId = await client.mail.postOpenMessage(
  'res.partner',
  partnerId,
  '<p>Your order has been shipped. Tracking: <a href="https://example.com">XYZ123</a></p>'
);
trackRecord('mail.message', msgId);

const [msg] = await client.read('mail.message', msgId, ['body', 'is_internal', 'subtype_id']);
return {
  isPublic: msg.is_internal === false,
  subtypeIsComment: msg.subtype_id[0] === 1,
  bodyPreserved: msg.body.includes('shipped')
};
```

### Post with @Mentions

```typescript testable id="chatter-post-mention" needs="client" creates="res.partner,mail.message" expect="result.hasMentions === true"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Mention Test'),
});
trackRecord('res.partner', partnerId);

// @mentions use res.partner IDs, NOT res.users IDs
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

const fileContent = Buffer.from('Hello World - Test Document').toString('base64');
const attachmentId = await client.create('ir.attachment', {
  name: 'test-document.txt',
  datas: fileContent,
  res_model: 'res.partner',
  res_id: partnerId,
});
trackRecord('ir.attachment', attachmentId);

const msgId = await client.mail.postOpenMessage(
  'res.partner',
  partnerId,
  '<p>Document attached for your review.</p>',
  { attachmentIds: [attachmentId] }
);
trackRecord('mail.message', msgId);

const [msg] = await client.read('mail.message', msgId, ['attachment_ids']);
return { hasAttachment: msg.attachment_ids.length > 0 };
```

### PostMessageOptions

```typescript
interface PostMessageOptions {
  /** res.partner IDs to @mention (NOT res.users IDs). */
  partnerIds?: number[];
  /** Pre-created ir.attachment IDs to attach. */
  attachmentIds?: number[];
}
```

## Reading Messages from a Record

```typescript testable id="chatter-read-messages" needs="client" creates="res.partner,mail.message" expect="result.messageCount >= 1"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Read Messages Test'),
});
trackRecord('res.partner', partnerId);

await client.mail.postInternalNote('res.partner', partnerId, '<p>Test message for reading</p>');

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

```typescript
const [partner] = await client.read('res.partner', [partnerId], ['message_ids']);
const messageIds = partner.message_ids;

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

Suppress mail side-effects during CRUD operations. See [Context Keys Reference](../base/context-keys.md) for the full guide with Odoo source references.

| Context Variable | Effect |
|------------------|--------|
| `tracking_disable=True` | **Nuclear** — skip ALL mail.thread features (fastest) |
| `mail_notrack=True` | Skip field-value tracking messages only |
| `mail_create_nolog=True` | Skip the "Document created" log message |
| `mail_create_nosubscribe=True` | Don't auto-subscribe record creator as follower |
| `mail_auto_subscribe_no_notify=True` | Auto-subscribe works, but skip notification email |
| `mail_post_autofollow=False` | Don't auto-subscribe partners mentioned in messages (default) |
| `mail_notify_force_send=False` | Queue emails instead of sending inline |
| `mail_activity_quick_update=True` | Skip notification on activity create/reassign |

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

## Verification Patterns

After posting a message or note, read it back from `mail.message` to confirm it landed correctly.

### Post Internal Note → Verify

```typescript testable id="chatter-verify-note" needs="client" creates="res.partner,mail.message" expect="result.found === true && result.isInternal === true"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Verify Note Partner'),
});
trackRecord('res.partner', partnerId);

await client.mail.postInternalNote('res.partner', partnerId, '<p>Verification note body</p>');

const messages = await client.searchRead('mail.message', [
  ['res_id', '=', partnerId],
  ['model', '=', 'res.partner'],
  ['is_internal', '=', true],
], {
  fields: ['body', 'is_internal', 'date'],
  order: 'date desc',
  limit: 1,
});

return {
  found: messages.length > 0,
  isInternal: messages[0]?.is_internal === true,
  bodyMatches: messages[0]?.body?.includes('Verification note body') ?? false,
};
```

CLI equivalent:

```bash
odoo mail note crm.lead 42 "Called customer" --confirm
# Verify the note landed
odoo records search mail.message \
  --domain '[["res_id","=",42],["model","=","crm.lead"],["is_internal","=",true]]' \
  --fields body,date --limit 1
```

### Post Public Message → Verify

```typescript testable id="chatter-verify-public" needs="client" creates="res.partner,mail.message" expect="result.found === true && result.isPublic === true"
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Verify Public Partner'),
});
trackRecord('res.partner', partnerId);

await client.mail.postOpenMessage('res.partner', partnerId, '<p>Shipped your order.</p>');

const messages = await client.searchRead('mail.message', [
  ['res_id', '=', partnerId],
  ['model', '=', 'res.partner'],
  ['is_internal', '=', false],
  ['message_type', '=', 'comment'],
], {
  fields: ['body', 'is_internal', 'subtype_id'],
  order: 'date desc',
  limit: 1,
});

return {
  found: messages.length > 0,
  isPublic: messages[0]?.is_internal === false,
};
```

CLI equivalent:

```bash
odoo mail post sale.order 88 "Your order has been shipped" --confirm
odoo records search mail.message \
  --domain '[["res_id","=",88],["model","=","sale.order"],["is_internal","=",false]]' \
  --fields body,date --limit 1
```

---

## Reference

### Models

| Model | Description |
|-------|-------------|
| `mail.message` | All messages and notifications |
| `mail.message.subtype` | Message categories |
| `mail.followers` | Who follows a record |
| `mail.tracking.value` | Field value change tracking |

### Subtypes

| XML ID | ID | Name | Use |
|--------|-----|------|-----|
| `mail.mt_comment` | 1 | Discussions | Public messages, notifies followers |
| `mail.mt_note` | 2 | Note | Internal notes, staff only |

### Implementation Note

The helpers call `message_post` with `body_is_html=true` and `is_internal` set explicitly.

- `body_is_html=true` is needed because `message_post` escapes HTML strings via
  `markupsafe.escape()`. This kwarg converts the string to a `Markup` object server-side,
  preserving the HTML.
- `is_internal=true` must be passed explicitly for notes — `message_post` does not
  set it automatically from the subtype.

Do NOT call `message_post` directly without `body_is_html: true` — your HTML will be escaped.


