/**
 * Integration tests for timesheets service (account.analytic.line).
 *
 * Timer concept: unit_amount = 0 = running, unit_amount > 0 = closed.
 * Tests against real Odoo Community instance with hr_timesheet.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { OdooClient, ModuleManager } from '../src';
import {
  startTimer,
  stopTimer,
  getRunningTimers,
  logTime,
  listTimesheets,
} from '../src/services/timesheets';
import { OdooValidationError } from '../src/types/errors';
import {
  installModuleForTest,
  cleanupInstalledModules,
} from '../../../tests/helpers/odoo-instance';

describe('Timesheets service integration', () => {
  let client: OdooClient;
  let moduleManager: ModuleManager;
  let employeeId: number;
  let projectId: number;
  let taskId: number;
  const installedModules: string[] = [];
  const cleanup: Array<{ model: string; id: number }> = [];

  beforeAll(async () => {
    client = new OdooClient({
      url: process.env.ODOO_URL || 'http://localhost:8069',
      database: process.env.ODOO_DB_NAME || 'odoo',
      username: process.env.ODOO_DB_USER || 'admin',
      password: process.env.ODOO_DB_PASSWORD || 'admin',
    });
    await client.authenticate();
    moduleManager = new ModuleManager(client);

    // Install hr_timesheet (depends on project, hr, analytic)
    await installModuleForTest(moduleManager, 'hr_timesheet', installedModules);

    // Find or create employee
    const session = client.getSession();
    const employees = await client.searchRead('hr.employee', [['user_id', '=', session?.uid]], {
      fields: ['id'],
      limit: 1,
    });

    if (employees.length > 0) {
      employeeId = employees[0].id;
    } else {
      employeeId = await client.create('hr.employee', {
        name: `__test_ts_emp_${Date.now()}`,
        user_id: session?.uid,
      });
      cleanup.push({ model: 'hr.employee', id: employeeId });
    }

    // Create a test project with timesheets enabled
    projectId = await client.create('project.project', {
      name: `__test_ts_project_${Date.now()}`,
      allow_timesheets: true,
    });
    cleanup.push({ model: 'project.project', id: projectId });

    // Create a test task
    taskId = await client.create('project.task', {
      name: `__test_ts_task_${Date.now()}`,
      project_id: projectId,
    });
    cleanup.push({ model: 'project.task', id: taskId });
  }, 120_000);

  afterAll(async () => {
    for (const { model, id } of cleanup.reverse()) {
      try {
        await client.unlink(model, [id]);
      } catch {
        // ignore
      }
    }
    await cleanupInstalledModules(moduleManager, installedModules);
    client.logout();
  }, 120_000);

  // ── logTime ─────────────────────────────────────────────────────────

  describe('logTime', () => {
    it('should create a timesheet entry with hours', async () => {
      const entry = await logTime(client, {
        description: 'Test manual logging',
        projectId,
        hours: 2.5,
        employeeId,
      });
      cleanup.push({ model: 'account.analytic.line', id: entry.id });

      expect(entry.id).toBeGreaterThan(0);
      expect(entry.name).toBe('Test manual logging');
      expect(entry.unit_amount).toBe(2.5);
      expect(entry.project_id).toBeTruthy();
      expect((entry.project_id as [number, string])[0]).toBe(projectId);

      // Cleanup
      await client.unlink('account.analytic.line', [entry.id]);
    });

    it('should create entry with task', async () => {
      const entry = await logTime(client, {
        description: 'Task-specific work',
        projectId,
        taskId,
        hours: 1.0,
        employeeId,
      });
      cleanup.push({ model: 'account.analytic.line', id: entry.id });

      expect(entry.task_id).toBeTruthy();
      expect((entry.task_id as [number, string])[0]).toBe(taskId);

      // Cleanup
      await client.unlink('account.analytic.line', [entry.id]);
    });

    it('should use custom date', async () => {
      const entry = await logTime(client, {
        description: 'Backdated entry',
        projectId,
        hours: 1.0,
        date: '2026-02-01',
        employeeId,
      });
      cleanup.push({ model: 'account.analytic.line', id: entry.id });

      expect(entry.date).toBe('2026-02-01');
    });
  });

  // ── Timer start/stop ────────────────────────────────────────────────

  describe('startTimer / stopTimer', () => {
    it('should start a timer (unit_amount = 0) and then stop it', async () => {
      const entry = await startTimer(client, {
        description: 'Timer test',
        projectId,
        employeeId,
      });
      cleanup.push({ model: 'account.analytic.line', id: entry.id });

      expect(entry.id).toBeGreaterThan(0);
      expect(entry.unit_amount).toBe(0); // running

      // Wait a bit so there's measurable time
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Stop timer — should compute duration from create_date
      const stopped = await stopTimer(client, entry.id);
      expect(stopped.id).toBe(entry.id);
      expect(stopped.unit_amount).toBeGreaterThan(0); // closed
    });

    it('should reject stopTimer on entry that already has duration', async () => {
      const entry = await logTime(client, {
        description: 'Not a timer',
        projectId,
        hours: 1.0,
        employeeId,
      });
      cleanup.push({ model: 'account.analytic.line', id: entry.id });

      await expect(stopTimer(client, entry.id)).rejects.toThrow(OdooValidationError);
      await expect(stopTimer(client, entry.id)).rejects.toThrow(/not a running timer/);
    });
  });

  // ── getRunningTimers ────────────────────────────────────────────────

  describe('getRunningTimers', () => {
    it('should find running timers (unit_amount = 0)', async () => {
      const entry = await startTimer(client, {
        description: 'Running timer test',
        projectId,
        employeeId,
      });
      cleanup.push({ model: 'account.analytic.line', id: entry.id });

      const running = await getRunningTimers(client, employeeId);
      expect(running.length).toBeGreaterThanOrEqual(1);
      expect(running.some((r) => r.id === entry.id)).toBe(true);

      // Clean up: stop the timer
      await stopTimer(client, entry.id);
    });

    it('should return empty when no timers running', async () => {
      // Stop any leftover timers
      const leftover = await getRunningTimers(client, employeeId);
      for (const entry of leftover) {
        await client.write('account.analytic.line', entry.id, { unit_amount: 0.01 });
      }

      const running = await getRunningTimers(client, employeeId);
      expect(running.length).toBe(0);
    });
  });

  // ── listTimesheets ──────────────────────────────────────────────────

  describe('listTimesheets', () => {
    it('should list entries with filters', async () => {
      const entries = await listTimesheets(client, {
        projectId,
        employeeId,
      });
      expect(Array.isArray(entries)).toBe(true);
      expect(entries.length).toBeGreaterThan(0);
    });

    it('should filter by date range', async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const entries = await listTimesheets(client, {
        employeeId,
        dateFrom: todayStr,
        dateTo: todayStr,
      });
      expect(Array.isArray(entries)).toBe(true);
    });

    it('should filter running only', async () => {
      const entry = await startTimer(client, {
        description: 'Running for list test',
        projectId,
        employeeId,
      });
      cleanup.push({ model: 'account.analytic.line', id: entry.id });

      const running = await listTimesheets(client, {
        projectId,
        runningOnly: true,
      });
      expect(running.some((r) => r.id === entry.id)).toBe(true);

      // Stop
      await stopTimer(client, entry.id);
    });
  });

  // ── Client accessor ─────────────────────────────────────────────────

  describe('client.timesheets accessor', () => {
    it('should work via client.timesheets.logTime', async () => {
      const entry = await client.timesheets.logTime({
        description: 'Via accessor',
        projectId,
        hours: 0.5,
        employeeId,
      });
      cleanup.push({ model: 'account.analytic.line', id: entry.id });

      expect(entry.unit_amount).toBe(0.5);
    });

    it('should work via client.timesheets.list', async () => {
      const entries = await client.timesheets.list({
        projectId,
        limit: 5,
      });
      expect(Array.isArray(entries)).toBe(true);
    });

    it('should work via client.timesheets.startTimer/stopTimer', async () => {
      const entry = await client.timesheets.startTimer({
        description: 'Accessor timer test',
        projectId,
        employeeId,
      });
      cleanup.push({ model: 'account.analytic.line', id: entry.id });

      expect(entry.unit_amount).toBe(0);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const stopped = await client.timesheets.stopTimer(entry.id);
      expect(stopped.unit_amount).toBeGreaterThan(0);
    });

    it('should work via client.timesheets.getRunningTimers', async () => {
      const running = await client.timesheets.getRunningTimers(employeeId);
      expect(Array.isArray(running)).toBe(true);
    });
  });
});
