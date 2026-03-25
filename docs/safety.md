# Safety Model

Operations are classified by their destructive potential:

| Level | Operations |
|-------|------------|
| **READ** | `search`, `searchRead`, `read`, `searchCount`, `client.modules.isModuleInstalled()`, `client.accounting.*`, `client.urls.*` |
| **WRITE** | `create`, `write`, `client.mail.postInternalNote()`, `client.timesheets.logTime()`, `client.attendance.*`, `client.properties.*` |
| **DESTRUCTIVE** | `unlink` (permanent deletion), `client.mail.postOpenMessage()` (sends emails), `client.modules.installModule()` / `uninstallModule()` (schema changes) |

The safety level is enforced by the client's safety guards. See [Error Handling](/client/error-handling) for details on how safety violations are reported.
