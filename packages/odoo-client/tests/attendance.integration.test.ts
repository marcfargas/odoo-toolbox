/**
 * Integration tests for attendance service (hr.attendance).
 *
 * Tests clock-in, clock-out, status, and listing against a real Odoo instance.
 * Requires: hr_attendance module installed (auto-installed via module manager).
 *
 * Key design: ensureClockedOut() DELETES open records instead of closing them.
 * Odoo's _check_validity constraint compares timestamps at second precision,
 * so closing a record and immediately creating a new one in the same second
 * triggers overlap validation errors. Deleting avoids this entirely.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { OdooClient, ModuleManager } from '../src';
import { clockIn, clockOut, getStatus, listAttendances } from '../src/services/attendance';
import { OdooValidationError } from '../src/types/errors';
import {
  installModuleForTest,
  cleanupInstalledModules,
} from '../../../tests/helpers/odoo-instance';

describe('Attendance service integration', () => {
  let client: OdooClient;
  let moduleManager: ModuleManager;
  let employeeId: number;
  const installedModules: string[] = [];

  /**
   * Delete any open attendance records for our test employee.
   *
   * We DELETE instead of writing check_out because Odoo's _check_validity
   * uses second-precision timestamps. If we close record A at second S and
   * create record B at the same second S, Odoo sees overlapping attendances
   * and throws a ValidationError. Deleting avoids this entirely.
   */
  async function ensureClockedOut(): Promise<void> {
    const open = await client.search('hr.attendance', [
      ['employee_id', '=', employeeId],
      ['check_out', '=', false],
    ]);
    if (open.length > 0) {
      await client.unlink('hr.attendance', open);
    }
  }

  beforeAll(async () => {
    client = new OdooClient({
      url: process.env.ODOO_URL || 'http://localhost:8069',
      database: process.env.ODOO_DB_NAME || 'odoo',
      username: process.env.ODOO_DB_USER || 'admin',
      password: process.env.ODOO_DB_PASSWORD || 'admin',
    });
    await client.authenticate();
    moduleManager = new ModuleManager(client);

    // Install hr_attendance (depends on hr)
    await installModuleForTest(moduleManager, 'hr_attendance', installedModules);

    // Find or create an employee for current user
    const session = client.getSession();
    const employees = await client.searchRead('hr.employee', [['user_id', '=', session?.uid]], {
      fields: ['id'],
      limit: 1,
    });

    if (employees.length > 0) {
      employeeId = employees[0].id;
    } else {
      employeeId = await client.create('hr.employee', {
        name: `__test_attendance_emp_${Date.now()}`,
        user_id: session?.uid,
      });
    }
  }, 120_000);

  beforeEach(async () => {
    await ensureClockedOut();
  });

  afterAll(async () => {
    // Delete ALL attendance records for our test employee
    const all = await client.search('hr.attendance', [['employee_id', '=', employeeId]]);
    if (all.length > 0) {
      try {
        await client.unlink('hr.attendance', all);
      } catch {
        // Ignore cleanup errors
      }
    }

    await cleanupInstalledModules(moduleManager, installedModules);
    client.logout();
  }, 120_000);

  // ── Clock in ────────────────────────────────────────────────────────

  describe('clockIn', () => {
    it('should create an open attendance record', async () => {
      const record = await clockIn(client, employeeId);

      expect(record.id).toBeGreaterThan(0);
      expect(record.check_in).toBeTruthy();
      expect(record.check_out).toBeFalsy(); // still open
      expect(record.employee_id).toBeTruthy();
    });

    it('should reject if already clocked in', async () => {
      await clockIn(client, employeeId);

      await expect(clockIn(client, employeeId)).rejects.toThrow(OdooValidationError);
      await expect(clockIn(client, employeeId)).rejects.toThrow(/already clocked in/);
    });
  });

  // ── Clock out ───────────────────────────────────────────────────────

  describe('clockOut', () => {
    it('should close the open attendance and compute worked_hours', async () => {
      const openRecord = await clockIn(client, employeeId);

      const closedRecord = await clockOut(client, employeeId);

      expect(closedRecord.id).toBe(openRecord.id);
      expect(closedRecord.check_out).toBeTruthy();
      expect(closedRecord.worked_hours).toBeGreaterThanOrEqual(0);
    });

    it('should reject if not clocked in', async () => {
      await expect(clockOut(client, employeeId)).rejects.toThrow(OdooValidationError);
      await expect(clockOut(client, employeeId)).rejects.toThrow(/not clocked in/);
    });
  });

  // ── Status ──────────────────────────────────────────────────────────

  describe('getStatus', () => {
    it('should return checkedIn=false when not clocked in', async () => {
      const status = await getStatus(client, employeeId);

      expect(status.checkedIn).toBe(false);
      expect(status.currentAttendance).toBeNull();
      expect(status.employee[0]).toBe(employeeId);
    });

    it('should return checkedIn=true when clocked in', async () => {
      const record = await clockIn(client, employeeId);
      const status = await getStatus(client, employeeId);

      expect(status.checkedIn).toBe(true);
      expect(status.currentAttendance).not.toBeNull();
      expect(status.currentAttendance!.id).toBe(record.id);
    });
  });

  // ── Client accessor ─────────────────────────────────────────────────

  describe('client.attendance accessor', () => {
    it('should work via client.attendance.clockIn/clockOut', async () => {
      const record = await client.attendance.clockIn(employeeId);
      expect(record.check_in).toBeTruthy();

      const closed = await client.attendance.clockOut(employeeId);
      expect(closed.check_out).toBeTruthy();
    });

    it('should work via client.attendance.getStatus', async () => {
      const status = await client.attendance.getStatus(employeeId);
      expect(status.checkedIn).toBe(false);
    });

    it('should work via client.attendance.list', async () => {
      const records = await client.attendance.list({
        employeeId,
        limit: 5,
      });
      expect(Array.isArray(records)).toBe(true);
    });
  });

  // ── List ────────────────────────────────────────────────────────────

  describe('listAttendances', () => {
    it('should list attendance records with filters', async () => {
      const today = new Date().toISOString().split('T')[0];
      const records = await listAttendances(client, {
        employeeId,
        dateFrom: today,
        dateTo: today,
      });
      expect(Array.isArray(records)).toBe(true);
    });
  });
});
