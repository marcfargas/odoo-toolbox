---
"@marcfargas/odoo-client": minor
"@marcfargas/odoo-cli": minor
---

Add CDC (Change Data Capture) service for tracking field-level changes on Odoo records.

- `client.cdc.check(model)` — verify if a model has mail.tracking enabled and which fields are tracked
- `client.cdc.getHistory(model, id)` — get full change history for a record with typed events
- `odoo cdc check <model>` / `odoo cdc history <model> <id>` — CLI commands for CDC operations
