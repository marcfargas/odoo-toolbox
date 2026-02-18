# Attendance (hr_attendance)

Clock in/out tracking for employee presence. Requires `hr_attendance` module.

```typescript
const client = await createClient();
await client.attendance.clockIn();
const status = await client.attendance.getStatus();
await client.attendance.clockOut();
```

All methods accept optional `employeeId`. Omit to use current user's employee.

## Check Module

```typescript testable id="attendance-check-module" needs="client" expect="result.installed === true"
const installed = await client.modules.isModuleInstalled('hr_attendance');
return { installed };
```

## Clock In / Out

```typescript testable id="attendance-clock-in" needs="client" creates="hr.attendance" expect="result.success === true"
const record = await client.attendance.clockIn();
trackRecord('hr.attendance', record.id);

const isOpen = !record.check_out;  // true — still clocked in

await client.attendance.clockOut();

return { success: true, attendanceId: record.id, checkIn: record.check_in, wasOpen: isOpen };
```

```typescript testable id="attendance-clock-out" needs="client" creates="hr.attendance" expect="result.success === true"
await client.attendance.clockIn();

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
  // Employee is in since att.check_in
}

return { success: true, checkedIn: status.checkedIn, employeeName: status.employee[1] };
```

## List Records

```typescript testable id="attendance-list" needs="client" expect="result.success === true"
const today = new Date().toISOString().split('T')[0];

const records = await client.attendance.list({
  dateFrom: today,
  dateTo: today,
  limit: 20,
});

const totalHours = records.reduce((sum, r) => sum + (r.worked_hours || 0), 0);

return { success: true, count: records.length, totalHours };
```

## Key Gotchas

- **One open attendance per employee** — clocking in when already in throws `OdooValidationError`
- **Datetimes are UTC** — `check_in`/`check_out` as `YYYY-MM-DD HH:MM:SS`
- **Employee auto-resolved** from `res.users` → `hr.employee` link when `employeeId` omitted

## Key Fields (hr.attendance)

| Field | Type | Notes |
|-------|------|-------|
| `employee_id` | Many2one | Required |
| `check_in` | Datetime | Required, UTC |
| `check_out` | Datetime | `false` = still present |
| `worked_hours` | Float | Computed from check_in/check_out |
