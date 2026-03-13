---
"@marcfargas/odoo-client": patch
---

Fix `message_post` return value handling for Odoo 19, which returns `[id]` (array) instead of `id` (integer). The mail service now normalizes both formats.
