# Record URLs

Generate links to Odoo records that work across all Odoo versions.

## CLI

All URL commands are **READ** — no confirmation required.

### Generate a backend record URL

```bash
# Print a version-agnostic URL to stdout
odoo url record crm.lead 42
# → https://mycompany.odoo.com/mail/view?model=crm.lead&res_id=42

odoo url record res.partner 7
odoo url record sale.order 88

# JSON output
odoo url record crm.lead 42 --format json
# → {"url":"https://...","model":"crm.lead","id":42}
```

Works on all Odoo versions (14+). Uses the `/mail/view` redirect — the same mechanism
as chatter email notifications.

### Generate a portal URL

```bash
# Customer-facing URL with access token
odoo url portal sale.order 88
# → https://mycompany.odoo.com/my/orders/88?access_token=abc-123-...

odoo url portal account.move 42
```

Only works for models with `portal.mixin` (sale.order, account.move, project.task, etc.).
Use `odoo url record` for all other models.

### Compose with mail

```bash
# Get URL and post it as a note
URL=$(odoo url record project.task 17)
odoo mail note project.task 17 "Deployed: $URL" --confirm
```

---

## The Problem

Odoo's web client URL format has changed across versions:

| Version | Format | Example |
|---------|--------|---------|
| v14–v17 | Hash-based | `/web#id=42&model=crm.lead&view_type=form&action=123` |
| v18+ | Path-based | `/odoo/crm.lead/42` |

Hardcoding URL patterns breaks across versions. **Never construct Odoo URLs manually.**

## The Solution: `/mail/view` Redirect

Odoo provides a built-in redirect controller at `/mail/view` — the same mechanism
used in notification emails. It works on **all** Odoo versions (14+) and routes users
based on their access level:

- **Internal users** → redirected to the backend form view
- **Portal users** → redirected to the portal page (if model has `portal.mixin`)
- **Not logged in** → redirected to login, then to the record

## Prerequisites

- Authenticated OdooClient connection
- The `mail` module must be installed (it is in virtually all Odoo instances)
- For portal URLs: the target model must inherit `portal.mixin`

## Quick Reference

```typescript
import { createClient } from '@marcfargas/odoo-client';
const client = await createClient();

// Backend link — works for ANY model, ANY Odoo version
const url = await client.urls.getRecordUrl('crm.lead', 42);
// → 'https://mycompany.odoo.com/mail/view?model=crm.lead&res_id=42'

// Portal link — for models with portal.mixin (sale.order, account.move, etc.)
const portal = await client.urls.getPortalUrl('sale.order', 15);
// → { url: 'https://mycompany.odoo.com/my/orders/15?access_token=abc-...',
//     accessUrl: '/my/orders/15', accessToken: 'abc-...' }

// Base URL only
const baseUrl = await client.urls.getBaseUrl();
// → 'https://mycompany.odoo.com'
```

## API Reference

### `client.urls.getRecordUrl(model, resId)`

Returns a version-agnostic URL that links to any Odoo record. Uses the `/mail/view`
redirect controller.

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | `string` | Odoo model name (e.g., `'crm.lead'`) |
| `resId` | `number` | Record ID |

**Returns:** `Promise<string>` — full URL

```typescript
// Link to a CRM lead
const leadUrl = await client.urls.getRecordUrl('crm.lead', 42);

// Link to a partner
const partnerUrl = await client.urls.getRecordUrl('res.partner', 7);

// Link to a project task
const taskUrl = await client.urls.getRecordUrl('project.task', 123);

// Use in a chatter message
await client.mail.postInternalNote(
  'crm.lead', 42,
  `<p>Related invoice: <a href="${await client.urls.getRecordUrl('account.move', 15)}">INV/2026/0015</a></p>`
);
```

### `client.urls.getPortalUrl(model, resId, options?)`

Returns a customer-facing portal URL with access token. The target model must
inherit from `portal.mixin`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | `string` | Model that inherits `portal.mixin` |
| `resId` | `number` | Record ID |
| `options.suffix` | `string?` | Path suffix (e.g., `'/accept'`) |
| `options.reportType` | `'html' \| 'pdf' \| 'text'?` | Report type parameter |
| `options.download` | `boolean?` | Add `download=true` parameter |

**Returns:** `Promise<PortalUrlResult>` with:
- `url` — full portal URL with access token
- `accessUrl` — the portal path (e.g., `/my/orders/42`)
- `accessToken` — the access token string

**Common portal models:**

| Model | Portal path | Notes |
|-------|------------|-------|
| `sale.order` | `/my/orders/{id}` | Quotations & sales orders |
| `account.move` | `/my/invoices/{id}` | Invoices & credit notes |
| `purchase.order` | `/my/purchase/{id}` | Purchase orders |
| `project.task` | `/my/tasks/{id}` | Project tasks |
| `helpdesk.ticket` | `/my/tickets/{id}` | Helpdesk tickets (Enterprise) |

```typescript
// Basic portal link
const order = await client.urls.getPortalUrl('sale.order', 15);
console.log(order.url);
// → 'https://mycompany.odoo.com/my/orders/15?access_token=abc-123-...'

// PDF download link for an invoice
const invoicePdf = await client.urls.getPortalUrl('account.move', 7, {
  reportType: 'pdf',
  download: true,
});
// → '...?access_token=...&report_type=pdf&download=true'

// Sale order acceptance link
const acceptLink = await client.urls.getPortalUrl('sale.order', 15, {
  suffix: '/accept',
});
// → '.../my/orders/15/accept?access_token=...'
```

### `client.urls.getBaseUrl(forceRefresh?)`

Returns the Odoo instance's base URL from the `web.base.url` system parameter.
Result is cached per client instance.

| Parameter | Type | Description |
|-----------|------|-------------|
| `forceRefresh` | `boolean?` | Bypass cache (default: `false`) |

**Returns:** `Promise<string>` — base URL (e.g., `'https://mycompany.odoo.com'`)

## Standalone Functions

For advanced composition, standalone functions are also available:

```typescript
import { getRecordUrl, getPortalUrl, getBaseUrl } from '@marcfargas/odoo-client';

const url = await getRecordUrl(client, 'crm.lead', 42);
const portal = await getPortalUrl(client, 'sale.order', 15);
const base = await getBaseUrl(client);
```

## When to Use Which

| Situation | Method | Why |
|-----------|--------|-----|
| Link in a chatter message | `getRecordUrl()` | Version-agnostic, works for any model |
| Link in an email to a customer | `getPortalUrl()` | Customer-facing, no login needed |
| Link in an internal report | `getRecordUrl()` | Staff will be logged in |
| Link in a notification | `getRecordUrl()` | Auto-redirects based on user type |
| PDF download link | `getPortalUrl()` with `reportType` | Direct download for external users |
| Any time you need an Odoo URL | `getRecordUrl()` | **Default choice** — safest option |

## How It Works Under the Hood

### Backend URLs (`getRecordUrl`)

1. Reads `web.base.url` from `ir.config_parameter` (cached)
2. Builds `{baseUrl}/mail/view?model={model}&res_id={id}`
3. When accessed, Odoo's `MailController._redirect_to_record()`:
   - Calls `_get_access_action()` on the record
   - For internal users: builds the correct backend URL (hash or path-based)
   - For portal users: redirects to portal page
   - For anonymous: redirects to login

### Portal URLs (`getPortalUrl`)

1. Reads `web.base.url` from `ir.config_parameter` (cached)
2. Reads `access_url` and `access_token` from the record
3. If no token exists, calls `_portal_ensure_token()` to generate one
4. Builds `{baseUrl}{access_url}?access_token={token}`

### Source References

- `/mail/view` controller: [`addons/mail/controllers/mail.py`](https://github.com/odoo/odoo/blob/17.0/addons/mail/controllers/mail.py)
- `portal.mixin`: [`addons/portal/models/portal_mixin.py`](https://github.com/odoo/odoo/blob/17.0/addons/portal/models/portal_mixin.py)
- `web.base.url`: [`odoo/addons/base/models/ir_config_parameter.py`](https://github.com/odoo/odoo/blob/17.0/odoo/addons/base/models/ir_config_parameter.py)
- v18 routing: [`addons/web/static/src/core/browser/router.js`](https://github.com/odoo/odoo/blob/18.0/addons/web/static/src/core/browser/router.js)

## Common Pitfalls

### ❌ Never hardcode URL formats

```typescript
// BAD — breaks on v18+
const url = `${baseUrl}/web#id=${id}&model=${model}&view_type=form`;

// BAD — breaks on v14–v17
const url = `${baseUrl}/odoo/${model}/${id}`;

// GOOD — works on all versions
const url = await client.urls.getRecordUrl(model, id);
```

### ❌ Don't use `getPortalUrl()` for non-portal models

Models that don't inherit `portal.mixin` (e.g., `crm.lead`, `res.partner`) will
throw an error. Use `getRecordUrl()` instead.

### ⚠️ `web.base.url` auto-updates on admin login

Odoo automatically updates `web.base.url` when the admin user logs in from a
different URL. Set the `web.base.url.freeze` system parameter to `True` to prevent
this behavior in production.
