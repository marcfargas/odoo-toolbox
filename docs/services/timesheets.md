# Timesheets Service — `client.timesheets.*`

Track time spent on projects and tasks. Uses the `account.analytic.line` model.

**Requires:** `hr_timesheet` module. Check before using:

```typescript testable id="ts-check-module" needs="client" expect="typeof result === 'boolean'"
const installed = await client.modules.isModuleInstalled('hr_timesheet');
return installed;
```

**Safety:** All write methods are **WRITE** level.

## Two Workflows

| Workflow | Methods | Use when |
|----------|---------|---------|
| **Timer** | `startTimer()` → `stopTimer()` | Time is tracked in real-time as work happens |
| **Manual** | `logTime()` | Duration is already known (logging past work) |

```typescript
// Timer workflow
const entry = await client.timesheets.startTimer({
  description: 'Implementing login feature',
  projectId: 5,
  taskId: 42,
});
// ... do work ...
const stopped = await client.timesheets.stopTimer(entry.id);
console.log(`Logged ${stopped.unit_amount.toFixed(2)} hours`);

// Manual workflow
const entry = await client.timesheets.logTime({
  description: 'Code review for PR #42',
  projectId: 5,
  hours: 1.5,
});
```

## `startTimer(options)` — Timer

Creates a timesheet entry and starts the clock. Duration accumulates until `stopTimer()` is called.

```typescript testable id="ts-start-timer" needs="client" creates="account.analytic.line" expect="result.success === true"
const [project] = await client.searchRead('project.project', [
  ['allow_timesheets', '=', true],
], { fields: ['id', 'name'], limit: 1 });

if (!project) throw new Error('No project with timesheets enabled found');

const entry = await client.timesheets.startTimer({
  description: 'Working on feature',
  projectId: project.id,
});

console.log(`Timer started: entry ID ${entry.id}`);
console.log(`unit_amount = ${entry.unit_amount} (0 = running)`);

// Stop the timer
await client.timesheets.stopTimer(entry.id);

return { success: true, entryId: entry.id };
```

### `TimerStartOptions`

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `description` | `string` | ✅ | Work description (maps to `name` field) |
| `projectId` | `number` | ✅ | Project must have `allow_timesheets = true` |
| `taskId` | `number` | — | Task within the project |
| `employeeId` | `number` | — | Defaults to current user's employee |

## `stopTimer(timesheetId)` — Timer

Stops a running timer and writes the computed elapsed time to `unit_amount`:

```typescript testable id="ts-stop-timer" needs="client" creates="account.analytic.line" expect="result.hoursLogged >= 0"
const [project] = await client.searchRead('project.project', [
  ['allow_timesheets', '=', true],
], { fields: ['id'], limit: 1 });

const entry = await client.timesheets.startTimer({
  description: 'Quick task',
  projectId: project.id,
});

await new Promise(resolve => setTimeout(resolve, 200)); // Simulate work

const stopped = await client.timesheets.stopTimer(entry.id);

console.log(`Logged ${stopped.unit_amount.toFixed(4)} hours`);
return { hoursLogged: stopped.unit_amount };
```

## `getRunningTimers(employeeId?)`

Find all entries with running timers (usually 0 or 1 — employees typically have at most one timer running):

```typescript testable id="ts-running-timers" needs="client" expect="result.success === true"
const running = await client.timesheets.getRunningTimers();

if (running.length > 0) {
  console.log(`${running.length} timer(s) running`);
  for (const entry of running) {
    console.log(`  - ${entry.name} (project: ${entry.project_id[1]})`);
  }
} else {
  console.log('No timers running');
}

return { success: true, count: running.length };
```

## `logTime(options)` — Manual

Log completed work with a known duration:

```typescript testable id="ts-log-time" needs="client" creates="account.analytic.line" expect="result.hours === 1.5"
const [project] = await client.searchRead('project.project', [
  ['allow_timesheets', '=', true],
], { fields: ['id'], limit: 1 });

const entry = await client.timesheets.logTime({
  description: 'Code review for PR #47',
  projectId: project.id,
  hours: 1.5,
});

return { hours: entry.unit_amount };
```

### `LogTimeOptions`

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `description` | `string` | ✅ | Work description |
| `projectId` | `number` | ✅ | Project with timesheets enabled |
| `hours` | `number` | ✅ | Duration in decimal hours (e.g., `1.5` = 1h30m) |
| `taskId` | `number` | — | Task within the project |
| `date` | `string` | — | Date `YYYY-MM-DD` (defaults to today) |
| `employeeId` | `number` | — | Defaults to current user's employee |

## `list(options?)`

List timesheet entries with optional filters:

```typescript testable id="ts-list" needs="client" expect="result.success === true"
const today = new Date();
const weekStart = new Date(today);
weekStart.setDate(today.getDate() - today.getDay()); // Start of week

const entries = await client.timesheets.list({
  dateFrom: weekStart.toISOString().split('T')[0],
  dateTo: today.toISOString().split('T')[0],
  limit: 50,
});

const totalHours = entries.reduce((sum, e) => sum + (e.unit_amount || 0), 0);
return { success: true, count: entries.length, totalHours };
```

### `TimesheetListOptions`

| Option | Type | Description |
|--------|------|-------------|
| `employeeId` | `number` | Filter by employee |
| `projectId` | `number` | Filter by project |
| `taskId` | `number` | Filter by task |
| `dateFrom` | `string` | Start date `YYYY-MM-DD` |
| `dateTo` | `string` | End date `YYYY-MM-DD` |
| `limit` | `number` | Max results |
| `offset` | `number` | Pagination offset |

## `TimesheetEntry` Fields

| Field | Type | Notes |
|-------|------|-------|
| `id` | `number` | Record ID |
| `name` | `string` | Description (required) |
| `date` | `string` | Date `YYYY-MM-DD` |
| `unit_amount` | `number` | Hours. `0` = timer running, `> 0` = duration |
| `project_id` | `[number, string]` | Project Many2one |
| `task_id` | `[number, string] \| false` | Task (optional) |
| `employee_id` | `[number, string]` | Employee Many2one |
| `amount` | `number` | Monetary cost (computed: `unit_amount × hourly_cost`) |

## Timer Architecture

Under the hood, timers use a simple convention on `account.analytic.line`:

- **Running**: entry with `unit_amount = 0`
- **Stopped**: entry with `unit_amount > 0` (duration from `create_date` to stop time)

`startTimer()` creates an entry with `unit_amount = 0`. `stopTimer()` computes elapsed time and writes it. `getRunningTimers()` queries `unit_amount = 0`.

This is standard Odoo `hr_timesheet` behavior — no extra modules required.

## Direct CRUD

For advanced use cases, query `account.analytic.line` directly:

```typescript testable id="ts-direct-crud" needs="client" creates="account.analytic.line" expect="result.id > 0"
const [project] = await client.searchRead('project.project', [
  ['allow_timesheets', '=', true],
], { fields: ['id'], limit: 1 });

const session = client.getSession();
const [employee] = await client.searchRead('hr.employee', [
  ['user_id', '=', session?.uid],
], { fields: ['id'], limit: 1 });

const id = await client.create('account.analytic.line', {
  name: 'Direct entry',
  project_id: project.id,
  employee_id: employee?.id,
  unit_amount: 2.0,
  date: new Date().toISOString().split('T')[0],
});

return { id };
```

## Weekly Summary Pattern

```typescript testable id="ts-weekly-summary" needs="client" expect="result.success === true"
const today = new Date();
const weekStart = new Date(today);
weekStart.setDate(today.getDate() - today.getDay());

const entries = await client.timesheets.list({
  dateFrom: weekStart.toISOString().split('T')[0],
  dateTo: today.toISOString().split('T')[0],
});

// Group by project
const byProject: Record<string, number> = {};
for (const entry of entries) {
  const projectName = entry.project_id ? entry.project_id[1] : 'No project';
  byProject[projectName] = (byProject[projectName] || 0) + entry.unit_amount;
}

for (const [project, hours] of Object.entries(byProject)) {
  console.log(`  ${project}: ${hours.toFixed(2)}h`);
}

return { success: true, totalProjects: Object.keys(byProject).length };
```

---

See also:
- [Attendance](./attendance.md) — physical clock-in/out (different model, different purpose)
- [Modules](./modules.md) — check if `hr_timesheet` is installed

For agent-optimized CLI examples, see the [odoo skill](../skills/odoo/).
