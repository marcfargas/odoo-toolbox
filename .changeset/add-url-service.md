---
"@marcfargas/odoo-client": minor
---

Add URL service (`client.urls.*`) for generating version-agnostic record URLs.

- `client.urls.getRecordUrl()` — direct record URL via `/web#model=...&id=...`
- `client.urls.getMailRedirectUrl()` — `/mail/view` redirect (works across Odoo versions)
- `client.urls.getMenuUrl()` — URL with specific menu context
- Pure URL construction, no RPC calls needed
