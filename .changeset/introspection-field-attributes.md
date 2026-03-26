---
"@marcfargas/odoo-introspection": minor
---

Add `getFieldAttributes()` method to Introspector that calls `fields_get()` RPC and returns per-field sanitize/translate metadata. Extend the `OdooField` interface with `sanitize` and `translate` boolean attributes. Results are cached alongside existing field-cache entries.
