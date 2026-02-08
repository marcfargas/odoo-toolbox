# Timesheets (hr_timesheet)

Track employee time on projects and tasks using Odoo's timesheet system.

## Overview

The `hr_timesheet` module allows employees to log time spent on projects and tasks. Time entries are stored in `account.analytic.line` with project/task context.

## Prerequisites

- Authenticated OdooClient connection
- Module: **hr_timesheet** (must be installed)
- Depends on: **project**, **hr**, **analytic**

## Key Models

| Model | Description |
|-------|-------------|
| `account.analytic.line` | Timesheet entries (hours logged) |
| `project.project` | Projects (must have `allow_timesheets=true`) |
| `project.task` | Tasks within projects |
| `hr.employee` | Employees who log time |

## Field Reference

### account.analytic.line (Timesheet Entry)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | Char | Yes | Description of work done |
| `date` | Date | Yes | Date of the timesheet entry |
| `unit_amount` | Float | No | Hours logged (quantity) |
| `project_id` | Many2one → project.project | No | Project being worked on |
| `task_id` | Many2one → project.task | No | Specific task (filtered by project) |
| `employee_id` | Many2one → hr.employee | No | Employee logging time (defaults to current user's employee) |
| `company_id` | Many2one → res.company | Yes | Company (defaults to current) |
| `amount` | Monetary | Yes | Cost amount (auto-calculated from hourly cost) |
| `user_id` | Many2one → res.users | No | Related user |

## Checking Module Installation

```typescript testable id="timesheets-check-module" needs="client" expect="result.installed === true"
// Check if hr_timesheet module is installed via service accessor
const installed = await client.modules.isModuleInstalled('hr_timesheet');

return { installed };
```

## Creating Timesheet Entries

### Basic Timesheet Entry

```typescript testable id="timesheets-create-basic" needs="client" creates="account.analytic.line" expect="result.timesheetId > 0"
// Find a project with timesheets enabled
const [project] = await client.searchRead('project.project', [
  ['allow_timesheets', '=', true]
], { fields: ['id', 'name'], limit: 1 });

if (!project) {
  throw new Error('No project with timesheets enabled');
}

// Get current user's employee
const session = client.getSession();
const [employee] = await client.searchRead('hr.employee', [
  ['user_id', '=', session?.uid]
], { fields: ['id', 'name'], limit: 1 });

// Create timesheet entry
const timesheetId = await client.create('account.analytic.line', {
  name: 'Development work',
  project_id: project.id,
  employee_id: employee?.id || false,
  unit_amount: 2.0,  // 2 hours
  date: new Date().toISOString().split('T')[0]  // Today
});

trackRecord('account.analytic.line', timesheetId);
return { timesheetId, projectName: project.name };
```

### Timesheet with Task

```typescript testable id="timesheets-create-with-task" needs="client" creates="account.analytic.line" expect="result.timesheetId > 0"
// Find a project with timesheets
const [project] = await client.searchRead('project.project', [
  ['allow_timesheets', '=', true]
], { fields: ['id'], limit: 1 });

// Find a task in that project
const [task] = await client.searchRead('project.task', [
  ['project_id', '=', project.id]
], { fields: ['id', 'name'], limit: 1 });

// Create timesheet with task reference
const timesheetId = await client.create('account.analytic.line', {
  name: 'Task-specific work',
  project_id: project.id,
  task_id: task?.id || false,
  unit_amount: 1.5,  // 1.5 hours
  date: new Date().toISOString().split('T')[0]
});

trackRecord('account.analytic.line', timesheetId);
return {
  timesheetId,
  taskName: task?.name || 'No task',
  hasTask: !!task
};
```

## Reading Timesheet Entries

### Get Timesheets for a Project

```typescript testable id="timesheets-read-by-project" needs="client" expect="result.success === true"
// Find a project with timesheets
const [project] = await client.searchRead('project.project', [
  ['allow_timesheets', '=', true]
], { fields: ['id', 'name'], limit: 1 });

// Get all timesheet entries for this project
const timesheets = await client.searchRead('account.analytic.line', [
  ['project_id', '=', project.id]
], {
  fields: ['name', 'date', 'unit_amount', 'employee_id', 'task_id'],
  order: 'date desc',
  limit: 20
});

// Calculate total hours
const totalHours = timesheets.reduce((sum, ts) => sum + (ts.unit_amount || 0), 0);

return {
  success: true,
  projectName: project.name,
  entryCount: timesheets.length,
  totalHours,
  entries: timesheets.map(ts => ({
    date: ts.date,
    hours: ts.unit_amount,
    description: ts.name,
    employee: ts.employee_id?.[1] || 'Unknown'
  }))
};
```

### Get Timesheets for an Employee

```typescript testable id="timesheets-read-by-employee" needs="client" expect="result.success === true"
// Get current user's employee
const session = client.getSession();
const [employee] = await client.searchRead('hr.employee', [
  ['user_id', '=', session?.uid]
], { fields: ['id', 'name'], limit: 1 });

if (!employee) {
  return { success: true, message: 'No employee record for current user' };
}

// Get timesheet entries for this week
const today = new Date();
const weekStart = new Date(today);
weekStart.setDate(today.getDate() - today.getDay());

const timesheets = await client.searchRead('account.analytic.line', [
  ['employee_id', '=', employee.id],
  ['date', '>=', weekStart.toISOString().split('T')[0]]
], {
  fields: ['name', 'date', 'unit_amount', 'project_id', 'task_id'],
  order: 'date asc'
});

const totalHours = timesheets.reduce((sum, ts) => sum + (ts.unit_amount || 0), 0);

return {
  success: true,
  employeeName: employee.name,
  weeklyEntries: timesheets.length,
  weeklyHours: totalHours
};
```

### Get Timesheets for a Task

```typescript
// Get all time logged on a specific task
const timesheets = await client.searchRead('account.analytic.line', [
  ['task_id', '=', taskId]
], {
  fields: ['name', 'date', 'unit_amount', 'employee_id'],
  order: 'date desc'
});

const totalHours = timesheets.reduce((sum, ts) => sum + ts.unit_amount, 0);
console.log(`Task has ${totalHours} hours logged across ${timesheets.length} entries`);
```

## Updating Timesheet Entries

```typescript testable id="timesheets-update" needs="client" creates="account.analytic.line" expect="result.updated === true"
// Create a test entry first
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

// Update the entry
await client.write('account.analytic.line', timesheetId, {
  name: 'Updated: Added more detail about work done',
  unit_amount: 2.5  // Changed from 1 hour to 2.5 hours
});

// Verify the update
const [updated] = await client.read('account.analytic.line', timesheetId, [
  'name', 'unit_amount'
]);

return {
  updated: updated.unit_amount === 2.5,
  newHours: updated.unit_amount,
  newDescription: updated.name
};
```

## Deleting Timesheet Entries

```typescript testable id="timesheets-delete" needs="client" expect="result.deleted === true"
// Create a temporary entry
const [project] = await client.searchRead('project.project', [
  ['allow_timesheets', '=', true]
], { fields: ['id'], limit: 1 });

const timesheetId = await client.create('account.analytic.line', {
  name: 'Entry to delete',
  project_id: project.id,
  unit_amount: 0.5,
  date: new Date().toISOString().split('T')[0]
});

// Delete the entry
await client.unlink('account.analytic.line', timesheetId);

// Verify deletion
const remaining = await client.search('account.analytic.line', [
  ['id', '=', timesheetId]
]);

return { deleted: remaining.length === 0 };
```

## Project and Task Setup

### Check if Project Has Timesheets Enabled

```typescript testable id="timesheets-project-check" needs="client" expect="result.success === true"
// Get projects and their timesheet status
const projects = await client.searchRead('project.project', [], {
  fields: ['name', 'allow_timesheets'],
  limit: 10
});

const withTimesheets = projects.filter(p => p.allow_timesheets);
const withoutTimesheets = projects.filter(p => !p.allow_timesheets);

return {
  success: true,
  totalProjects: projects.length,
  withTimesheets: withTimesheets.length,
  withoutTimesheets: withoutTimesheets.length,
  projectList: projects.map(p => ({
    name: p.name,
    timesheetsEnabled: p.allow_timesheets
  }))
};
```

### Enable Timesheets on a Project

```typescript
// Enable timesheets on an existing project
await client.write('project.project', projectId, {
  allow_timesheets: true
});
```

## Aggregating Time Data

### Sum Hours by Project

```typescript
// Using read_group for aggregation
const totals = await client.call('account.analytic.line', 'read_group', [
  [],  // domain (all entries)
  ['unit_amount:sum'],  // fields to aggregate
  ['project_id']  // group by
], {});

console.log('Hours by project:');
for (const group of totals) {
  console.log(`  ${group.project_id?.[1] || 'No project'}: ${group.unit_amount} hours`);
}
```

### Sum Hours by Employee for Date Range

```typescript
// Get hours per employee for a specific month
const startDate = '2026-02-01';
const endDate = '2026-02-28';

const totals = await client.call('account.analytic.line', 'read_group', [
  [
    ['date', '>=', startDate],
    ['date', '<=', endDate]
  ],
  ['unit_amount:sum'],
  ['employee_id']
], {});

console.log(`Hours by employee (${startDate} to ${endDate}):`);
for (const group of totals) {
  console.log(`  ${group.employee_id?.[1] || 'Unknown'}: ${group.unit_amount} hours`);
}
```

## Important Notes

### Project Requirement

Timesheet entries are typically linked to a project. The project must have `allow_timesheets = true`:

```typescript
// Only projects with timesheets enabled can receive timesheet entries
const timesheetProjects = await client.searchRead('project.project', [
  ['allow_timesheets', '=', true]
], { fields: ['name'] });
```

### Task Domain Filter

When selecting a task, Odoo automatically filters to tasks from the selected project:
- Domain: `[('allow_timesheets', '=', True), ('project_id', '=?', project_id)]`

### Employee vs User

- `employee_id` - Links to `hr.employee` record
- `user_id` - Links to `res.users` record
- An employee is typically linked to a user via `hr.employee.user_id`
- Defaults use the current user's employee record

### Cost Calculation

The `amount` field is calculated based on:
- `unit_amount` (hours) x employee's `hourly_cost`
- Set hourly cost on `hr.employee.hourly_cost`

## Related Documents

- [crud.md](../base/crud.md) - CRUD operations
- [search.md](../base/search.md) - Search patterns
- [domains.md](../base/domains.md) - Domain filters