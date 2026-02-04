# Odoo 17 Breaking Changes

This document lists breaking changes and API differences in Odoo 17 compared to earlier versions.

## Model Renames

### Discuss/Chat Models

| Old Name (Odoo 15-16) | New Name (Odoo 17+) | Notes |
|-----------------------|---------------------|-------|
| `mail.channel` | `discuss.channel` | Chat channels model |
| `mail.channel.partner` | `discuss.channel.member` | Channel membership |

### Detection Pattern

```typescript
// Detect channel model name
const discussExists = await client.call('ir.model', 'search_count', [[
  ['model', '=', 'discuss.channel']
]]) > 0;

const channelModel = discussExists ? 'discuss.channel' : 'mail.channel';
const memberModel = discussExists ? 'discuss.channel.member' : 'mail.channel.partner';
```

## New Fields

### discuss.channel.member

| Field | Type | Description |
|-------|------|-------------|
| `seen_message_id` | Many2one → mail.message | Last message seen by member |
| `fetched_message_id` | Many2one → mail.message | Last message fetched by client |
| `message_unread_counter` | Integer | Count of unread messages |
| `last_seen_dt` | Datetime | When member last viewed channel |

## Method Changes

### Channel Invitations

| Odoo 16 | Odoo 17+ | Purpose |
|---------|----------|---------|
| `channel_invite` | `add_members` | Add members to channel |

**Fallback pattern:**

```typescript
try {
  // Try Odoo 17+ method first
  await client.call(channelModel, 'add_members', [[channelId]], {
    partner_ids: [partnerId],
  });
} catch (e) {
  // Fallback for older versions
  await client.call(channelModel, 'channel_invite', [[channelId]], {
    partner_ids: [partnerId],
  });
}
```

## Removed Features

### In Odoo 17

- `mail.channel` model no longer exists (use `discuss.channel`)
- `mail.channel.partner` model no longer exists (use `discuss.channel.member`)

## Version Detection

### Check Odoo Version via RPC

```typescript
// Get Odoo server version
const versionInfo = await client.call('', 'version', []);
console.log(versionInfo.server_version); // e.g., "17.0"

// Parse major version
const majorVersion = parseInt(versionInfo.server_version.split('.')[0], 10);
const isOdoo17Plus = majorVersion >= 17;
```

### Check via Model Existence

```typescript
// Check if a model exists
async function modelExists(client, modelName) {
  const count = await client.call('ir.model', 'search_count', [[
    ['model', '=', modelName]
  ]]);
  return count > 0;
}

// Usage
const isOdoo17 = await modelExists(client, 'discuss.channel');
```

## Related Documents

- [discuss.md](./mail/discuss.md) - Discuss channels (handles both versions)
- [chatter.md](./mail/chatter.md) - Chatter messages
