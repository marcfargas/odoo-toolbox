# Attendance (hr_attendance)

Track employee presence with clock-in/clock-out using Odoo's attendance system.

## Overview

The `hr_attendance` module tracks when employees are physically present (in the office, on-site, etc.). Each attendance record has a `check_in` time and optionally a `check_out` time. Odoo enforces that an employee can only have one open (no `check_out`) attendance at a time.

## Prerequisites

- Authenticated OdooClient connection
- Module: **hr_attendance** (must be installed)
- Depends on: **hr**

## Key Models

| Model | Description |
|-------|-------------|
| `hr.attendance` | Attendance records (clock in/out) |
| `hr.employee` | Employees who clock in/out |

## Service Accessor

Access attendance operations via `client.attendance`:

```typescript
const client = await createClient();

// Clock in
const record = await client.attendance.clockIn();

// Check status
const status = await client.attendance.getStatus();

// Clock out
const closed = await client.attendance.clockOut();
```

All methods accept an optional `employeeId` parameter. When omitted, the current user's linked `hr.employee` record is used automatically.

## Field Reference

### hr.attendance

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `employee_id` | Many2one → hr.employee | Yes | Employee who is present |
| `check_in` | Datetime | Yes | When the employee clocked in |
| `check_out` | Datetime | No | When the employee clocked out (false = still present) |
| `worked_hours` | Float | Computed | Hours between check_in and check_out |

## Checking Module Installation

```typescript testable id="attendance-check-module" needs="client" expect="result.installed === true"
const installed = await client.modules.isModuleInstalled('hr_attendance');
return { installed };
```

## Clock In

```typescript testable id="attendance-clock-in" needs="client" creates="hr.attendance" expect="result.success === true"
// Clock in (uses current user's employee)
const record = await client.attendance.clockIn();
trackRecord('hr.attendance', record.id);

// Check the record
const checkInTime = record.check_in;  // UTC datetime string
const isOpen = !record.check_out;     // true — still clocked in

// Clock out to clean up
await client.attendance.clockOut();

return {
  success: true,
  attendanceId: record.id,
  checkIn: checkInTime,
  wasOpen: isOpen
};
```

## Clock Out

```typescript testable id="attendance-clock-out" needs="client" creates="hr.attendance" expect="result.success === true"
// Must be clocked in first
await client.attendance.clockIn();

// Clock out
const record = await client.attendance.clockOut();
trackRecord('hr.attendance', record.id);

return {
  success: true,
  attendanceId: record.id,
  checkIn: record.check_in,
  checkOut: record.check_out,
  workedHours: record.worked_hours
};
```

## Check Status

```typescript testable id="attendance-status" needs="client" expect="result.success === true"
const status = await client.attendance.getStatus();

if (status.checkedIn) {
  const att = status.currentAttendance!;
  // Employee is in the office since att.check_in
} else {
  // Employee is not in the office
}

return {
  success: true,
  checkedIn: status.checkedIn,
  employeeName: status.employee[1]
};
```

## List Attendance Records

```typescript testable id="attendance-list" needs="client" expect="result.success === true"
const today = new Date().toISOString().split('T')[0];

const records = await client.attendance.list({
  dateFrom: today,
  dateTo: today,
  limit: 20,
});

const totalHours = records.reduce((sum, r) => sum + (r.worked_hours || 0), 0);

return {
  success: true,
  count: records.length,
  totalHours
};
```

### Filter by Employee

```typescript
// Get attendance for a specific employee
const records = await client.attendance.list({
  employeeId: 42,
  dateFrom: '2026-02-01',
  dateTo: '2026-02-28',
});
```

## Standalone Functions

For advanced composition, standalone functions are also exported:

```typescript
import { clockIn, clockOut, getStatus, listAttendances } from '@marcfargas/odoo-client';

const record = await clockIn(client, employeeId);
const closed = await clockOut(client, employeeId);
const status = await getStatus(client, employeeId);
const list = await listAttendances(client, { employeeId: 42, limit: 10 });
```

## Important Notes

### One Open Attendance Per Employee

Odoo enforces via `_check_validity` constraint that an employee can only have **one open attendance** (no `check_out`) at a time. Attempting to clock in when already clocked in will throw an `OdooValidationError`.

### Employee ↔ User Relationship

- `employee_id` links to `hr.employee`
- Each employee has a `user_id` linking to `res.users`
- The service auto-resolves the current user's employee when `employeeId` is omitted

### Datetime Handling

- `check_in` and `check_out` are stored in **UTC** as `YYYY-MM-DD HH:MM:SS`
- Odoo applies the user's timezone for display in the UI
- `worked_hours` is computed as `(check_out - check_in)` in hours

## Related Documents

- [timesheets.md](./timesheets.md) — Time tracking on projects (different from attendance)
- [../base/crud.md](../base/crud.md) — CRUD operations
- [../base/modules.md](../base/modules.md) — Module management
