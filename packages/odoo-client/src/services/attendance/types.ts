/**
 * Types for hr.attendance service.
 *
 * @see https://github.com/odoo/odoo/blob/17.0/addons/hr_attendance/models/hr_attendance.py
 */

/**
 * Raw hr.attendance record as returned by Odoo read/search_read.
 *
 * Key fields:
 * - check_in: always set when record exists
 * - check_out: null/false when the employee is still checked in
 * - worked_hours: computed from check_in/check_out (0 when still checked in)
 */
export interface AttendanceRecord {
  id: number;
  /** Many2one → hr.employee: [id, display_name] */
  employee_id: [number, string] | false;
  /** Datetime string (UTC): when the employee checked in */
  check_in: string;
  /** Datetime string (UTC) or false: when the employee checked out */
  check_out: string | false;
  /** Computed: hours worked (check_out - check_in), 0 if still checked in */
  worked_hours: number;
}

/**
 * Options for listing attendance records.
 */
export interface AttendanceListOptions {
  /** Filter by employee ID */
  employeeId?: number;
  /** Start date (inclusive, YYYY-MM-DD) */
  dateFrom?: string;
  /** End date (inclusive, YYYY-MM-DD) */
  dateTo?: string;
  /** Max records to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Sort order (default: 'check_in desc') */
  order?: string;
}

/**
 * Attendance status for an employee.
 */
export interface AttendanceStatus {
  /** Whether the employee is currently checked in */
  checkedIn: boolean;
  /** The current (open) attendance record, or null if checked out */
  currentAttendance: AttendanceRecord | null;
  /** Employee info: [id, display_name] */
  employee: [number, string];
}
