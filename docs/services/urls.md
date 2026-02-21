# URLs Service — `client.urls.*`

Generate version-agnostic links to Odoo records.

**Safety:** All methods are **READ** — pure URL construction with at most one cached RPC call for the base URL.

## The Problem

Odoo's web client URL format has changed across major versions:

| Version | Format |
|---------|--------|
| v14–v17 | Hash-based: `/web#id=42&model=crm.lead&view_type=form&action=123` |
| v18+ | Path-based: `/odoo/crm.lead/42` |

Hardcoding either format breaks on upgrade. **Never construct Odoo URLs manually.**

## The Solution

`client.urls.getRecordUrl()` uses Odoo's `/mail/view` redirect controller — the same mechanism used in notification emails. It works on **all** Odoo versions (v14+) and routes users correctly based on their access level:

- **Internal users** → backend form view
- **Portal users** → portal page (if model has `portal.mixin`)
- **Not logged in** → login redirect, then the record

## `getRecordUrl(model, resId)` — Backend Link

```typescript testable id="url-record" needs="client" expect="result.url.includes('/mail/view')"
const url = await client.urls.getRecordUrl('crm.lead', 42);
// → 'https://mycompany.odoo.com/mail/view?model=crm.lead&res_id=42'

console.log(url);
return { url };
```

Use for any model, any Odoo version:

```typescript
const leadUrl = await client.urls.getRecordUrl('crm.lead', 42);
const partnerUrl = await client.urls.getRecordUrl('res.partner', 7);
const taskUrl = await client.urls.getRecordUrl('project.task', 123);
const invoiceUrl = await client.urls.getRecordUrl('account.move', 15);
```

### Embed in a chatter message

```typescript testable id="url-in-note" needs="client" creates="res.partner"
const partnerId = await client.create('res.partner', { name: 'URL Demo Partner' });
const invoiceUrl = await client.urls.getRecordUrl('account.move', 15);

await client.mail.postInternalNote(
  'res.partner',
  partnerId,
  `<p>Related invoice: <a href="${invoiceUrl}">INV/2025/0015</a></p>`
);
```

## `getPortalUrl(model, resId, options?)` — Customer-Facing Link

Returns a URL with an access token that customers can open without logging in. The target model must inherit `portal.mixin`.

```typescript testable id="url-portal" needs="client" expect="result.hasToken === true"
const result = await client.urls.getPortalUrl('sale.order', 15);
// result.url = 'https://mycompany.odoo.com/my/orders/15?access_token=abc-123-...'
// result.accessUrl = '/my/orders/15'
// result.accessToken = 'abc-123-...'

return { hasToken: !!result.accessToken };
```

### Options

| Option | Type | Description |
|--------|------|-------------|
| `suffix` | `string` | Path suffix: `'/accept'`, `'/decline'` |
| `reportType` | `'html' \| 'pdf' \| 'text'` | Add `report_type` parameter |
| `download` | `boolean` | Add `download=true` parameter |

### Return Value — `PortalUrlResult`

| Field | Type | Description |
|-------|------|-------------|
| `url` | `string` | Full URL with access token |
| `accessUrl` | `string` | Portal path (e.g., `/my/orders/15`) |
| `accessToken` | `string` | The access token string |

### Common portal models

| Model | Portal path |
|-------|------------|
| `sale.order` | `/my/orders/{id}` |
| `account.move` | `/my/invoices/{id}` |
| `purchase.order` | `/my/purchase/{id}` |
| `project.task` | `/my/tasks/{id}` |
| `helpdesk.ticket` | `/my/tickets/{id}` |

### Examples

```typescript
// Invoice PDF download link for customers
const invoicePdf = await client.urls.getPortalUrl('account.move', 7, {
  reportType: 'pdf',
  download: true,
});
// → '...?access_token=...&report_type=pdf&download=true'

// Sale order acceptance link
const acceptLink = await client.urls.getPortalUrl('sale.order', 15, {
  suffix: '/accept',
});
// → '...my/orders/15/accept?access_token=...'
```

> **Do not use `getPortalUrl()` for models without `portal.mixin`** (e.g., `crm.lead`, `res.partner`). Use `getRecordUrl()` instead.

## `getBaseUrl(forceRefresh?)`

Returns the Odoo instance's base URL from the `web.base.url` system parameter. Cached per client instance:

```typescript testable id="url-base" needs="client" expect="result.url.startsWith('http')"
const baseUrl = await client.urls.getBaseUrl();
// → 'https://mycompany.odoo.com'

// Force a fresh read (after URL change, staging environment, etc.)
const fresh = await client.urls.getBaseUrl(true);

return { url: baseUrl };
```

## Standalone Functions

For advanced composition or when you don't have a `client.urls` service, import the functions directly:

```typescript
import { getRecordUrl, getPortalUrl, getBaseUrl } from '@marcfargas/odoo-client';

const url = await getRecordUrl(client, 'crm.lead', 42);
const portal = await getPortalUrl(client, 'sale.order', 15);
const base = await getBaseUrl(client);
```

## When to Use Which

| Situation | Use | Why |
|-----------|-----|-----|
| Link in chatter for internal review | `getRecordUrl()` | Version-agnostic, works for any model |
| Link in email to customer | `getPortalUrl()` | Customer-facing, no login needed |
| Link in internal dashboard | `getRecordUrl()` | Staff will be logged in |
| PDF download for customer | `getPortalUrl({ reportType: 'pdf', download: true })` | Direct download |
| Quick record link | `getRecordUrl()` | **Default choice** — always safe |

## Common Pitfalls

```typescript
// ❌ Breaks on v18+
const url = `${baseUrl}/web#id=${id}&model=${model}&view_type=form`;

// ❌ Breaks on v14–v17
const url = `${baseUrl}/odoo/${model}/${id}`;

// ✅ Works everywhere
const url = await client.urls.getRecordUrl(model, id);
```

> **`web.base.url` auto-updates** on admin login. Set `web.base.url.freeze = True` in system parameters to prevent unintended URL changes in production.

---

See also:
- [Mail Service](./mail.md) — embed URLs in chatter messages

For agent-optimized CLI examples, see the [odoo skill](../skills/odoo/).
