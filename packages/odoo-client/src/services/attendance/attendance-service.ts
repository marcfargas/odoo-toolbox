/**
 * Attendance service — the typed interface exposed via `client.attendance.*`
 *
 * Delegates to standalone functions in functions.ts.
 *
 * Provides clock-in/out and attendance status for hr.attendance model.
 * Requires the `hr_attendance` module to be installed.
 *
 * @see https://github.com/odoo/odoo/blob/17.0/addons/hr_attendance/models/hr_attendance.py
 */

import type { OdooClient } from '../../client/odoo-client';
import type { AttendanceRecord, AttendanceListOptions, AttendanceStatus } from './types';
import {
  clockIn as _clockIn,
  clockOut as _clockOut,
  getStatus as _getStatus,
  listAttendances as _listAttendances,
} from './functions';

/**
 * Attendance service for managing employee clock-in/out.
 *
 * Access via `client.attendance` — never instantiate directly.
 *
 * The hr.attendance model tracks physical presence:
 * - Clock in creates a record with check_in = now
 * - Clock out sets check_out = now on the open record
 * - Odoo enforces one open attendance per employee at a time
 *
 * All methods accept an optional employeeId. When omitted, the current
 * user's linked hr.employee record is used automatically.
 */
export class AttendanceService {
  /** @internal */
  constructor(private client: OdooClient) {}

  /**
   * Clock in — create an open attendance record.
   *
   * Creates an hr.attendance with check_in = now.
   * Fails if the employee is already clocked in.
   *
   * @param employeeId - Employee ID (omit for current user's employee)
   * @returns The created attendance record
   * @throws OdooValidationError if already clocked in
   *
   * @example
   * ```typescript
   * const record = await client.attendance.clockIn();
   * console.log(`Clocked in at ${record.check_in}`);
   * ```
   */
  async clockIn(employeeId?: number): Promise<AttendanceRecord> {
    return _clockIn(this.client, employeeId);
  }

  /**
   * Clock out — close the current open attendance.
   *
   * Sets check_out = now on the open attendance record.
   * Fails if the employee is not currently clocked in.
   *
   * @param employeeId - Employee ID (omit for current user's employee)
   * @returns The updated attendance record (with worked_hours)
   * @throws OdooValidationError if not clocked in
   *
   * @example
   * ```typescript
   * const record = await client.attendance.clockOut();
   * console.log(`Worked ${record.worked_hours.toFixed(2)} hours`);
   * ```
   */
  async clockOut(employeeId?: number): Promise<AttendanceRecord> {
    return _clockOut(this.client, employeeId);
  }

  /**
   * Get attendance status — check if currently clocked in.
   *
   * @param employeeId - Employee ID (omit for current user's employee)
   * @returns Status with checkedIn flag and current attendance if any
   *
   * @example
   * ```typescript
   * const status = await client.attendance.getStatus();
   * if (status.checkedIn) {
   *   console.log(`${status.employee[1]} clocked in since ${status.currentAttendance!.check_in}`);
   * } else {
   *   console.log(`${status.employee[1]} is not in the office`);
   * }
   * ```
   */
  async getStatus(employeeId?: number): Promise<AttendanceStatus> {
    return _getStatus(this.client, employeeId);
  }

  /**
   * List attendance records with optional filters.
   *
   * @param options - Filter by employee, date range, pagination
   * @returns Array of attendance records
   *
   * @example
   * ```typescript
   * // Today's attendances for current user's employee
   * const today = new Date().toISOString().split('T')[0];
   * const records = await client.attendance.list({
   *   dateFrom: today,
   *   dateTo: today,
   *   employeeId: 42,
   * });
   * ```
   */
  async list(options?: AttendanceListOptions): Promise<AttendanceRecord[]> {
    return _listAttendances(this.client, options);
  }
}
