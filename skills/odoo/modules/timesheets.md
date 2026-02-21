# Timesheets (hr_timesheet)

Track time on projects/tasks. Requires `hr_timesheet` module. Model: `account.analytic.line`.

## CLI

Requires: `hr_timesheet` Odoo module.

**Safety:**
- `running`, `list` — READ (no confirmation)
- `start`, `stop`, `log` — WRITE (requires `--confirm`)

All commands accept `--employee-id <n>` (default: current user's employee).

### Timer workflow (start → work → stop)

```bash
# Start a timer on a task
odoo timesheets start --task-id 42 --description "Fixing login bug" --confirm

# Start on a project (no task)
odoo timesheets start --project-id 5 --description "Project work" --confirm

# Check what's running
odoo timesheets running
# ● RUNNING: Task#42 "Login Fix" — started 2024-03-15 09:02 (1h 23m elapsed)

# Stop the running timer
odoo timesheets stop --confirm
# ✓ Stopped: Task#42 "Login Fix" — 1h 23m logged
```

**Notes:**
- `--task-id` OR `--project-id` is required for `start`.
- `--description` is required for `start`.
- `timesheets running` exits with code `3` if no timer is running — useful in scripts.

### Log time manually (retroactive)

```bash
# Hours as decimal
odoo timesheets log --task-id 42 --hours 2.5 --description "Code review" --confirm

# Hours as H:MM
odoo timesheets log --task-id 42 --hours 1:30 --description "Pair programming" --confirm

# Specific date (default: today)
odoo timesheets log --task-id 42 --hours 3.0 --date 2024-03-14 \
  --description "API integration" --confirm

# From CI — log deploy time
odoo timesheets log --task-id $ODOO_TASK --hours 0.25 \
  --description "Deploy $CI_COMMIT_SHA" --confirm
```

### List timesheet entries [READ]

```bash
# Current user's timesheets
odoo timesheets list

# By date range
odoo timesheets list --from 2024-03-11 --to 2024-03-15

# By project
odoo timesheets list --project-id 5

# By task
odoo timesheets list --task-id 42

# Export as CSV
odoo timesheets list --from 2024-03-01 --to 2024-03-31 --format csv > march-time.csv
```

### Flags

| Flag | Command | Description |
|------|---------|-------------|
| `--task-id <n>` | `start`, `log` | Task to log time on |
| `--project-id <n>` | `start`, `log` | Project (required if no task) |
| `--description <text>` | `start`, `log` | Description of work (required for `start`) |
| `--hours <h>` | `log` | Hours: decimal (`1.5`) or H:MM (`1:30`) |
| `--date <date>` | `log` | Date YYYY-MM-DD (default: today) |
| `--employee-id <n>` | all | Override employee (default: current user) |
| `--from <date>` | `list` | Start date for list |
| `--to <date>` | `list` | End date for list |
| `--confirm` | `start`, `stop`, `log` | Required (WRITE operation) |
| `--dry-run` | `start`, `stop`, `log` | Simulate without executing |

---

## Library API

Two workflows: **timer** (start→work→stop) or **manual** (log completed hours).

```typescript
const client = await createClient();

// Timer
const entry = await client.timesheets.startTimer({ description: 'Dev work', projectId: 5, taskId: 42 });
const stopped = await client.timesheets.stopTimer(entry.id);

// Manual
await client.timesheets.logTime({ description: 'Code review', projectId: 5, hours: 1.5 });

// Query
const running = await client.timesheets.getRunningTimers();
const entries = await client.timesheets.list({ projectId: 5 });
```

All methods accept optional `employeeId` (defaults to current user's employee).

## Check Module

```typescript testable id="timesheets-check-module" needs="client" expect="result.installed === true"
const installed = await client.modules.isModuleInstalled('hr_timesheet');
return { installed };
```

## Timer Operations

### Start Timer

```typescript testable id="timesheets-start-timer" needs="client" creates="account.analytic.line" expect="result.success === true"
const [project] = await client.searchRead('project.project', [
  ['allow_timesheets', '=', true]
], { fields: ['id', 'name'], limit: 1 });

if (!project) throw new Error('No project with timesheets enabled');

const entry = await client.timesheets.startTimer({
  description: 'Working on feature X',
  projectId: project.id,
});
trackRecord('account.analytic.line', entry.id);

const isRunning = entry.unit_amount === 0;  // Running = unit_amount is 0

await client.timesheets.stopTimer(entry.id);

return { success: true, entryId: entry.id, wasRunning: isRunning };
```

### Stop Timer

```typescript testable id="timesheets-stop-timer" needs="client" creates="account.analytic.line" expect="result.success === true"
const [project] = await client.searchRead('project.project', [
  ['allow_timesheets', '=', true]
], { fields: ['id'], limit: 1 });

const entry = await client.timesheets.startTimer({
  description: 'Timer to stop',
  projectId: project.id,
});
trackRecord('account.analytic.line', entry.id);

await new Promise(resolve => setTimeout(resolve, 500));

const stopped = await client.timesheets.stopTimer(entry.id);

return { success: true, hoursLogged: stopped.unit_amount, timerStopped: stopped.unit_amount > 0 };
```

### Find Running Timers

```typescript testable id="timesheets-running-timers" needs="client" expect="result.success === true"
const running = await client.timesheets.getRunningTimers();

return { success: true, runningCount: running.length };
```

## Manual Logging

```typescript testable id="timesheets-log-time" needs="client" creates="account.analytic.line" expect="result.success === true"
const [project] = await client.searchRead('project.project', [
  ['allow_timesheets', '=', true]
], { fields: ['id'], limit: 1 });

const entry = await client.timesheets.logTime({
  description: 'Completed code review',
  projectId: project.id,
  hours: 1.5,
});
trackRecord('account.analytic.line', entry.id);

return { success: true, entryId: entry.id, hours: entry.unit_amount };
```

## List Entries

```typescript testable id="timesheets-list" needs="client" expect="result.success === true"
const entries = await client.timesheets.list({ limit: 10 });
const totalHours = entries.reduce((sum, e) => sum + (e.unit_amount || 0), 0);

return { success: true, count: entries.length, totalHours };
```

## Direct CRUD

```typescript testable id="timesheets-create-basic" needs="client" creates="account.analytic.line" expect="result.timesheetId > 0"
const [project] = await client.searchRead('project.project', [
  ['allow_timesheets', '=', true]
], { fields: ['id', 'name'], limit: 1 });

const session = client.getSession();
const [employee] = await client.searchRead('hr.employee', [
  ['user_id', '=', session?.uid]
], { fields: ['id'], limit: 1 });

const timesheetId = await client.create('account.analytic.line', {
  name: 'Development work',
  project_id: project.id,
  employee_id: employee?.id || false,
  unit_amount: 2.0,
  date: new Date().toISOString().split('T')[0]
});

trackRecord('account.analytic.line', timesheetId);
return { timesheetId, projectName: project.name };
```

```typescript testable id="timesheets-create-with-task" needs="client" creates="account.analytic.line" expect="result.timesheetId > 0"
const [project] = await client.searchRead('project.project', [
  ['allow_timesheets', '=', true]
], { fields: ['id'], limit: 1 });

const [task] = await client.searchRead('project.task', [
  ['project_id', '=', project.id]
], { fields: ['id', 'name'], limit: 1 });

const timesheetId = await client.create('account.analytic.line', {
  name: 'Task-specific work',
  project_id: project.id,
  task_id: task?.id || false,
  unit_amount: 1.5,
  date: new Date().toISOString().split('T')[0]
});

trackRecord('account.analytic.line', timesheetId);
return { timesheetId, taskName: task?.name || 'No task', hasTask: !!task };
```

```typescript testable id="timesheets-read-by-project" needs="client" expect="result.success === true"
const [project] = await client.searchRead('project.project', [
  ['allow_timesheets', '=', true]
], { fields: ['id', 'name'], limit: 1 });

const timesheets = await client.searchRead('account.analytic.line', [
  ['project_id', '=', project.id]
], {
  fields: ['name', 'date', 'unit_amount', 'employee_id', 'task_id'],
  order: 'date desc',
  limit: 20
});

const totalHours = timesheets.reduce((sum, ts) => sum + (ts.unit_amount || 0), 0);

return { success: true, projectName: project.name, entryCount: timesheets.length, totalHours };
```

```typescript testable id="timesheets-read-by-employee" needs="client" expect="result.success === true"
const session = client.getSession();
const [employee] = await client.searchRead('hr.employee', [
  ['user_id', '=', session?.uid]
], { fields: ['id', 'name'], limit: 1 });

if (!employee) {
  return { success: true, message: 'No employee record for current user' };
}

const today = new Date();
const weekStart = new Date(today);
weekStart.setDate(today.getDate() - today.getDay());

const timesheets = await client.searchRead('account.analytic.line', [
  ['employee_id', '=', employee.id],
  ['date', '>=', weekStart.toISOString().split('T')[0]]
], {
  fields: ['name', 'date', 'unit_amount', 'project_id'],
  order: 'date asc'
});

const totalHours = timesheets.reduce((sum, ts) => sum + (ts.unit_amount || 0), 0);

return { success: true, employeeName: employee.name, weeklyEntries: timesheets.length, weeklyHours: totalHours };
```

```typescript testable id="timesheets-update" needs="client" creates="account.analytic.line" expect="result.updated === true"
const [project] = await client.searchRead('project.project', [
  ['allow_timesheets', '=', true]
], { fields: ['id'], limit: 1 });

const timesheetId = await client.create('account.analytic.line', {
  name: 'Initial description',
  project_id: project.id,
  unit_amount: 1.0,
  date: new Date().toISOString().split('T')[0]
});
trackRecord('account.analytic.line', timesheetId);

await client.write('account.analytic.line', timesheetId, {
  name: 'Updated: more detail',
  unit_amount: 2.5
});

const [updated] = await client.read('account.analytic.line', timesheetId, ['name', 'unit_amount']);

return { updated: updated.unit_amount === 2.5 };
```

```typescript testable id="timesheets-delete" needs="client" expect="result.deleted === true"
const [project] = await client.searchRead('project.project', [
  ['allow_timesheets', '=', true]
], { fields: ['id'], limit: 1 });

const timesheetId = await client.create('account.analytic.line', {
  name: 'Entry to delete',
  project_id: project.id,
  unit_amount: 0.5,
  date: new Date().toISOString().split('T')[0]
});

await client.unlink('account.analytic.line', timesheetId);
const remaining = await client.search('account.analytic.line', [['id', '=', timesheetId]]);

return { deleted: remaining.length === 0 };
```

```typescript testable id="timesheets-project-check" needs="client" expect="result.success === true"
const projects = await client.searchRead('project.project', [], {
  fields: ['name', 'allow_timesheets'],
  limit: 10
});

const withTimesheets = projects.filter(p => p.allow_timesheets);

return { success: true, totalProjects: projects.length, withTimesheets: withTimesheets.length };
```

## Timer Architecture

- **Running** = entry with `unit_amount = 0`
- **Stopped** = `unit_amount > 0` (duration computed from `create_date`)
- `startTimer()` creates entry with `unit_amount = 0`
- `stopTimer()` computes elapsed, writes `unit_amount`
- `getRunningTimers()` searches `unit_amount = 0`

## Key Fields (account.analytic.line)

| Field | Type | Notes |
|-------|------|-------|
| `name` | Char | Required — description of work |
| `date` | Date | Required |
| `unit_amount` | Float | Hours (0 = timer running) |
| `project_id` | Many2one | Must have `allow_timesheets=true` |
| `task_id` | Many2one | Filtered by project |
| `employee_id` | Many2one | Defaults to current user's employee |
| `amount` | Monetary | Auto-computed from `unit_amount × hourly_cost` |
