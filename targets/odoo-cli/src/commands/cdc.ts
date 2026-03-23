/**
 * `odoo cdc` command group — Change Data Capture via mail.tracking.value.
 *
 * Commands:
 *   cdc check <model>               Check CDC coverage for a model [READ]
 *   cdc history <model> <id>        Get full tracked history for a record [READ]
 *   cdc feed <model>                Stream all tracked changes for a model [READ]
 */

import { Command } from 'commander';
import debug from 'debug';
import { createAuthClient, type AuthFlags } from '../middleware/auth';
import { addAuthOptions, addOutputOptions } from '../middleware/common-params';
import { resolveFormat, render, formatJson } from '../output/formatter';
import { handleError, EXIT_CODES } from '../output/errors';
import type { TrackingEvent } from '@marcfargas/odoo-client';

const log = debug('odoo-cli:cdc');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Flatten a TrackingEvent into a plain record suitable for table/CSV/JSON output.
 */
function flattenEvent(ev: TrackingEvent): Record<string, unknown> {
  return {
    id: ev.id,
    messageId: ev.messageId,
    model: ev.model,
    recordId: ev.recordId,
    date: ev.date,
    authorName: ev.authorName,
    fieldName: ev.field.name,
    fieldLabel: ev.field.label,
    fieldType: ev.field.type,
    oldDisplay: ev.old.display,
    newDisplay: ev.new.display,
    oldRaw: ev.old.raw,
    newRaw: ev.new.raw,
    ...(ev.old.currency ? { currency: ev.old.currency[1] } : {}),
    ...(ev.old.isTranslated ? { isTranslated: true } : {}),
    ...(ev.field.deletedInfo ? { fieldDeleted: true } : {}),
  };
}

// ── Command builder ───────────────────────────────────────────────────────────

export function buildCdcCommand(): Command {
  const cdc = new Command('cdc')
    .description('Change Data Capture — stream tracked field changes from mail.tracking.value')
    .addHelpText(
      'after',
      `
Built on Odoo's native field-change audit log (mail.tracking.value).
Only models with _inherit='mail.thread' and tracking=True fields have CDC data.

Examples:
  odoo cdc check contract.contract
  odoo cdc history contract.contract 42
  odoo cdc history contract.contract 42 --since 2025-01-01 --field-names state,date_start
  odoo cdc feed contract.contract --since 2025-01-01 --format ndjson
  odoo cdc feed contract.contract --since 2025-01-01 --page-size 200
`
    );

  cdc.addCommand(buildCheckCommand());
  cdc.addCommand(buildHistoryCommand());
  cdc.addCommand(buildFeedCommand());

  return cdc;
}

// ── check ─────────────────────────────────────────────────────────────────────

function buildCheckCommand(): Command {
  const cmd = new Command('check')
    .description('Check CDC coverage for a model [READ]')
    .argument('<model>', 'Odoo model (e.g., contract.contract)')
    .addHelpText(
      'after',
      `
Reports:
  - isMailThread: whether the model inherits mail.thread
  - trackedFieldCount: number of fields with tracking=True
  - hasHistory: whether any tracking records exist

Examples:
  odoo cdc check contract.contract
  odoo cdc check account.move --format json
`
    );

  addAuthOptions(cmd);
  addOutputOptions(cmd);

  cmd.action(async (model: string, _opts, command: Command) => {
    const flags = command.optsWithGlobals() as AuthFlags & { format?: string };
    try {
      const client = await createAuthClient(flags);
      const result = await client.cdc.check(model);

      const rows = [
        {
          property: 'model',
          value: result.model,
        },
        {
          property: 'isMailThread',
          value: String(result.isMailThread),
        },
        {
          property: 'trackedFieldCount',
          value: String(result.trackedFieldCount),
        },
        {
          property: 'hasHistory',
          value: String(result.hasHistory),
        },
      ];

      const format = resolveFormat(flags.format);
      if (format === 'json' || format === 'ndjson') {
        await formatJson([result]);
      } else {
        await render(rows, format);
      }
    } catch (err) {
      process.exit(handleError(err));
    }
  });

  return cmd;
}

// ── history ───────────────────────────────────────────────────────────────────

function buildHistoryCommand(): Command {
  const cmd = new Command('history')
    .description('Get all tracked field changes for a record [READ]')
    .argument('<model>', 'Odoo model (e.g., contract.contract)')
    .argument('<id>', 'Record ID')
    .option(
      '--field-names <fields>',
      'Comma-separated field technical names to filter (e.g. state,date_start)'
    )
    .option('--since <datetime>', 'Only events on or after this datetime (ISO)')
    .option('--until <datetime>', 'Only events before this datetime (ISO)')
    .option('--order <dir>', 'Sort order: asc (default) or desc', 'asc')
    .addHelpText(
      'after',
      `
Each event = one field change: who changed what, from what to what, when.
Multiple fields changed in the same write share the same messageId.

Examples:
  odoo cdc history contract.contract 42
  odoo cdc history account.move 31051 --format json
  odoo cdc history contract.contract 42 --field-names state,date_start --order desc
  odoo cdc history contract.contract 42 --since 2025-01-01 --until 2026-01-01
`
    );

  addAuthOptions(cmd);
  addOutputOptions(cmd);

  cmd.action(async (model: string, idStr: string, _opts, command: Command) => {
    const flags = command.optsWithGlobals() as AuthFlags & {
      format?: string;
      fieldNames?: string;
      since?: string;
      until?: string;
      order?: string;
    };

    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      console.error(`Error: invalid id '${idStr}'`);
      process.exit(EXIT_CODES.USAGE_ERROR);
    }

    try {
      const client = await createAuthClient(flags);
      const events = await client.cdc.getHistory(model, id, {
        fields: flags.fieldNames ? flags.fieldNames.split(',').map((f) => f.trim()) : undefined,
        since: flags.since,
        until: flags.until,
        order: flags.order === 'desc' ? 'desc' : 'asc',
      });

      log('getHistory returned %d events', events.length);

      const flat = events.map(flattenEvent);
      const format = resolveFormat(flags.format);
      await render(flat, format);
    } catch (err) {
      process.exit(handleError(err));
    }
  });

  return cmd;
}

// ── feed ──────────────────────────────────────────────────────────────────────

function buildFeedCommand(): Command {
  const cmd = new Command('feed')
    .description('Stream all tracked changes for a model — paginated feed [READ]')
    .argument('<model>', 'Odoo model (e.g., contract.contract)')
    .option('--since <datetime>', 'Only events on or after this datetime (ISO)')
    .option('--until <datetime>', 'Only events before this datetime (ISO)')
    .option('--cursor <id>', 'Resume from this tracking value ID (from --show-cursor output)')
    .option('--page-size <n>', 'Records per page (default: 100)', '100')
    .option('--show-cursor', 'Print final cursor ID to stderr for resumable streaming')
    .addHelpText(
      'after',
      `
Streams all tracked changes for a model. Use --since to limit the time range.
Default output format is ndjson (one event per line) — ideal for piping.
Use --show-cursor to get a resume point: it prints "cursor:<id>" to stderr.

Examples:
  odoo cdc feed contract.contract --since 2025-01-01 --format ndjson
  odoo cdc feed contract.contract --since 2025-01-01 > changes.ndjson
  odoo cdc feed contract.contract --cursor 269575 --show-cursor
  odoo cdc feed account.move --since 2026-01-01 --page-size 200 --format json
`
    );

  addAuthOptions(cmd);
  addOutputOptions(cmd);

  cmd.action(async (model: string, _opts, command: Command) => {
    const flags = command.optsWithGlobals() as AuthFlags & {
      format?: string;
      since?: string;
      until?: string;
      cursor?: string;
      pageSize?: string;
      showCursor?: boolean;
    };

    const pageSize = parseInt(flags.pageSize ?? '100', 10);
    const cursor = flags.cursor ? parseInt(flags.cursor, 10) : undefined;

    try {
      const client = await createAuthClient(flags);
      const format = resolveFormat(flags.format ?? 'ndjson');

      if (format === 'ndjson') {
        // True streaming — write each event to stdout as it arrives
        let lastId = cursor ?? 0;
        for await (const ev of client.cdc.getFeed(model, {
          since: flags.since,
          until: flags.until,
          pageSize,
          cursor,
        })) {
          process.stdout.write(JSON.stringify(flattenEvent(ev)) + '\n');
          lastId = ev.id;
        }
        if (flags.showCursor) {
          process.stderr.write(`cursor:${lastId}\n`);
        }
      } else {
        // Collect all then render
        const events: TrackingEvent[] = [];
        for await (const ev of client.cdc.getFeed(model, {
          since: flags.since,
          until: flags.until,
          pageSize,
          cursor,
        })) {
          events.push(ev);
        }
        const flat = events.map(flattenEvent);
        await render(flat, format);
        if (flags.showCursor && events.length > 0) {
          process.stderr.write(`cursor:${events[events.length - 1].id}\n`);
        }
      }
    } catch (err) {
      process.exit(handleError(err));
    }
  });

  return cmd;
}
