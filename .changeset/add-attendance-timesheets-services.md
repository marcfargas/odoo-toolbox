---
"@marcfargas/odoo-client": minor
---

Add attendance and timesheets services with client accessors

**Attendance** (`client.attendance.*`) — requires `hr_attendance` module:
- `clockIn()` / `clockOut()` — create/close `hr.attendance` records
- `getStatus()` — check if employee is currently clocked in
- `list()` — query attendance records with date and employee filters

**Timesheets** (`client.timesheets.*`) — requires `hr_timesheet` module:
- `startTimer()` / `stopTimer()` — timer-based tracking (`unit_amount = 0` = running, `> 0` = closed)
- `getRunningTimers()` — find entries with active timers
- `logTime()` — create completed entry with known hours
- `list()` — query timesheet entries with project, task, and date filters

Both services auto-resolve the current user's `hr.employee` when `employeeId` is omitted.
