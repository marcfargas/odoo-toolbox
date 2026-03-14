# Context Keys Reference

Context keys that control Odoo behavior during CRUD operations and messaging.
Pass via `context` parameter in `client.create()`, `client.write()`, `client.call()`, etc.

## Mail & Chatter Context Keys

These keys control the `mail.thread` mixin — Odoo's chatter/messaging system that runs
automatically on `create()` and `write()` for any model inheriting `mail.thread`.

> **Source**: `addons/mail/models/mail_thread.py` (class docstring, lines 74–85 in Odoo 17)
> and `addons/mail/models/mail_activity.py`.

### Quick Reference

| Context Key | Default | Effect |
|------------|---------|--------|
| `tracking_disable` | `false` | **Nuclear option** — disables ALL mail.thread features |
| `mail_notrack` | `false` | Skip field-value tracking (no "changed X from A to B" messages) |
| `mail_create_nolog` | `false` | Skip the automatic "Document created" log message |
| `mail_create_nosubscribe` | `false` | Don't auto-subscribe the creating user as follower |
| `mail_auto_subscribe_no_notify` | `false` | Auto-subscribe still happens, but skip the notification email |
| `mail_post_autofollow` | `false` | Auto-subscribe mentioned partners when posting a message |
| `mail_notify_force_send` | `true` | Send email notifications immediately instead of queuing |
| `mail_activity_quick_update` | `false` | Skip notification when assigning/updating activities |

### Detailed Explanation

#### `tracking_disable: true`

**The nuclear option.** Skips the entire `mail.thread` override for `create()` and `write()`.
No auto-subscription, no field tracking, no creation message, no follower updates — nothing.
The method falls through directly to `super().create()` / `super().write()`.

```python
# Source: mail_thread.py create() and write()
if self._context.get('tracking_disable'):
    threads = super(MailThread, self).create(vals_list)
    threads._track_discard()
    return threads
```

**Use when**: Bulk imports, data migration, seeding — any operation where you want raw speed
and zero chatter side-effects.

#### `mail_notrack: true`

Disables **field-value tracking** only. The "Changed Priority from Normal to High" messages
won't be generated. Auto-subscription and creation logging still happen normally.

```python
# Source: mail_thread.py create() and write()
if not self._context.get('mail_notrack'):
    self._track_prepare(self._fields)
```

**Use when**: You're updating fields programmatically and don't want tracking noise,
but you still want the creation message and follower management.

#### `mail_create_nolog: true`

Suppresses the automatic "Document created" message that appears in chatter when a
record is created. This is the message like "Lead created" or "Contact created".

```python
# Source: mail_thread.py create()
if not self._context.get('mail_create_nolog'):
    # ... logs creation message via message_post or _message_log_batch
```

**Use when**: Creating records via API where the creation log is noise.
Odoo itself uses this internally (e.g., when creating records from incoming email).

#### `mail_create_nosubscribe: true`

Prevents the creating user from being automatically added as a follower of the new record.
By default, whoever creates a record becomes a follower and receives all future notifications.

```python
# Source: mail_thread.py create()
if not self._context.get('mail_create_nosubscribe') and threads and self.env.user.active:
    self.env['mail.followers']._insert_followers(...)
```

**Use when**: API/bot creates records on behalf of the system — you don't want the
integration user subscribed to every record it touches.

#### `mail_auto_subscribe_no_notify: true`

Auto-subscription rules still execute (e.g., subscribing the salesperson assigned to a lead),
but the **notification email** about being subscribed is suppressed.

```python
# Source: mail_thread.py _message_auto_subscribe_notify()
if not self or self.env.context.get('mail_auto_subscribe_no_notify'):
    return  # skip notification
```

**Use when**: You want follower management to work correctly but don't want to spam
users with "You have been assigned to..." emails during bulk operations.

#### `mail_post_autofollow: false`

Controls whether partners mentioned in `message_post()` are automatically subscribed
as followers. Default is `false` — you must set it to `true` to enable.

```python
# Source: mail_thread.py message_post()
if self._context.get('mail_post_autofollow') and partner_ids:
    self.message_subscribe(partner_ids=list(partner_ids))
```

**Note**: This is `false` by default. Setting it explicitly to `false` in your context
dict is a no-op but documents intent (the original dict was being defensive).

#### `mail_notify_force_send: false`

By default (`true`), if there are fewer than 50 (configurable) email notifications to send,
Odoo sends them **synchronously** during the request. Setting to `false` forces all emails
through the mail queue, which is processed by the `ir.cron` mail scheduler.

```python
# Source: mail_thread.py _notify_thread()
if force_send := self.env.context.get('mail_notify_force_send', force_send):
    force_send_limit = int(self.env['ir.config_parameter'].sudo().get_param(
        'mail.mail.force.send.limit', 100))
    force_send = len(emails) < force_send_limit
```

**Use when**: You don't want email sending to slow down your API call. The emails
will still be sent, just asynchronously via the mail queue cron.

#### `mail_activity_quick_update: true`

Suppresses notification when creating or reassigning activities. Normally, assigning
an activity to another user triggers a notification. With this key, the assignment
happens silently.

```python
# Source: mail_activity.py create() and write()
if self.env.context.get('mail_activity_quick_update'):
    activities_to_notify = self.env['mail.activity']  # empty → no notifications
```

**Use when**: Programmatically creating/reassigning activities in bulk.

## Preset Contexts

### Silent Create (no chatter side-effects)

Maximum performance for bulk record creation. No messages, no followers, no tracking,
no notifications.

```typescript
const SILENT_CREATE = {
  tracking_disable: true,        // skip all mail.thread features
  mail_create_nolog: true,       // no "Document created" message
  mail_create_nosubscribe: true, // don't subscribe the API user
};
```

### Quiet Create (structure preserved, no noise)

Follower management works, but no emails or tracking messages are generated.

```typescript
const QUIET_CREATE = {
  mail_notrack: true,                    // no field tracking messages
  mail_create_nolog: true,               // no creation log
  mail_create_nosubscribe: true,         // don't subscribe API user
  mail_auto_subscribe_no_notify: true,   // subscribe rules work, no email
  mail_notify_force_send: false,         // queue any emails (don't send inline)
  mail_activity_quick_update: true,      // no activity assignment notifications
};
```

### Quiet Write (update without noise)

For programmatic updates that shouldn't generate tracking messages or emails.

```typescript
const QUIET_WRITE = {
  mail_notrack: true,                  // no "changed X from A to B"
  mail_notify_force_send: false,       // queue emails
  mail_auto_subscribe_no_notify: true, // no subscription emails
};
```

## Notes

- **`default_notify`**: Not a standard Odoo context key. The `default_` prefix sets field
  defaults (i.e., `default_notify` sets a field named `notify` to the given value). This is
  only meaningful for models that have a `notify` boolean field — check the specific model.

- **`mail_post_autofollow`**: Unlike the others, this defaults to `false`. It's an opt-in
  behavior (auto-subscribe partners on message_post). Including it as `false` is defensive
  but redundant.

- **Performance impact of `tracking_disable`**: This is the fastest option because it
  completely bypasses the `mail.thread` create/write override. The difference is significant
  for bulk operations (100+ records) — expect 2-5x speedup depending on the model.

- **`ir.config_parameter` `mail.mail.force.send.limit`**: Controls the threshold for
  `mail_notify_force_send`. Default is 100 emails (was 50 in older versions).

## See Also

- [Chatter & Messages](../mail/chatter.md) — posting messages and notes
- [Activities](../mail/activities.md) — scheduling and managing activities
- [CRUD Operations](crud.md) — using context with create/write
