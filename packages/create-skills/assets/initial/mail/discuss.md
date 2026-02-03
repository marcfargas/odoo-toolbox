# Discuss (Channels)

Working with Odoo Discuss channels for team communication.

> **MCP Tools**: Use `odoo_list_channels` to discover channels and `odoo_channel_message` to post messages. Version differences (Odoo 15 vs 16+) are handled automatically.

## Overview

Odoo Discuss provides real-time chat and messaging through channels. Channels can be public, private (groups), or direct messages between users.

## Prerequisites

- Authenticated OdooClient connection
- Module: **mail** (base module)

## Key Models

| Model (Odoo 16+) | Model (Odoo 15) | Description |
|------------------|-----------------|-------------|
| `discuss.channel` | `mail.channel` | Chat channels |
| `discuss.channel.member` | `mail.channel.partner` | Channel membership |
| `mail.message` | `mail.message` | Messages within channels |

*Note: In Odoo 16+, `mail.channel` was renamed to `discuss.channel`. The code examples below handle both versions.*

## Detecting Channel Model

```typescript testable id="discuss-detect-model" needs="client" expect="result.channelModel !== null"
// Check which channel model exists in this Odoo version
const discussChannelCount = await client.call('ir.model', 'search_count', [[
  ['model', '=', 'discuss.channel']
]]);

const mailChannelCount = await client.call('ir.model', 'search_count', [[
  ['model', '=', 'mail.channel']
]]);

const channelModel = discussChannelCount > 0 ? 'discuss.channel' :
                     mailChannelCount > 0 ? 'mail.channel' : null;

return {
  channelModel,
  isOdoo16Plus: discussChannelCount > 0
};
```

## Channel Types

| Type | Description |
|------|-------------|
| `channel` | Public channel (anyone can join) |
| `group` | Private group (invite only) |
| `chat` | Direct message (1-on-1 or small group) |
| `livechat` | Website livechat |

## Listing Channels

```typescript testable id="discuss-list-channels" needs="client" expect="result.success === true"
// Detect the correct model
const discussExists = await client.call('ir.model', 'search_count', [[
  ['model', '=', 'discuss.channel']
]]) > 0;
const channelModel = discussExists ? 'discuss.channel' : 'mail.channel';

// List public and group channels
const channels = await client.searchRead(channelModel, [
  ['channel_type', 'in', ['channel', 'group']]
], {
  fields: ['id', 'name', 'channel_type', 'description'],
  order: 'name asc',
  limit: 20
});

channels.forEach(ch => {
  console.log(`[${ch.id}] ${ch.name} (${ch.channel_type})`);
});

return { success: true, channelCount: channels.length };
```

## Reading Messages from a Channel

```typescript testable id="discuss-read-messages" needs="client" expect="result.success === true"
// Detect the correct model
const discussExists = await client.call('ir.model', 'search_count', [[
  ['model', '=', 'discuss.channel']
]]) > 0;
const channelModel = discussExists ? 'discuss.channel' : 'mail.channel';

// Find a channel to read from
const channels = await client.search(channelModel, [
  ['channel_type', '=', 'channel']
], { limit: 1 });

if (channels.length === 0) {
  return { success: true, message: 'No public channels found' };
}

const channelId = channels[0];

// Read messages from the channel
const messages = await client.searchRead('mail.message', [
  ['model', '=', channelModel],
  ['res_id', '=', channelId]
], {
  fields: ['body', 'author_id', 'date', 'message_type'],
  order: 'date desc',
  limit: 20
});

return {
  success: true,
  messageCount: messages.length,
  latestMessage: messages[0]?.body || null
};
```

## Creating Channels

### Public Channel

```typescript testable id="discuss-create-public" needs="client" creates="discuss.channel" expect="result.channelId > 0"
// Detect the correct model
const discussExists = await client.call('ir.model', 'search_count', [[
  ['model', '=', 'discuss.channel']
]]) > 0;
const channelModel = discussExists ? 'discuss.channel' : 'mail.channel';

// Create a public channel
const channelId = await client.create(channelModel, {
  name: uniqueTestName('Test Public Channel'),
  channel_type: 'channel',
  description: 'A test channel created via API',
});

trackRecord(channelModel, channelId);
return { channelId };
```

### Private Group

```typescript testable id="discuss-create-group" needs="client" creates="discuss.channel" expect="result.channelId > 0"
// Detect the correct model
const discussExists = await client.call('ir.model', 'search_count', [[
  ['model', '=', 'discuss.channel']
]]) > 0;
const channelModel = discussExists ? 'discuss.channel' : 'mail.channel';

// Create a private group
const channelId = await client.create(channelModel, {
  name: uniqueTestName('Test Private Group'),
  channel_type: 'group',
  description: 'A private group for team discussions',
});

trackRecord(channelModel, channelId);
return { channelId };
```

## Posting to a Channel

```typescript testable id="discuss-post-message" needs="client" creates="discuss.channel,mail.message" expect="result.messageId > 0"
// Detect the correct model
const discussExists = await client.call('ir.model', 'search_count', [[
  ['model', '=', 'discuss.channel']
]]) > 0;
const channelModel = discussExists ? 'discuss.channel' : 'mail.channel';

// Create a test channel
const channelId = await client.create(channelModel, {
  name: uniqueTestName('Post Test Channel'),
  channel_type: 'channel',
});
trackRecord(channelModel, channelId);

// Post a message to the channel
const messageId = await client.call(channelModel, 'message_post', [[channelId]], {
  body: '<p>Hello from the API! This is a test message.</p>',
  message_type: 'comment',
});

trackRecord('mail.message', messageId);
return { messageId, channelId };
```

## Managing Channel Members

### Get Channel Members

```typescript testable id="discuss-get-members" needs="client" creates="discuss.channel" expect="result.success === true"
// Detect the correct models
const discussExists = await client.call('ir.model', 'search_count', [[
  ['model', '=', 'discuss.channel']
]]) > 0;
const channelModel = discussExists ? 'discuss.channel' : 'mail.channel';
const memberModel = discussExists ? 'discuss.channel.member' : 'mail.channel.partner';

// Create a test channel
const channelId = await client.create(channelModel, {
  name: uniqueTestName('Members Test Channel'),
  channel_type: 'channel',
});
trackRecord(channelModel, channelId);

// Get channel members
const members = await client.searchRead(memberModel, [
  ['channel_id', '=', channelId]
], {
  fields: ['partner_id', 'is_pinned'],
});

return {
  success: true,
  memberCount: members.length,
  members: members.map(m => m.partner_id?.[1] || 'Unknown')
};
```

### Add Members to a Channel

```typescript testable id="discuss-add-members" needs="client" creates="discuss.channel,res.partner" expect="result.added === true"
// Detect the correct model
const discussExists = await client.call('ir.model', 'search_count', [[
  ['model', '=', 'discuss.channel']
]]) > 0;
const channelModel = discussExists ? 'discuss.channel' : 'mail.channel';

// Create a channel
const channelId = await client.create(channelModel, {
  name: uniqueTestName('Add Members Channel'),
  channel_type: 'group',  // Private group to control membership
});
trackRecord(channelModel, channelId);

// Create a partner to add
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('Channel Member Partner'),
  email: 'member@example.com',
});
trackRecord('res.partner', partnerId);

// Add member to channel (method varies by version)
try {
  await client.call(channelModel, 'add_members', [[channelId]], {
    partner_ids: [partnerId],
  });
} catch (e) {
  // Fallback for older versions
  await client.call(channelModel, 'channel_invite', [[channelId]], {
    partner_ids: [partnerId],
  });
}

return { added: true, channelId, partnerId };
```

### Remove Member / Leave Channel

```typescript
// Leave channel (current user)
await client.call(channelModel, 'action_unfollow', [[channelId]]);

// Or unsubscribe specific partners
await client.call(channelModel, 'message_unsubscribe', [[channelId]], {
  partner_ids: [partnerId],
});
```

## Direct Messages

### Get or Create Direct Message Channel

```typescript testable id="discuss-direct-message" needs="client" creates="res.partner" expect="result.success === true"
// Detect the correct model
const discussExists = await client.call('ir.model', 'search_count', [[
  ['model', '=', 'discuss.channel']
]]) > 0;
const channelModel = discussExists ? 'discuss.channel' : 'mail.channel';

// Create a partner to message
const partnerId = await client.create('res.partner', {
  name: uniqueTestName('DM Partner'),
  email: 'dm@example.com',
});
trackRecord('res.partner', partnerId);

// Get or create DM channel with this partner
let dmChannelId;
try {
  // Odoo 16+ method
  const result = await client.call(channelModel, 'channel_get', [], {
    partners_to: [partnerId],
  });
  dmChannelId = result?.id || result;
} catch (e) {
  // Fallback: search for existing or create
  const existing = await client.search(channelModel, [
    ['channel_type', '=', 'chat'],
    ['channel_partner_ids', 'in', [partnerId]]
  ], { limit: 1 });

  if (existing.length > 0) {
    dmChannelId = existing[0];
  }
}

return {
  success: true,
  dmChannelId: dmChannelId || null,
  partnerId
};
```

### Send Direct Message

```typescript
// Get DM channel
const result = await client.call(channelModel, 'channel_get', [], {
  partners_to: [targetPartnerId],
});
const dmChannelId = result?.id || result;

// Post message to DM
await client.call(channelModel, 'message_post', [[dmChannelId]], {
  body: '<p>Hey! Quick question about the project...</p>',
  message_type: 'comment',
});
```

## Searching Messages Across Channels

```typescript testable id="discuss-search-messages" needs="client" expect="result.success === true"
// Detect the correct model
const discussExists = await client.call('ir.model', 'search_count', [[
  ['model', '=', 'discuss.channel']
]]) > 0;
const channelModel = discussExists ? 'discuss.channel' : 'mail.channel';

// Search for messages containing specific text across all channels
const messages = await client.searchRead('mail.message', [
  ['model', '=', channelModel],
  ['body', 'ilike', '%test%']
], {
  fields: ['body', 'author_id', 'res_id', 'date'],
  order: 'date desc',
  limit: 50
});

// Group by channel
const byChannel = {};
for (const msg of messages) {
  const chId = msg.res_id;
  if (!byChannel[chId]) byChannel[chId] = [];
  byChannel[chId].push(msg);
}

return {
  success: true,
  totalMessages: messages.length,
  channelCount: Object.keys(byChannel).length
};
```

## Channel Fields Reference

| Field | Type | Description |
|-------|------|-------------|
| `name` | Char | Channel name |
| `channel_type` | Selection | channel, group, chat, livechat |
| `description` | Text | Channel description |
| `channel_partner_ids` | Many2Many | Channel members (partners) |
| `message_ids` | One2Many | Messages in channel |
| `is_pinned` | Boolean | Pinned by current user |

## Related Documents

- [chatter.md](./chatter.md) - Chatter messages
- [activities.md](./activities.md) - Activity management
- [search.md](../base/search.md) - Search patterns
- [crud.md](../base/crud.md) - CRUD operations
