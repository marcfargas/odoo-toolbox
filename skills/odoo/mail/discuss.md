# Discuss (Channels)

Odoo Discuss for team communication — public channels, private groups, and direct messages.

**⚠️ Model names changed in Odoo 16+:** `mail.channel` → `discuss.channel`, `mail.channel.partner` → `discuss.channel.member`.

## Detect Channel Model

```typescript testable id="discuss-detect-model" needs="client" expect="result.channelModel !== null"
const discussChannelCount = await client.searchCount('ir.model', [
  ['model', '=', 'discuss.channel']
]);

const mailChannelCount = await client.searchCount('ir.model', [
  ['model', '=', 'mail.channel']
]);

const channelModel = discussChannelCount > 0 ? 'discuss.channel' :
                     mailChannelCount > 0 ? 'mail.channel' : null;

return {
  channelModel,
  isOdoo16Plus: discussChannelCount > 0
};
```

Channel types: `channel` (public), `group` (private/invite-only), `chat` (DM), `livechat`.

## List Channels

```typescript testable id="discuss-list-channels" needs="client" expect="result.success === true"
const discussExists = await client.searchCount('ir.model', [
  ['model', '=', 'discuss.channel']
]) > 0;
const channelModel = discussExists ? 'discuss.channel' : 'mail.channel';

const channels = await client.searchRead(channelModel, [
  ['channel_type', 'in', ['channel', 'group']]
], {
  fields: ['id', 'name', 'channel_type', 'description'],
  order: 'name asc',
  limit: 20
});

return { success: true, channelCount: channels.length };
```

## Read Messages from a Channel

```typescript testable id="discuss-read-messages" needs="client" expect="result.success === true"
const discussExists = await client.searchCount('ir.model', [
  ['model', '=', 'discuss.channel']
]) > 0;
const channelModel = discussExists ? 'discuss.channel' : 'mail.channel';

const channels = await client.search(channelModel, [
  ['channel_type', '=', 'channel']
], { limit: 1 });

if (channels.length === 0) {
  return { success: true, message: 'No public channels found' };
}

const messages = await client.searchRead('mail.message', [
  ['model', '=', channelModel],
  ['res_id', '=', channels[0]]
], {
  fields: ['body', 'author_id', 'date', 'message_type'],
  order: 'date desc',
  limit: 20
});

return { success: true, messageCount: messages.length };
```

## Create Channels

```typescript testable id="discuss-create-public" needs="client" creates="discuss.channel" expect="result.channelId > 0"
const discussExists = await client.searchCount('ir.model', [
  ['model', '=', 'discuss.channel']
]) > 0;
const channelModel = discussExists ? 'discuss.channel' : 'mail.channel';

const channelId = await client.create(channelModel, {
  name: uniqueTestName('Test Public Channel'),
  channel_type: 'channel',
  description: 'A test channel created via API',
});

trackRecord(channelModel, channelId);
return { channelId };
```

```typescript testable id="discuss-create-group" needs="client" creates="discuss.channel" expect="result.channelId > 0"
const discussExists = await client.searchCount('ir.model', [
  ['model', '=', 'discuss.channel']
]) > 0;
const channelModel = discussExists ? 'discuss.channel' : 'mail.channel';

const channelId = await client.create(channelModel, {
  name: uniqueTestName('Test Private Group'),
  channel_type: 'group',
});

trackRecord(channelModel, channelId);
return { channelId };
```

## Post to a Channel

**Safety: DESTRUCTIVE** — sends messages visible to channel members.

Use `body_is_html: true` to preserve HTML formatting (same as chatter — see [chatter.md](./chatter.md)).

```typescript testable id="discuss-post-message" needs="client" creates="discuss.channel,mail.message" expect="result.messageId > 0"
const discussExists = await client.searchCount('ir.model', [
  ['model', '=', 'discuss.channel']
]) > 0;
const channelModel = discussExists ? 'discuss.channel' : 'mail.channel';

const channelId = await client.create(channelModel, {
  name: uniqueTestName('Post Test Channel'),
  channel_type: 'channel',
});
trackRecord(channelModel, channelId);

const messageId = await client.call(channelModel, 'message_post', [[channelId]], {
  body: '<p>Hello from the API!</p>',
  body_is_html: true,
  message_type: 'comment',
});

trackRecord('mail.message', messageId);
return { messageId, channelId };
```

## Manage Members

```typescript testable id="discuss-get-members" needs="client" creates="discuss.channel" expect="result.success === true"
const discussExists = await client.searchCount('ir.model', [
  ['model', '=', 'discuss.channel']
]) > 0;
const channelModel = discussExists ? 'discuss.channel' : 'mail.channel';
const memberModel = discussExists ? 'discuss.channel.member' : 'mail.channel.partner';

const channelId = await client.create(channelModel, {
  name: uniqueTestName('Members Test Channel'),
  channel_type: 'channel',
});
trackRecord(channelModel, channelId);

const members = await client.searchRead(memberModel, [
  ['channel_id', '=', channelId]
], { fields: ['partner_id', 'is_pinned'] });

return { success: true, memberCount: members.length };
```

### Add Members

```typescript testable id="discuss-add-members" needs="client" creates="discuss.channel,res.partner" expect="result.added === true"
const discussExists = await client.searchCount('ir.model', [
  ['model', '=', 'discuss.channel']
]) > 0;
const channelModel = discussExists ? 'discuss.channel' : 'mail.channel';

const channelId = await client.create(channelModel, {
  name: uniqueTestName('Add Members Channel'),
  channel_type: 'group',
});
trackRecord(channelModel, channelId);

const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Channel Member Partner'),
  email: 'member@example.com',
});
trackRecord('res.partner', partnerId);

try {
  await client.call(channelModel, 'add_members', [[channelId]], {
    partner_ids: [partnerId],
  });
} catch (e) {
  await client.call(channelModel, 'channel_invite', [[channelId]], {
    partner_ids: [partnerId],
  });
}

return { added: true, channelId, partnerId };
```

## Direct Messages

```typescript testable id="discuss-direct-message" needs="client" creates="res.partner" expect="result.success === true"
const discussExists = await client.searchCount('ir.model', [
  ['model', '=', 'discuss.channel']
]) > 0;
const channelModel = discussExists ? 'discuss.channel' : 'mail.channel';

const partnerId = await client.create('res.partner', {
  name: uniqueTestName('DM Partner'),
  email: 'dm@example.com',
});
trackRecord('res.partner', partnerId);

let dmChannelId;
try {
  const result = await client.call(channelModel, 'channel_get', [], {
    partners_to: [partnerId],
  });
  dmChannelId = result?.id || result;
} catch (e) {
  const existing = await client.search(channelModel, [
    ['channel_type', '=', 'chat'],
    ['channel_partner_ids', 'in', [partnerId]]
  ], { limit: 1 });
  if (existing.length > 0) dmChannelId = existing[0];
}

return { success: true, dmChannelId: dmChannelId || null, partnerId };
```

## Search Messages Across Channels

```typescript testable id="discuss-search-messages" needs="client" expect="result.success === true"
const discussExists = await client.searchCount('ir.model', [
  ['model', '=', 'discuss.channel']
]) > 0;
const channelModel = discussExists ? 'discuss.channel' : 'mail.channel';

const messages = await client.searchRead('mail.message', [
  ['model', '=', channelModel],
  ['body', 'ilike', 'test']
], {
  fields: ['body', 'author_id', 'res_id', 'date'],
  order: 'date desc',
  limit: 50
});

return { success: true, totalMessages: messages.length };
```

## Unread Tracking

```typescript testable id="discuss-unread-count" needs="client" creates="discuss.channel" expect="result.success === true"
const discussExists = await client.searchCount('ir.model', [
  ['model', '=', 'discuss.channel']
]) > 0;
const channelModel = discussExists ? 'discuss.channel' : 'mail.channel';
const memberModel = discussExists ? 'discuss.channel.member' : 'mail.channel.partner';

const channelId = await client.create(channelModel, {
  name: uniqueTestName('Unread Test Channel'),
  channel_type: 'channel',
});
trackRecord(channelModel, channelId);

const membership = await client.searchRead(memberModel, [
  ['channel_id', '=', channelId]
], {
  fields: ['partner_id', 'seen_message_id', 'message_unread_counter', 'last_seen_dt']
});

return { success: true, membershipCount: membership.length };
```

Read tracking fields: `seen_message_id`, `fetched_message_id`, `message_unread_counter`, `last_seen_dt`.

## Verification Patterns

After channel operations, read back to confirm the channel and messages exist as expected.

### Create Channel → Verify

```typescript testable id="discuss-verify-create-channel" needs="client" creates="discuss.channel" expect="result.nameMatches === true && result.typeCorrect === true"
const discussExists = await client.searchCount('ir.model', [
  ['model', '=', 'discuss.channel']
]) > 0;
const channelModel = discussExists ? 'discuss.channel' : 'mail.channel';

const channelId = await client.create(channelModel, {
  name: uniqueTestName('Verify Channel'),
  channel_type: 'channel',
  description: 'Created for verification',
});
trackRecord(channelModel, channelId);

const [channel] = await client.read(channelModel, [channelId], [
  'name', 'channel_type', 'description'
]);

return {
  nameMatches: channel.name.includes('Verify Channel'),
  typeCorrect: channel.channel_type === 'channel',
};
```

### Post Message → Verify in Channel

```typescript testable id="discuss-verify-post-message" needs="client" creates="discuss.channel,mail.message" expect="result.messageFound === true"
const discussExists = await client.searchCount('ir.model', [
  ['model', '=', 'discuss.channel']
]) > 0;
const channelModel = discussExists ? 'discuss.channel' : 'mail.channel';

const channelId = await client.create(channelModel, {
  name: uniqueTestName('Verify Post Channel'),
  channel_type: 'channel',
});
trackRecord(channelModel, channelId);

const messageId = await client.call(channelModel, 'message_post', [[channelId]], {
  body: '<p>Verification message content</p>',
  body_is_html: true,
  message_type: 'comment',
});
trackRecord('mail.message', messageId);

// Verify the message appears when searching by channel
const messages = await client.searchRead('mail.message', [
  ['model', '=', channelModel],
  ['res_id', '=', channelId],
  ['id', '=', messageId],
], {
  fields: ['body', 'message_type'],
  limit: 1,
});

return {
  messageFound: messages.length > 0,
  bodyContains: messages[0]?.body?.includes('Verification message content') ?? false,
};
```
