/**
 * `odoo attendance` command group.
 *
 * Commands:
 *   attendance clock-in           Record clock-in [WRITE]
 *   attendance clock-out          Record clock-out [WRITE]
 *   attendance status             Show current status [READ]
 *   attendance list               List records by date range [READ]
 *
 * Requires hr_attendance module to be installed.
 */

import { Command } from 'commander';
import debug from 'debug';
import { createAuthClient, type AuthFlags } from '../middleware/auth';
import { requireConfirm, printDryRun } from '../middleware/safety';
import {
  addAuthOptions,
  addOutputOptions,
  confirmOption,
  dryRunOption,
} from '../middleware/common-params';
import { resolveFormat, render } from '../output/formatter';
import { handleError, printSuccess, EXIT_CODES, CliUsageError } from '../output/errors';
import { writeStdout } from '../output/stream-writer';
import { showHelpExtra } from '../help/extra-help';

const log = debug('odoo-cli:attendance');

// ── Helper: resolve employee ID from name or numeric option ───────────

/**
 * Resolve employee ID from --employee-id (number) or --employee (name).
 * Returns undefined if neither is specified (Odoo service falls back to current user).
 * Exits with error if name lookup fails or is ambiguous.
 */
async function resolveEmployeeId(
  client: Awaited<ReturnType<typeof createAuthClient>>,
  opts: { employeeId?: string; employee?: string }
): Promise<number | undefined> {
  if (opts.employee) {
    const name = opts.employee;
    const matches = await client.searchRead('hr.employee', [['name', '=', name]], {
      fields: ['id', 'name'],
      limit: 5,
    });
    if (matches.length === 0) {
      process.stderr.write(`✗ Error: No employee found with name "${name}"\n`);
      process.exit(EXIT_CODES.NOT_FOUND);
    }
    if (matches.length > 1) {
      process.stderr.write(`✗ Error: Multiple employees match "${name}":\n`);
      for (const m of matches) {
        process.stderr.write(`  - ${m.name} (id=${m.id})\n`);
      }
      process.exit(EXIT_CODES.USAGE_ERROR);
    }
    return matches[0].id as number;
  }
  if (opts.employeeId) {
    const id = parseInt(opts.employeeId, 10);
    if (isNaN(id) || id <= 0) {
      throw new CliUsageError(`--employee-id must be a positive integer, got: ${opts.employeeId}`);
    }
    return id;
  }
  return undefined;
}

export function buildAttendanceCommand(): Command {
  const att = new Command('attendance')
    .description('Employee attendance — clock in/out and presence tracking')
    .addHelpText(
      'after',
      `
Requires: hr_attendance Odoo module.
Group flag: --employee-id N (default: current user's employee)

Safety:
  READ   status, list  — no confirmation required
  WRITE  clock-in, clock-out — requires --confirm

Examples:
  odoo attendance clock-in --confirm
  odoo attendance clock-out --confirm
  odoo attendance status
  odoo attendance list --from 2024-03-11 --to 2024-03-15
`
    );

  // --help-extra
  att.option('--help-extra', 'Show extended skill documentation for attendance');
  att.hook('preAction', async (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.helpExtra) {
      await showHelpExtra('attendance');
      process.exit(0);
    }
  });

  // Group-level employee flag
  att.option('--employee-id <n>', "Employee ID (default: current user's employee)");
  att.option('--employee <name>', 'Employee name (lookup by name)');

  att.addCommand(buildClockInCommand());
  att.addCommand(buildClockOutCommand());
  att.addCommand(buildStatusCommand());
  att.addCommand(buildListCommand());

  return att;
}

function buildClockInCommand(): Command {
  const cmd = new Command('clock-in')
    .description('Record employee clock-in [WRITE — requires --confirm]')
    .addHelpText(
      'after',
      `
Examples:
  odoo attendance clock-in --confirm
  odoo attendance clock-in --employee-id 42 --confirm
`
    );

  addAuthOptions(cmd);
  cmd.addOption(confirmOption());
  cmd.addOption(dryRunOption());

  cmd.action(async () => {
    const opts = cmd.optsWithGlobals() as AuthFlags & {
      confirm?: boolean;
      dryRun?: boolean;
      employeeId?: string;
      employee?: string;
    };

    log('attendance clock-in');

    try {
      requireConfirm('WRITE', opts, 'attendance clock-in');
    } catch (err) {
      process.exit(handleError(err));
    }

    if (opts.dryRun) {
      const empRef = opts.employee ?? opts.employeeId ?? '<current user employee>';
      printDryRun('hr.attendance', 'create', [{ employee_id: empRef, check_in: '<now>' }]);
      return;
    }

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      const employeeId = await resolveEmployeeId(client!, opts);
      const record = await client!.attendance.clockIn(employeeId);
      const employeeName = Array.isArray(record.employee_id) ? record.employee_id[1] : 'Employee';
      const checkIn = formatDateTime(record.check_in);
      printSuccess(`Clocked in: ${employeeName} at ${checkIn}`);
    } catch (err) {
      // Conflict: already clocked in
      if (err instanceof Error && err.message.toLowerCase().includes('already')) {
        process.stderr.write(
          `✗ Error: Already clocked in\n  → Run: odoo attendance clock-out --confirm\n`
        );
        process.exit(EXIT_CODES.CONFLICT);
      }
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return cmd;
}

function buildClockOutCommand(): Command {
  const cmd = new Command('clock-out')
    .description('Record employee clock-out [WRITE — requires --confirm]')
    .addHelpText(
      'after',
      `
Examples:
  odoo attendance clock-out --confirm
`
    );

  addAuthOptions(cmd);
  cmd.addOption(confirmOption());
  cmd.addOption(dryRunOption());

  cmd.action(async () => {
    const opts = cmd.optsWithGlobals() as AuthFlags & {
      confirm?: boolean;
      dryRun?: boolean;
      employeeId?: string;
      employee?: string;
    };

    log('attendance clock-out');

    try {
      requireConfirm('WRITE', opts, 'attendance clock-out');
    } catch (err) {
      process.exit(handleError(err));
    }

    if (opts.dryRun) {
      printDryRun('hr.attendance', 'write', [['<open attendance id>'], { check_out: '<now>' }]);
      return;
    }

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      const employeeId = await resolveEmployeeId(client!, opts);
      const record = await client!.attendance.clockOut(employeeId);
      const employeeName = Array.isArray(record.employee_id) ? record.employee_id[1] : 'Employee';
      const hoursWorked = formatHours(record.worked_hours);
      printSuccess(`Clocked out: ${employeeName} — worked ${hoursWorked} today`);
    } catch (err) {
      if (err instanceof Error && err.message.toLowerCase().includes('not clocked in')) {
        process.stderr.write(
          `✗ Error: Not currently clocked in\n  → Run: odoo attendance clock-in --confirm\n`
        );
        process.exit(EXIT_CODES.CONFLICT);
      }
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return cmd;
}

function buildStatusCommand(): Command {
  const cmd = new Command('status')
    .description('Show current attendance status [READ]')
    .addHelpText(
      'after',
      `
Examples:
  odoo attendance status
  odoo attendance status --format json
`
    );

  addAuthOptions(cmd);
  addOutputOptions(cmd);

  cmd.action(async () => {
    const opts = cmd.optsWithGlobals() as AuthFlags & {
      format?: string;
      employeeId?: string;
      employee?: string;
    };

    log('attendance status');

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      const employeeId = await resolveEmployeeId(client!, opts);
      const status = await client!.attendance.getStatus(employeeId);
      const format = resolveFormat(opts.format);

      if (format === 'json' || format === 'ndjson') {
        const out = {
          status: status.checkedIn ? 'in' : 'out',
          employee_id: status.employee[0],
          employee_name: status.employee[1],
          since: status.currentAttendance?.check_in ?? null,
          elapsed_minutes: status.currentAttendance
            ? Math.round(
                (Date.now() - new Date(status.currentAttendance.check_in).getTime()) / 60000
              )
            : null,
        };
        await writeStdout(JSON.stringify(out, null, format === 'json' ? 2 : 0) + '\n');
      } else {
        // Table/text
        if (status.checkedIn && status.currentAttendance) {
          const since = formatDateTime(status.currentAttendance.check_in);
          const elapsed = Math.round(
            (Date.now() - new Date(status.currentAttendance.check_in).getTime()) / 60000
          );
          const elapsedStr = formatElapsed(elapsed);
          process.stdout.write(`● IN  since ${since} (${elapsedStr} elapsed)\n`);
        } else {
          process.stdout.write(`○ OUT  — ${status.employee[1]} is not clocked in\n`);
        }
      }
    } catch (err) {
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return cmd;
}

function buildListCommand(): Command {
  const cmd = new Command('list')
    .description('List attendance records by date range [READ]')
    .addHelpText(
      'after',
      `
Dates default to the current week (Monday to today).

Examples:
  odoo attendance list
  odoo attendance list --from 2024-03-11 --to 2024-03-15
  odoo attendance list --format csv > attendance.csv
`
    );

  addAuthOptions(cmd);
  addOutputOptions(cmd);
  cmd.option('--from <date>', 'Start date YYYY-MM-DD (default: current week Monday)');
  cmd.option('--to <date>', 'End date YYYY-MM-DD (default: today)');

  cmd.action(async () => {
    const opts = cmd.optsWithGlobals() as AuthFlags & {
      from?: string;
      to?: string;
      format?: string;
      employeeId?: string;
      employee?: string;
    };

    log('attendance list from=%s to=%s', opts.from, opts.to);

    const today = new Date();
    const dateFrom = opts.from ?? getWeekMonday(today);
    const dateTo = opts.to ?? today.toISOString().split('T')[0];

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      const employeeId = await resolveEmployeeId(client!, opts);
      const records = await client!.attendance.list({ dateFrom, dateTo, employeeId });
      const format = resolveFormat(opts.format);

      const rows = records.map((r) => ({
        date: r.check_in ? r.check_in.split('T')[0] : '',
        check_in: r.check_in ? formatDateTime(r.check_in) : '',
        check_out: r.check_out ? formatDateTime(r.check_out) : '—',
        duration: formatHours(r.worked_hours),
        employee: Array.isArray(r.employee_id) ? r.employee_id[1] : '',
      }));

      await render(rows, format);

      if (format === 'table' && rows.length > 0) {
        const total = records.reduce((s, r) => s + (r.worked_hours ?? 0), 0);
        process.stderr.write(`Total: ${formatHours(total)}\n`);
      }
    } catch (err) {
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return cmd;
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatDateTime(utcStr: string): string {
  try {
    return new Date(utcStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return utcStr;
  }
}

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

function formatElapsed(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function getWeekMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}
