# Attendance (hr_attendance)

Clock in/out tracking for employee presence. Requires `hr_attendance` module.

## CLI

Requires: `hr_attendance` Odoo module.

**Safety:**
- `status`, `list` — READ (no confirmation)
- `clock-in`, `clock-out` — WRITE (requires `--confirm`)

All commands accept `--employee-id <n>` (default: current user's employee).

### Check current status [READ]

```bash
odoo attendance status
# ● IN  since 09:02 (2h 15m elapsed)
# — or —
# ○ OUT  — John Doe is not clocked in

# JSON output for scripting
odoo attendance status --format json
```

### Clock in [WRITE]

```bash
# Clock in as current user
odoo attendance clock-in --confirm

# Clock in for a specific employee by ID
odoo attendance clock-in --employee-id 42 --confirm

# Dry run
odoo attendance clock-in --confirm --dry-run
```

**Exit code 6** if already clocked in.

### Clock out [WRITE]

```bash
odoo attendance clock-out --confirm
```

**Output:** `✓ Clocked out: John Doe — worked 3h 45m today`

**Exit code 6** if not currently clocked in.

### List attendance records [READ]

```bash
# Current week (default)
odoo attendance list

# Custom date range
odoo attendance list --from 2024-03-11 --to 2024-03-15

# Export as CSV
odoo attendance list --from 2024-03-01 --to 2024-03-31 --format csv > march-attendance.csv

# Filter by employee
odoo attendance list --employee-id 42 --from 2024-03-01
```

---

## Library API

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
