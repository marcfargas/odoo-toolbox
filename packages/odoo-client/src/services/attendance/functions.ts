/**
 * Attendance standalone functions for Odoo hr.attendance.
 *
 * Provides clock-in, clock-out, and status-check operations.
 *
 * The hr.attendance model stores presence records:
 * - A record with check_in but no check_out = employee is currently present
 * - A record with both check_in and check_out = completed attendance
 *
 * Odoo enforces that an employee can only have ONE open attendance at a time
 * (constraint: _check_validity). Attempting to clock in twice throws a
 * ValidationError.
 *
 * @see https://github.com/odoo/odoo/blob/17.0/addons/hr_attendance/models/hr_attendance.py
 */

import debug from 'debug';
import type { OdooClient } from '../../client/odoo-client';
import { OdooValidationError } from '../../types/errors';
import type { AttendanceRecord, AttendanceListOptions, AttendanceStatus } from './types';

const log = debug('odoo-client:attendance');

/** Fields we always fetch for attendance records. */
const ATTENDANCE_FIELDS = ['employee_id', 'check_in', 'check_out', 'worked_hours'];

/**
 * Resolve the employee ID for the current user.
 *
 * If employeeId is provided, returns it. Otherwise, looks up the
 * hr.employee linked to the authenticated user.
 *
 * @throws OdooValidationError if no employee record found for current user
 */
export async function resolveEmployeeId(client: OdooClient, employeeId?: number): Promise<number> {
  if (employeeId) return employeeId;

  const session = client.getSession();
  if (!session?.uid) {
    throw new OdooValidationError(
      'Cannot resolve employee: no active session. Call authenticate() first.'
    );
  }

  const employees = await client.searchRead('hr.employee', [['user_id', '=', session.uid]], {
    fields: ['id'],
    limit: 1,
  });

  if (employees.length === 0) {
    throw new OdooValidationError(
      `No hr.employee record found for user ID ${session.uid}. ` +
        'Create an employee record linked to this user, or pass employeeId explicitly.'
    );
  }

  return employees[0].id;
}

/**
 * Clock in — create an open attendance record.
 *
 * Creates an hr.attendance record with check_in = now (UTC).
 * Odoo's _check_validity constraint ensures no overlapping attendances.
 *
 * @param client     - Authenticated OdooClient
 * @param employeeId - Employee ID (omit to use current user's employee)
 * @returns The created attendance record
 *
 * @throws OdooValidationError if employee is already clocked in
 */
export async function clockIn(client: OdooClient, employeeId?: number): Promise<AttendanceRecord> {
  const empId = await resolveEmployeeId(client, employeeId);
  log('Clocking in employee %d', empId);

  // Check if already clocked in
  const open = await client.searchRead<AttendanceRecord>(
    'hr.attendance',
    [
      ['employee_id', '=', empId],
      ['check_out', '=', false],
    ],
    { fields: ATTENDANCE_FIELDS, limit: 1 }
  );

  if (open.length > 0) {
    throw new OdooValidationError(
      `Employee ${empId} is already clocked in (attendance ID: ${open[0].id}, ` +
        `since: ${open[0].check_in}). Clock out first.`
    );
  }

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const id = await client.create('hr.attendance', {
    employee_id: empId,
    check_in: now,
  });

  log('Clocked in employee %d → attendance %d at %s', empId, id, now);

  const [record] = await client.read<AttendanceRecord>('hr.attendance', id, ATTENDANCE_FIELDS);
  return record;
}

/**
 * Clock out — set check_out on the current open attendance.
 *
 * Finds the open attendance (check_out = false) for the employee
 * and sets check_out = now (UTC).
 *
 * @param client     - Authenticated OdooClient
 * @param employeeId - Employee ID (omit to use current user's employee)
 * @returns The updated attendance record (with worked_hours computed)
 *
 * @throws OdooValidationError if employee is not currently clocked in
 */
export async function clockOut(client: OdooClient, employeeId?: number): Promise<AttendanceRecord> {
  const empId = await resolveEmployeeId(client, employeeId);
  log('Clocking out employee %d', empId);

  const open = await client.searchRead<AttendanceRecord>(
    'hr.attendance',
    [
      ['employee_id', '=', empId],
      ['check_out', '=', false],
    ],
    { fields: ATTENDANCE_FIELDS, limit: 1 }
  );

  if (open.length === 0) {
    throw new OdooValidationError(`Employee ${empId} is not clocked in. Cannot clock out.`);
  }

  const attendance = open[0];
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  await client.write('hr.attendance', attendance.id, { check_out: now });
  log('Clocked out employee %d → attendance %d at %s', empId, attendance.id, now);

  const [record] = await client.read<AttendanceRecord>(
    'hr.attendance',
    attendance.id,
    ATTENDANCE_FIELDS
  );
  return record;
}

/**
 * Get the attendance status for an employee.
 *
 * Returns whether the employee is currently clocked in, and if so,
 * the open attendance record.
 *
 * @param client     - Authenticated OdooClient
 * @param employeeId - Employee ID (omit to use current user's employee)
 * @returns Attendance status
 */
export async function getStatus(
  client: OdooClient,
  employeeId?: number
): Promise<AttendanceStatus> {
  const empId = await resolveEmployeeId(client, employeeId);
  log('Checking attendance status for employee %d', empId);

  // Get employee display name
  const [employee] = await client.read('hr.employee', empId, ['name']);

  const open = await client.searchRead<AttendanceRecord>(
    'hr.attendance',
    [
      ['employee_id', '=', empId],
      ['check_out', '=', false],
    ],
    { fields: ATTENDANCE_FIELDS, limit: 1 }
  );

  return {
    checkedIn: open.length > 0,
    currentAttendance: open.length > 0 ? open[0] : null,
    employee: [empId, employee.name as string],
  };
}

/**
 * List attendance records with optional filtering.
 *
 * @param client  - Authenticated OdooClient
 * @param options - Filter and pagination options
 * @returns Array of attendance records
 */
export async function listAttendances(
  client: OdooClient,
  options: AttendanceListOptions = {}
): Promise<AttendanceRecord[]> {
  const domain: any[] = [];

  if (options.employeeId) {
    domain.push(['employee_id', '=', options.employeeId]);
  }
  if (options.dateFrom) {
    domain.push(['check_in', '>=', `${options.dateFrom} 00:00:00`]);
  }
  if (options.dateTo) {
    domain.push(['check_in', '<=', `${options.dateTo} 23:59:59`]);
  }

  log('Listing attendances with domain: %o', domain);

  return client.searchRead<AttendanceRecord>('hr.attendance', domain, {
    fields: ATTENDANCE_FIELDS,
    limit: options.limit,
    offset: options.offset,
    order: options.order ?? 'check_in desc',
  });
}
