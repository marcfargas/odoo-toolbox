/**
 * Timesheets service — the typed interface exposed via `client.timesheets.*`
 *
 * Delegates to standalone functions in functions.ts.
 *
 * Timer concept: unit_amount = 0 means running, unit_amount > 0 means closed.
 * This is standard hr_timesheet behavior — no extra modules needed.
 *
 * Requires the `hr_timesheet` module to be installed.
 *
 * @see https://github.com/odoo/odoo/blob/17.0/addons/hr_timesheet/models/account_analytic_line.py
 */

import type { OdooClient } from '../../client/odoo-client';
import type {
  TimesheetEntry,
  TimerStartOptions,
  LogTimeOptions,
  TimesheetListOptions,
} from './types';
import {
  startTimer as _startTimer,
  stopTimer as _stopTimer,
  getRunningTimers as _getRunningTimers,
  logTime as _logTime,
  listTimesheets as _listTimesheets,
} from './functions';

/**
 * Timesheets service for managing time tracking on projects and tasks.
 *
 * Access via `client.timesheets` — never instantiate directly.
 *
 * Two workflows:
 * 1. **Timer-based**: startTimer() → work → stopTimer() (duration auto-computed)
 * 2. **Manual**: logTime() with known hours (e.g., logging past work)
 *
 * All methods accept an optional employeeId. When omitted, the current
 * user's linked hr.employee record is used automatically.
 */
export class TimesheetsService {
  /** @internal */
  constructor(private client: OdooClient) {}

  /**
   * Start a timesheet timer.
   *
   * Creates a timesheet entry and starts the clock. Duration is tracked
   * automatically until stopTimer() is called.
   *
   * @param options - Description, projectId, optional taskId/employeeId
   * @returns The created timesheet entry with timer running
   *
   * @example
   * ```typescript
   * const entry = await client.timesheets.startTimer({
   *   description: 'Implementing login feature',
   *   projectId: 5,
   *   taskId: 42,
   * });
   * console.log(`Timer started: ${entry.id}`);
   * ```
   */
  async startTimer(options: TimerStartOptions): Promise<TimesheetEntry> {
    return _startTimer(this.client, options);
  }

  /**
   * Stop a running timesheet timer.
   *
   * Computes the elapsed time and saves it to the entry's unit_amount.
   *
   * @param timesheetId - ID of the timesheet entry with a running timer
   * @returns The updated entry with hours filled in
   * @throws OdooValidationError if no running timer on this entry
   *
   * @example
   * ```typescript
   * const entry = await client.timesheets.stopTimer(123);
   * console.log(`Logged ${entry.unit_amount.toFixed(2)} hours`);
   * ```
   */
  async stopTimer(timesheetId: number): Promise<TimesheetEntry> {
    return _stopTimer(this.client, timesheetId);
  }

  /**
   * Find all running timers for an employee.
   *
   * @param employeeId - Employee ID (omit for current user's employee)
   * @returns Array of entries with running timers (usually 0 or 1)
   *
   * @example
   * ```typescript
   * const running = await client.timesheets.getRunningTimers();
   * if (running.length > 0) {
   *   console.log(`Timer running since ${running[0].timer_start}`);
   * }
   * ```
   */
  async getRunningTimers(employeeId?: number): Promise<TimesheetEntry[]> {
    return _getRunningTimers(this.client, employeeId);
  }

  /**
   * Log a completed timesheet entry with known hours.
   *
   * Use this when you know the duration (no timer needed).
   *
   * @param options - Description, projectId, hours, optional taskId/date/employeeId
   * @returns The created timesheet entry
   *
   * @example
   * ```typescript
   * const entry = await client.timesheets.logTime({
   *   description: 'Code review for PR #42',
   *   projectId: 5,
   *   taskId: 42,
   *   hours: 1.5,
   * });
   * ```
   */
  async logTime(options: LogTimeOptions): Promise<TimesheetEntry> {
    return _logTime(this.client, options);
  }

  /**
   * List timesheet entries with optional filters.
   *
   * @param options - Filter by employee, project, task, date range, etc.
   * @returns Array of timesheet entries
   *
   * @example
   * ```typescript
   * // This week's timesheets
   * const entries = await client.timesheets.list({
   *   dateFrom: '2026-02-09',
   *   dateTo: '2026-02-15',
   *   employeeId: 42,
   * });
   * const total = entries.reduce((sum, e) => sum + e.unit_amount, 0);
   * console.log(`Total: ${total.toFixed(2)} hours`);
   * ```
   */
  async list(options?: TimesheetListOptions): Promise<TimesheetEntry[]> {
    return _listTimesheets(this.client, options);
  }
}
