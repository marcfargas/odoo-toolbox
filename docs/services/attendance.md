# Attendance Service — `client.attendance.*`

Track employee clock-in/out using the `hr.attendance` model.

**Requires:** `hr_attendance` module. Check before using:

```typescript testable id="att-check-module" needs="client" expect="typeof result === 'boolean'"
const installed = await client.modules.isModuleInstalled('hr_attendance');
return installed;
```

**Safety:** All methods are **WRITE** operations (they create or modify `hr.attendance` records).

## Quick Reference

```typescript
import { createClient } from '@marcfargas/odoo-client';
const client = await createClient();

const record = await client.attendance.clockIn();   // Clock in
const status = await client.attendance.getStatus(); // Check status
await client.attendance.clockOut();                 // Clock out
```

All methods accept an optional `employeeId`. When omitted, the current user's linked `hr.employee` record is used automatically.

## `clockIn(employeeId?)`

Creates a new `hr.attendance` record with `check_in = now()`:

```typescript testable id="att-clock-in" needs="client" creates="hr.attendance" expect="result.success === true"
const record = await client.attendance.clockIn();

console.log(`Clocked in at ${record.check_in}`);
console.log(`Is currently in: ${record.check_out === false}`);

// Always clock out in tests/scripts to avoid leaving open attendance
await client.attendance.clockOut();

return { success: true, attendanceId: record.id };
```

**Throws `OdooValidationError`** if the employee is already clocked in (Odoo enforces one open attendance per employee).

## `clockOut(employeeId?)`

Sets `check_out = now()` on the employee's current open attendance record:

```typescript testable id="att-clock-out" needs="client" creates="hr.attendance" expect="result.workedHours >= 0"
await client.attendance.clockIn();

// Simulate some work time...
const record = await client.attendance.clockOut();

console.log(`Worked ${record.worked_hours.toFixed(2)} hours`);
console.log(`From: ${record.check_in}`);
console.log(`To:   ${record.check_out}`);

return { workedHours: record.worked_hours };
```

**Throws `OdooValidationError`** if the employee is not currently clocked in.

## `getStatus(employeeId?)`

Returns the employee's current attendance status without modifying anything (READ):

```typescript testable id="att-status" needs="client" expect="result.success === true"
const status = await client.attendance.getStatus();

if (status.checkedIn) {
  console.log(`${status.employee[1]} is IN since ${status.currentAttendance!.check_in}`);
} else {
  console.log(`${status.employee[1]} is not currently in the office`);
}

return {
  success: true,
  checkedIn: status.checkedIn,
  employeeName: status.employee[1],
};
```

### `AttendanceStatus` structure

| Field | Type | Description |
|-------|------|-------------|
| `checkedIn` | `boolean` | Whether employee is currently clocked in |
| `employee` | `[number, string]` | Employee Many2one tuple `[id, name]` |
| `currentAttendance` | `AttendanceRecord \| null` | Open attendance record if clocked in |

## `list(options?)`

List attendance records with optional filters:

```typescript testable id="att-list" needs="client" expect="result.success === true"
const today = new Date().toISOString().split('T')[0];

const records = await client.attendance.list({
  dateFrom: today,
  dateTo: today,
  limit: 20,
});

const totalHours = records.reduce((sum, r) => sum + (r.worked_hours || 0), 0);
return { success: true, count: records.length, totalHours };
```

### `AttendanceListOptions`

| Option | Type | Description |
|--------|------|-------------|
| `employeeId` | `number` | Filter by specific employee |
| `dateFrom` | `string` | Start date `YYYY-MM-DD` |
| `dateTo` | `string` | End date `YYYY-MM-DD` |
| `limit` | `number` | Max records |
| `offset` | `number` | Pagination offset |

## `AttendanceRecord` Fields

| Field | Type | Notes |
|-------|------|-------|
| `id` | `number` | Record ID |
| `employee_id` | `[number, string]` | Employee Many2one tuple |
| `check_in` | `string` | UTC datetime string `YYYY-MM-DD HH:MM:SS` |
| `check_out` | `string \| false` | `false` if currently clocked in |
| `worked_hours` | `number` | Float — computed from check_in/check_out |

## Key Gotchas

**One open attendance per employee**: Odoo enforces this at the database level. Clocking in when already in raises `OdooValidationError`. Always check status first if you're unsure:

```typescript testable id="att-safe-clock-in" needs="client" creates="hr.attendance" expect="result.success === true"
const status = await client.attendance.getStatus();

if (!status.checkedIn) {
  await client.attendance.clockIn();
  await client.attendance.clockOut(); // Clean up
}

return { success: true };
```

**Datetimes are UTC**: `check_in` and `check_out` are stored in UTC. Convert to local time for display:

```typescript
const [record] = await client.read('hr.attendance', [id], ['check_in', 'check_out']);

if (record.check_in) {
  const localTime = new Date(record.check_in.replace(' ', 'T') + 'Z');
  console.log(`Clocked in at ${localTime.toLocaleTimeString()}`);
}
```

**Employee auto-resolution**: When `employeeId` is omitted, the service looks up the `hr.employee` linked to the current session's user. If no employee record exists for that user, it throws an error.

## Direct CRUD

For advanced use cases, work with `hr.attendance` directly:

```typescript testable id="att-direct-query" needs="client" expect="result.success === true"
// Query all attendance for a date range
const records = await client.searchRead('hr.attendance', [
  ['check_in', '>=', '2024-01-01 00:00:00'],
  ['check_in', '<', '2024-02-01 00:00:00'],
], {
  fields: ['employee_id', 'check_in', 'check_out', 'worked_hours'],
  order: 'check_in desc',
  limit: 100,
});

return { success: true, count: records.length };
```

---

See also:
- [Modules](./modules.md) — check if `hr_attendance` is installed
- [Timesheets](./timesheets.md) — track time on projects (related but different model)

For agent-optimized CLI examples, see the [odoo skill](../skills/odoo/).
