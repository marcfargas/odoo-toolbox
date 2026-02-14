/**
 * Types for the timesheets service (account.analytic.line with hr_timesheet).
 *
 * Timer concept: unit_amount = 0 means running, unit_amount > 0 means closed.
 *
 * @see https://github.com/odoo/odoo/blob/17.0/addons/hr_timesheet/models/account_analytic_line.py
 */

/**
 * Timesheet entry as returned by Odoo.
 */
export interface TimesheetEntry {
  id: number;
  /** Description of work done */
  name: string;
  /** Date (YYYY-MM-DD) */
  date: string;
  /** Hours logged. 0 = running timer, > 0 = completed entry. */
  unit_amount: number;
  /** Many2one → project.project: [id, display_name] or false */
  project_id: [number, string] | false;
  /** Many2one → project.task: [id, display_name] or false */
  task_id: [number, string] | false;
  /** Many2one → hr.employee: [id, display_name] or false */
  employee_id: [number, string] | false;
  /** When the record was created (UTC). Used to compute elapsed time for timers. */
  create_date?: string;
}

/**
 * Options for starting a timesheet timer.
 */
export interface TimerStartOptions {
  /** Description of work (required) */
  description: string;
  /** Project ID (required — timesheets need a project) */
  projectId: number;
  /** Task ID (optional, filtered by project in Odoo UI) */
  taskId?: number;
  /** Employee ID (omit for current user's employee) */
  employeeId?: number;
}

/**
 * Options for logging a completed timesheet entry (no timer).
 */
export interface LogTimeOptions {
  /** Description of work (required) */
  description: string;
  /** Project ID (required) */
  projectId: number;
  /** Hours worked (required, > 0) */
  hours: number;
  /** Task ID (optional) */
  taskId?: number;
  /** Employee ID (omit for current user's employee) */
  employeeId?: number;
  /** Date (YYYY-MM-DD, defaults to today) */
  date?: string;
}

/**
 * Options for listing timesheet entries.
 */
export interface TimesheetListOptions {
  /** Filter by employee ID */
  employeeId?: number;
  /** Filter by project ID */
  projectId?: number;
  /** Filter by task ID */
  taskId?: number;
  /** Start date (inclusive, YYYY-MM-DD) */
  dateFrom?: string;
  /** End date (inclusive, YYYY-MM-DD) */
  dateTo?: string;
  /** Only running timers (unit_amount = 0) */
  runningOnly?: boolean;
  /** Max records */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Sort order (default: 'date desc, id desc') */
  order?: string;
}
