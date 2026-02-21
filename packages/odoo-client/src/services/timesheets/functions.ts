/**
 * Timesheet standalone functions — timer start/stop and time logging.
 *
 * Timer concept in Odoo timesheets is simple:
 * - A running clock = account.analytic.line with unit_amount = 0 (no duration)
 * - A stopped clock = account.analytic.line with unit_amount > 0 (duration filled)
 *
 * This is standard hr_timesheet behavior. The OCA module
 * `project_timesheet_time_control` adds UI buttons for this workflow,
 * but the data model needs nothing beyond the base module.
 *
 * We use create_date to compute elapsed time when stopping a timer.
 *
 * @see https://github.com/odoo/odoo/blob/17.0/addons/hr_timesheet/models/account_analytic_line.py
 * @see https://github.com/OCA/project/tree/17.0/project_timesheet_time_control
 */

import debug from 'debug';
import type { OdooClient } from '../../client/odoo-client';
import { OdooValidationError } from '../../types/errors';
import { resolveEmployeeId } from '../attendance/functions';
import type {
  TimesheetEntry,
  TimerStartOptions,
  LogTimeOptions,
  TimesheetListOptions,
} from './types';

const log = debug('odoo-client:timesheets');

/** Fields we always fetch for timesheet entries. */
const TIMESHEET_FIELDS = [
  'name',
  'date',
  'unit_amount',
  'project_id',
  'task_id',
  'employee_id',
  'create_date',
];

/**
 * Get the current date as YYYY-MM-DD.
 */
function today(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Start a timesheet timer — creates a line with no duration.
 *
 * An entry with unit_amount = 0 represents a running clock.
 * Call stopTimer() to compute elapsed time and fill in the duration.
 *
 * @param client  - Authenticated OdooClient
 * @param options - Timer options (description, projectId, optional taskId/employeeId)
 * @returns The created timesheet entry (unit_amount = 0)
 *
 * @throws OdooValidationError if description or projectId missing
 */
export async function startTimer(
  client: OdooClient,
  options: TimerStartOptions
): Promise<TimesheetEntry> {
  if (!options.description?.trim()) {
    throw new OdooValidationError(
      'Timesheet description is required. Describe the work being done.'
    );
  }
  if (!options.projectId) {
    throw new OdooValidationError(
      'Project ID is required for timesheet entries. ' +
        'The project must have allow_timesheets = true.'
    );
  }

  const empId = await resolveEmployeeId(client, options.employeeId);
  log('Starting timer for employee %d on project %d', empId, options.projectId);

  const values: Record<string, any> = {
    name: options.description.trim(),
    project_id: options.projectId,
    employee_id: empId,
    unit_amount: 0,
    date: today(),
  };

  if (options.taskId) {
    values.task_id = options.taskId;
  }

  const id = await client.create('account.analytic.line', values);
  log('Created timesheet entry %d with unit_amount=0 (running)', id);

  const [entry] = await client.read<TimesheetEntry>('account.analytic.line', id, TIMESHEET_FIELDS);
  return entry;
}

/**
 * Stop a running timesheet timer.
 *
 * Computes elapsed time from create_date to now and writes unit_amount.
 * After this call, the entry has unit_amount > 0 (closed).
 *
 * @param client      - Authenticated OdooClient
 * @param timesheetId - ID of the timesheet entry to stop (must have unit_amount = 0)
 * @returns The updated timesheet entry with duration filled in
 *
 * @throws OdooValidationError if the entry already has a duration
 */
export async function stopTimer(client: OdooClient, timesheetId: number): Promise<TimesheetEntry> {
  log('Stopping timer on entry %d', timesheetId);

  const [entry] = await client.read<TimesheetEntry>(
    'account.analytic.line',
    timesheetId,
    TIMESHEET_FIELDS
  );

  if (entry.unit_amount !== 0) {
    throw new OdooValidationError(
      `Timesheet entry ${timesheetId} is not a running timer ` +
        `(unit_amount = ${entry.unit_amount}). ` +
        'Only entries with unit_amount = 0 can be stopped.'
    );
  }

  // Compute elapsed time from create_date
  const createDate = (entry as any).create_date as string;
  if (!createDate) {
    throw new OdooValidationError(
      `Cannot determine start time for entry ${timesheetId}: create_date not available.`
    );
  }

  const startMs = new Date(createDate.replace(' ', 'T') + 'Z').getTime();
  const nowMs = Date.now();
  const elapsedHours = Math.max(0, (nowMs - startMs) / (1000 * 60 * 60));

  // Round to 2 decimal places, minimum 0.01 (36s) to avoid staying at 0 (= "running")
  const roundedHours = Math.max(0.01, Math.round(elapsedHours * 100) / 100);

  await client.write('account.analytic.line', timesheetId, {
    unit_amount: roundedHours,
  });
  log('Timer stopped on entry %d: %.2f hours (from %s)', timesheetId, roundedHours, createDate);

  const [updated] = await client.read<TimesheetEntry>(
    'account.analytic.line',
    timesheetId,
    TIMESHEET_FIELDS
  );
  return updated;
}

/**
 * Find running timers for an employee.
 *
 * Running timers are timesheet entries with unit_amount = 0.
 *
 * @param client     - Authenticated OdooClient
 * @param employeeId - Employee ID (omit for current user's employee)
 * @returns Array of timesheet entries with unit_amount = 0
 */
export async function getRunningTimers(
  client: OdooClient,
  employeeId?: number
): Promise<TimesheetEntry[]> {
  const empId = await resolveEmployeeId(client, employeeId);
  log('Looking for running timers for employee %d', empId);

  return client.searchRead<TimesheetEntry>(
    'account.analytic.line',
    [
      ['employee_id', '=', empId],
      ['unit_amount', '=', 0],
      ['project_id', '!=', false],
    ],
    {
      fields: TIMESHEET_FIELDS,
      order: 'create_date desc',
    }
  );
}

/**
 * Log a completed timesheet entry (no timer, just hours).
 *
 * Creates an account.analytic.line with unit_amount already set.
 *
 * @param client  - Authenticated OdooClient
 * @param options - Time log options
 * @returns The created timesheet entry
 *
 * @throws OdooValidationError if required fields missing or hours <= 0
 */
export async function logTime(
  client: OdooClient,
  options: LogTimeOptions
): Promise<TimesheetEntry> {
  if (!options.description?.trim()) {
    throw new OdooValidationError('Timesheet description is required. Describe the work done.');
  }
  if (!options.projectId) {
    throw new OdooValidationError('Project ID is required for timesheet entries.');
  }
  if (!options.hours || options.hours <= 0) {
    throw new OdooValidationError(
      `Hours must be greater than 0 (got: ${options.hours}). ` +
        'Use startTimer() for entries where duration is unknown.'
    );
  }

  const empId = await resolveEmployeeId(client, options.employeeId);
  log('Logging %f hours for employee %d on project %d', options.hours, empId, options.projectId);

  const values: Record<string, any> = {
    name: options.description.trim(),
    project_id: options.projectId,
    employee_id: empId,
    unit_amount: options.hours,
    date: options.date ?? today(),
  };

  if (options.taskId) {
    values.task_id = options.taskId;
  }

  const id = await client.create('account.analytic.line', values);
  log('Logged timesheet entry %d: %f hours', id, options.hours);

  const [entry] = await client.read<TimesheetEntry>('account.analytic.line', id, TIMESHEET_FIELDS);
  return entry;
}

/**
 * List timesheet entries with optional filters.
 *
 * @param client  - Authenticated OdooClient
 * @param options - Filter and pagination options
 * @returns Array of timesheet entries
 */
export async function listTimesheets(
  client: OdooClient,
  options: TimesheetListOptions = {}
): Promise<TimesheetEntry[]> {
  const domain: any[] = [];

  if (options.employeeId) {
    domain.push(['employee_id', '=', options.employeeId]);
  }
  if (options.projectId) {
    domain.push(['project_id', '=', options.projectId]);
  }
  if (options.taskId) {
    domain.push(['task_id', '=', options.taskId]);
  }
  if (options.dateFrom) {
    domain.push(['date', '>=', options.dateFrom]);
  }
  if (options.dateTo) {
    domain.push(['date', '<=', options.dateTo]);
  }
  if (options.runningOnly) {
    domain.push(['unit_amount', '=', 0]);
  }

  // Ensure we only get timesheet lines (not generic analytic lines)
  if (!options.projectId) {
    domain.push(['project_id', '!=', false]);
  }

  log('Listing timesheets with domain: %o', domain);

  return client.searchRead<TimesheetEntry>('account.analytic.line', domain, {
    fields: TIMESHEET_FIELDS,
    limit: options.limit,
    offset: options.offset,
    order: options.order ?? 'date desc, id desc',
  });
}
