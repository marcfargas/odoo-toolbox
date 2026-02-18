---
"@marcfargas/odoo-client": minor
---

Switch mail helpers to use `message_post` with full Odoo behavior.

- `postInternalNote()` and `postOpenMessage()` now use `message_post` instead of direct `mail.message` create
- Follower notifications are now sent for open messages (previously silently dropped)
- Auto-subscribe and post-hooks now execute correctly
- HTML body preserved via `body_is_html=true`
- `is_internal=true` explicitly set for notes (message_post does not set it from subtype)

**Breaking:** Open messages (`postOpenMessage`) now send email notifications to followers. This is the correct Odoo behavior that was previously missing.
