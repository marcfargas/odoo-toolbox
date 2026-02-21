/**
 * `odoo timesheets` command group.
 *
 * Commands:
 *   timesheets start           Start a timer [WRITE]
 *   timesheets stop            Stop running timer [WRITE]
 *   timesheets running         Show running timer [READ]
 *   timesheets log             Log time retroactively [WRITE]
 *   timesheets list            List timesheets [READ]
 *
 * Requires hr_timesheet module to be installed.
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
import { handleError, printSuccess, EXIT_CODES } from '../output/errors';
import { writeStdout } from '../output/stream-writer';
import { parseHours } from '../parsing/json-arg';
import { showHelpExtra } from '../help/extra-help';

const log = debug('odoo-cli:timesheets');

export function buildTimesheetsCommand(): Command {
  const ts = new Command('timesheets')
    .description('Time tracking — timer-based and manual logging')
    .addHelpText(
      'after',
      `
Requires: hr_timesheet Odoo module.

Safety:
  READ   running, list  — no confirmation required
  WRITE  start, stop, log — requires --confirm

Timer workflow:
  odoo timesheets start --task-id 42 --description "Feature work" --confirm
  odoo timesheets stop --confirm

Manual:
  odoo timesheets log --task-id 42 --hours 1.5 --description "Review" --confirm
`
    );

  // --help-extra
  ts.option('--help-extra', 'Show extended skill documentation for timesheets');
  ts.hook('preAction', async (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.helpExtra) {
      await showHelpExtra('timesheets');
      process.exit(0);
    }
  });

  ts.addCommand(buildStartCommand());
  ts.addCommand(buildStopCommand());
  ts.addCommand(buildRunningCommand());
  ts.addCommand(buildLogCommand());
  ts.addCommand(buildListCommand());

  return ts;
}

function buildStartCommand(): Command {
  const cmd = new Command('start')
    .description('Start a timesheet timer [WRITE — requires --confirm]')
    .addHelpText(
      'after',
      `
Examples:
  odoo timesheets start --task-id 42 --description "Working on login bug" --confirm
  odoo timesheets start --project-id 5 --description "Project work" --confirm
`
    );

  addAuthOptions(cmd);
  cmd.addOption(confirmOption());
  cmd.addOption(dryRunOption());
  cmd.option('--task-id <n>', 'Task ID to track time on');
  cmd.option('--project-id <n>', 'Project ID (required if no task)');
  cmd.option('--description <text>', 'Description of work');
  cmd.option('--employee-id <n>', "Employee ID (default: current user's employee)");

  cmd.action(async () => {
    const opts = cmd.optsWithGlobals() as AuthFlags & {
      confirm?: boolean;
      dryRun?: boolean;
      taskId?: string;
      projectId?: string;
      description?: string;
      employeeId?: string;
    };

    log('timesheets start task=%s project=%s', opts.taskId, opts.projectId);

    try {
      requireConfirm('WRITE', opts, 'timesheets start');
    } catch (err) {
      process.exit(handleError(err));
    }

    if (!opts.taskId && !opts.projectId) {
      process.stderr.write('✗ Error: --task-id or --project-id is required\n');
      process.exit(EXIT_CODES.USAGE_ERROR);
    }

    if (!opts.description) {
      process.stderr.write('✗ Error: --description is required\n');
      process.exit(EXIT_CODES.USAGE_ERROR);
    }

    const taskId = opts.taskId ? parseInt(opts.taskId, 10) : undefined;
    const projectId = opts.projectId ? parseInt(opts.projectId, 10) : undefined;
    const employeeId = opts.employeeId ? parseInt(opts.employeeId, 10) : undefined;

    // Validate: if task but no project, projectId will be resolved by the service
    if (taskId && !projectId) {
      // The service needs projectId — we'll need to look it up
      // For now, require explicit --project-id unless --task-id implies it
    }

    const effectiveProjectId = projectId ?? 0;

    if (opts.dryRun) {
      printDryRun('account.analytic.line', 'create', [
        {
          name: opts.description,
          task_id: taskId,
          project_id: effectiveProjectId,
          unit_amount: 0,
        },
      ]);
      return;
    }

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      // Check for already-running timer
      const running = await client.timesheets.getRunningTimers(employeeId);
      if (running.length > 0) {
        const r = running[0];
        const taskInfo = Array.isArray(r.task_id) ? `Task#${r.task_id[0]}` : 'project work';
        process.stderr.write(
          `✗ Error: A timer is already running (${taskInfo}, started ${r.date})\n  → odoo timesheets stop --confirm\n`
        );
        process.exit(EXIT_CODES.CONFLICT);
      }

      // Resolve project if only task given
      let resolvedProjectId = effectiveProjectId;
      if (taskId && !projectId) {
        const tasks = await client.searchRead('project.task', [['id', '=', taskId]], {
          fields: ['project_id'],
          limit: 1,
        });
        if (tasks.length > 0 && Array.isArray(tasks[0].project_id)) {
          resolvedProjectId = tasks[0].project_id[0];
        } else {
          process.stderr.write(
            `✗ Error: Cannot determine project for task ${taskId}\n  → Use --project-id explicitly\n`
          );
          process.exit(EXIT_CODES.USAGE_ERROR);
        }
      }

      const entry = await client.timesheets.startTimer({
        description: opts.description!,
        projectId: resolvedProjectId,
        taskId,
        employeeId,
      });

      const taskLabel = Array.isArray(entry.task_id)
        ? `Task#${entry.task_id[0]} "${entry.task_id[1]}"`
        : `Project#${resolvedProjectId}`;
      printSuccess(`Timer started: ${taskLabel} — ${entry.date}`);
    } catch (err) {
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return cmd;
}

function buildStopCommand(): Command {
  const cmd = new Command('stop')
    .description('Stop the running timer [WRITE — requires --confirm]')
    .addHelpText(
      'after',
      `
Examples:
  odoo timesheets stop --confirm
`
    );

  addAuthOptions(cmd);
  cmd.addOption(confirmOption());
  cmd.addOption(dryRunOption());
  cmd.option('--employee-id <n>', "Employee ID (default: current user's employee)");

  cmd.action(async () => {
    const opts = cmd.optsWithGlobals() as AuthFlags & {
      confirm?: boolean;
      dryRun?: boolean;
      employeeId?: string;
    };

    log('timesheets stop');

    try {
      requireConfirm('WRITE', opts, 'timesheets stop');
    } catch (err) {
      process.exit(handleError(err));
    }

    const employeeId = opts.employeeId ? parseInt(opts.employeeId, 10) : undefined;

    if (opts.dryRun) {
      printDryRun('account.analytic.line', 'write', [
        ['<running timer id>'],
        { unit_amount: '<elapsed>' },
      ]);
      return;
    }

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      const running = await client.timesheets.getRunningTimers(employeeId);
      if (running.length === 0) {
        process.stderr.write('✗ Error: No timer is currently running\n  → odoo timesheets start\n');
        process.exit(EXIT_CODES.NOT_FOUND);
      }

      const entry = await client.timesheets.stopTimer(running[0].id);
      const taskLabel = Array.isArray(entry.task_id)
        ? `Task#${entry.task_id[0]} "${entry.task_id[1]}"`
        : 'project work';
      const hours = formatHoursDecimal(entry.unit_amount);
      printSuccess(`Stopped: ${taskLabel} — ${hours} logged`);
    } catch (err) {
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return cmd;
}

function buildRunningCommand(): Command {
  const cmd = new Command('running')
    .description('Show currently running timer [READ] — exit 3 if none')
    .addHelpText(
      'after',
      `
Exit code 3 if no timer is running (useful in scripts).

Examples:
  odoo timesheets running
  odoo timesheets running --format json
`
    );

  addAuthOptions(cmd);
  addOutputOptions(cmd);
  cmd.option('--employee-id <n>', "Employee ID (default: current user's employee)");

  cmd.action(async () => {
    const opts = cmd.optsWithGlobals() as AuthFlags & {
      format?: string;
      employeeId?: string;
    };

    log('timesheets running');

    const employeeId = opts.employeeId ? parseInt(opts.employeeId, 10) : undefined;

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      const running = await client.timesheets.getRunningTimers(employeeId);
      if (running.length === 0) {
        process.stderr.write('No timer is currently running\n');
        process.exit(EXIT_CODES.NOT_FOUND);
      }

      const format = resolveFormat(opts.format);
      const entry = running[0];

      if (format === 'json' || format === 'ndjson') {
        const elapsed = Math.round((Date.now() - new Date(entry.date).getTime()) / 60000);
        const out = {
          id: entry.id,
          description: entry.name,
          date: entry.date,
          task_id: Array.isArray(entry.task_id) ? entry.task_id[0] : null,
          task_name: Array.isArray(entry.task_id) ? entry.task_id[1] : null,
          project_id: Array.isArray(entry.project_id) ? entry.project_id[0] : null,
          elapsed_minutes: elapsed,
        };
        await writeStdout(JSON.stringify(out, null, format === 'json' ? 2 : 0) + '\n');
      } else {
        const elapsed = Math.round((Date.now() - new Date(entry.date).getTime()) / 60000);
        const taskLabel = Array.isArray(entry.task_id)
          ? `Task#${entry.task_id[0]} "${entry.task_id[1]}"`
          : Array.isArray(entry.project_id)
            ? `Project#${entry.project_id[0]}`
            : 'Unknown';
        process.stdout.write(
          `● RUNNING: ${taskLabel} — started ${entry.date} (${formatElapsed(elapsed)} elapsed)\n`
        );
      }
    } catch (err) {
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return cmd;
}

function buildLogCommand(): Command {
  const cmd = new Command('log')
    .description('Log time retroactively [WRITE — requires --confirm]')
    .addHelpText(
      'after',
      `
--hours accepts decimal (1.5) or colon-separated (1:30) format.

Examples:
  odoo timesheets log --task-id 42 --hours 2.5 --description "Code review" --confirm
  odoo timesheets log --task-id 42 --hours 1:45 --date 2024-03-14 --description "Pair programming" --confirm
  odoo timesheets log --task-id $ODOO_TASK --hours 0.25 --description "Deploy $CI_COMMIT_SHA" --confirm
`
    );

  addAuthOptions(cmd);
  cmd.addOption(confirmOption());
  cmd.addOption(dryRunOption());
  cmd.option('--task-id <n>', 'Task ID');
  cmd.option('--project-id <n>', 'Project ID (required if no task)');
  cmd.option('--hours <h>', 'Hours: decimal (1.5) or H:MM (1:30)');
  cmd.option('--date <date>', 'Date YYYY-MM-DD (default: today)');
  cmd.option('--description <text>', 'Description');
  cmd.option('--employee-id <n>', "Employee ID (default: current user's employee)");

  cmd.action(async () => {
    const opts = cmd.optsWithGlobals() as AuthFlags & {
      confirm?: boolean;
      dryRun?: boolean;
      taskId?: string;
      projectId?: string;
      hours?: string;
      date?: string;
      description?: string;
      employeeId?: string;
    };

    log('timesheets log task=%s hours=%s', opts.taskId, opts.hours);

    try {
      requireConfirm('WRITE', opts, 'timesheets log');
    } catch (err) {
      process.exit(handleError(err));
    }

    if (!opts.hours) {
      process.stderr.write('✗ Error: --hours is required\n');
      process.exit(EXIT_CODES.USAGE_ERROR);
    }

    if (!opts.taskId && !opts.projectId) {
      process.stderr.write('✗ Error: --task-id or --project-id is required\n');
      process.exit(EXIT_CODES.USAGE_ERROR);
    }

    let hours: number;
    try {
      hours = parseHours(opts.hours);
    } catch (err) {
      process.exit(handleError(err));
      return;
    }

    const taskId = opts.taskId ? parseInt(opts.taskId, 10) : undefined;
    const projectId = opts.projectId ? parseInt(opts.projectId, 10) : undefined;
    const employeeId = opts.employeeId ? parseInt(opts.employeeId, 10) : undefined;
    const date = opts.date ?? new Date().toISOString().split('T')[0];

    if (opts.dryRun) {
      printDryRun('account.analytic.line', 'create', [
        {
          name: opts.description ?? '',
          task_id: taskId,
          project_id: projectId,
          unit_amount: hours,
          date,
        },
      ]);
      return;
    }

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      // Resolve projectId from task if needed
      let resolvedProjectId = projectId ?? 0;
      if (taskId && !projectId) {
        const tasks = await client.searchRead('project.task', [['id', '=', taskId]], {
          fields: ['project_id'],
          limit: 1,
        });
        if (tasks.length > 0 && Array.isArray(tasks[0].project_id)) {
          resolvedProjectId = tasks[0].project_id[0];
        }
      }

      const entry = await client.timesheets.logTime({
        description: opts.description ?? '',
        projectId: resolvedProjectId,
        hours,
        taskId,
        employeeId,
        date,
      });

      printSuccess(`Logged ${formatHoursDecimal(entry.unit_amount)} on ${date} (id=${entry.id})`);
    } catch (err) {
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return cmd;
}

function buildListCommand(): Command {
  const cmd = new Command('list').description('List timesheet entries [READ]').addHelpText(
    'after',
    `
Examples:
  odoo timesheets list --from 2024-03-11 --to 2024-03-15
  odoo timesheets list --project-id 5 --format csv > project-time.csv
`
  );

  addAuthOptions(cmd);
  addOutputOptions(cmd);
  cmd.option('--from <date>', 'Start date YYYY-MM-DD');
  cmd.option('--to <date>', 'End date YYYY-MM-DD');
  cmd.option('--employee-id <n>', 'Filter by employee');
  cmd.option('--project-id <n>', 'Filter by project');
  cmd.option('--task-id <n>', 'Filter by task');

  cmd.action(async () => {
    const opts = cmd.optsWithGlobals() as AuthFlags & {
      from?: string;
      to?: string;
      format?: string;
      employeeId?: string;
      projectId?: string;
      taskId?: string;
    };

    log('timesheets list from=%s to=%s', opts.from, opts.to);

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      const entries = await client.timesheets.list({
        dateFrom: opts.from,
        dateTo: opts.to,
        employeeId: opts.employeeId ? parseInt(opts.employeeId, 10) : undefined,
        projectId: opts.projectId ? parseInt(opts.projectId, 10) : undefined,
        taskId: opts.taskId ? parseInt(opts.taskId, 10) : undefined,
      });

      const format = resolveFormat(opts.format);
      const rows = entries.map((e) => ({
        id: e.id,
        date: e.date,
        description: e.name,
        hours: e.unit_amount.toFixed(2),
        project: Array.isArray(e.project_id) ? e.project_id[1] : '',
        task: Array.isArray(e.task_id) ? e.task_id[1] : '',
        employee: Array.isArray(e.employee_id) ? e.employee_id[1] : '',
      }));

      await render(rows, format);

      if (format === 'table' && rows.length > 0) {
        const total = entries.reduce((s, e) => s + e.unit_amount, 0);
        process.stderr.write(`Total: ${total.toFixed(2)} hours\n`);
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

function formatHoursDecimal(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

function formatElapsed(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
