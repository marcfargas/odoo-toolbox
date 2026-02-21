/**
 * `odoo records` command group — generic CRUD on any Odoo model.
 *
 * Commands:
 *   records search <model>          Filter + list records [READ]
 *   records get <model> <id>        Fetch a single record [READ]
 *   records create <model>          Create a record [WRITE]
 *   records write <model> <id>      Update records (batch) [WRITE]
 *   records delete <model> <id>     Delete a record [DESTRUCTIVE]
 *   records count <model>           Count matching records [READ]
 *   records call <model> <method>   Call arbitrary method [WRITE]
 */

import { Command } from 'commander';
import debug from 'debug';
import { createAuthClient, type AuthFlags } from '../middleware/auth';
import { requireConfirm, printDryRun } from '../middleware/safety';
import {
  addAuthOptions,
  addSearchOptions,
  addPaginationOptions,
  addOutputOptions,
  addWriteOptions,
  parseFields,
  resolveLimit,
  confirmOption,
  dryRunOption,
  contextOption,
} from '../middleware/common-params';
import {
  resolveFormat,
  render,
  renderSingle,
  pagedSearchRead,
  formatNdjson,
  flattenRecord,
} from '../output/formatter';
import { handleError, EXIT_CODES } from '../output/errors';
import {
  parseDomainArg,
  parseDomainJson,
  readDomainFile,
  parseFilterArgs,
  combineDomains,
} from '../parsing/domain-parser';
import { parseJsonArg, parseJsonArray, readJsonFile, parseIds } from '../parsing/json-arg';
import { showHelpExtra } from '../help/extra-help';
import { writeStdout, toCsvRow } from '../output/stream-writer';

const log = debug('odoo-cli:records');

export function buildRecordsCommand(): Command {
  const records = new Command('records').description('Generic CRUD on any Odoo model').addHelpText(
    'after',
    `
Safety levels:
  READ        search, get, count, call (read methods)
  WRITE       create, write, call (mutating methods)  — requires --confirm
  DESTRUCTIVE delete                                  — requires --confirm

Examples:
  odoo records search res.partner --fields id,name --limit 10
  odoo records get crm.lead 42
  odoo records create res.partner --data '{"name":"Acme"}' --confirm
  odoo records write crm.lead 42 --data '{"stage_id":5}' --confirm
  odoo records delete crm.lead 42 --confirm
  odoo records count res.partner --filter active=true
  odoo records call sale.order action_confirm --ids 42 --confirm
`
  );

  // --help-extra
  records.option('--help-extra', 'Show extended skill documentation for records');
  records.hook('preAction', async (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.helpExtra) {
      await showHelpExtra('records');
      process.exit(0);
    }
  });

  records.addCommand(buildSearchCommand());
  records.addCommand(buildGetCommand());
  records.addCommand(buildCreateCommand());
  records.addCommand(buildWriteCommand());
  records.addCommand(buildDeleteCommand());
  records.addCommand(buildCountCommand());
  records.addCommand(buildCallCommand());

  return records;
}

// ── Helper: resolve domain from flags ────────────────────────────────

async function resolveDomain(opts: {
  domain?: string;
  domainJson?: string;
  domainFile?: string;
  filter?: string[];
}): Promise<any[]> {
  let base: any[] = [];

  if (opts.domainFile) {
    base = await readDomainFile(opts.domainFile);
  } else if (opts.domainJson) {
    base = parseDomainJson(opts.domainJson);
  } else if (opts.domain) {
    base = parseDomainArg(opts.domain);
  }

  const filterTerms = opts.filter ? parseFilterArgs(opts.filter) : [];
  return combineDomains(base, filterTerms);
}

// ── records search ───────────────────────────────────────────────────

function buildSearchCommand(): Command {
  const search = new Command('search')
    .description('Filter and list records [READ]')
    .argument('<model>', 'Odoo model name (e.g., res.partner, crm.lead)')
    .addHelpText(
      'after',
      `
Examples:
  odoo records search crm.lead --fields id,name,stage_id --limit 20
  odoo records search res.partner --filter active=true --count
  odoo records search sale.order --domain '[("state","=","sale")]' --format csv
  odoo records search account.move --all --format ndjson > invoices.ndjson
`
    );

  addAuthOptions(search);
  addSearchOptions(search);
  addPaginationOptions(search);
  addOutputOptions(search);
  search.option('--count', 'Print count instead of records');

  search.action(async (model: string) => {
    const opts = search.optsWithGlobals() as AuthFlags & {
      domain?: string;
      domainJson?: string;
      domainFile?: string;
      filter?: string[];
      fields?: string;
      limit?: number;
      all?: boolean;
      offset?: number;
      pageSize?: number;
      order?: string;
      format?: string;
      count?: boolean;
    };

    log('records search %s opts=%O', model, opts);

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      const domain = await resolveDomain(opts);
      const fields = parseFields(opts.fields);
      const format = resolveFormat(opts.format);
      const effectiveLimit = resolveLimit(opts);
      const pageSize = opts.pageSize ?? 500;

      // --count shorthand
      if (opts.count) {
        const count = await client.searchCount(model, domain);
        await writeStdout(String(count) + '\n');
        return;
      }

      log(
        'search domain=%O fields=%O limit=%d offset=%d',
        domain,
        fields,
        effectiveLimit,
        opts.offset
      );

      if (effectiveLimit === 0 || opts.all) {
        // Paged fetch — stream for ndjson/csv, buffer for json/table
        const searchFn = (offset: number, limit: number) =>
          client.searchRead(model, domain, {
            fields: fields.length > 0 ? fields : undefined,
            offset,
            limit,
            order: opts.order,
          });

        if (format === 'ndjson') {
          let firstPage = true;
          for await (const page of pagedSearchRead(searchFn, pageSize)) {
            await formatNdjson(page);
            if (firstPage && page.length > 0) firstPage = false;
          }
          return;
        }

        if (format === 'csv') {
          // headerCols is captured from the first record and reused for all pages
          // to prevent column mismatch when different pages return different field sets.
          let headerCols: string[] | null = null;
          for await (const page of pagedSearchRead(searchFn, pageSize)) {
            for (const rec of page) {
              const flat = flattenRecord(rec);
              if (!headerCols) {
                headerCols = Object.keys(flat);
                await writeStdout(toCsvRow(headerCols) + '\n');
              }
              await writeStdout(toCsvRow(headerCols.map((c) => flat[c] ?? '')) + '\n');
            }
          }
          return;
        }

        // json/table: buffer all pages
        const allRecords: Record<string, any>[] = [];
        for await (const page of pagedSearchRead(searchFn, pageSize)) {
          allRecords.push(...page);
        }
        await render(allRecords, format);
      } else {
        const records = await client.searchRead(model, domain, {
          fields: fields.length > 0 ? fields : undefined,
          offset: opts.offset,
          limit: effectiveLimit,
          order: opts.order,
        });
        await render(records, format);
      }
    } catch (err) {
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return search;
}

// ── records get ──────────────────────────────────────────────────────

function buildGetCommand(): Command {
  const get = new Command('get')
    .description('Fetch a single record [READ] (default fields: id, display_name)')
    .argument('<model>', 'Odoo model name')
    .argument('<id>', 'Record ID')
    .addHelpText(
      'after',
      `
Default fields: id, display_name. Use --fields to request more.

Examples:
  odoo records get crm.lead 42
  odoo records get res.partner 7 --fields id,name,email,phone
  odoo records get sale.order 88 --format json
`
    );

  addAuthOptions(get);
  addOutputOptions(get);

  get.action(async (model: string, idStr: string) => {
    const opts = get.optsWithGlobals() as AuthFlags & { fields?: string; format?: string };
    const id = parseInt(idStr, 10);

    if (isNaN(id)) {
      process.stderr.write(`✗ Error: Invalid ID '${idStr}'\n`);
      process.exit(EXIT_CODES.USAGE_ERROR);
    }

    log('records get %s %d', model, id);

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      // Default: id + display_name only
      const fields = parseFields(opts.fields);
      const effectiveFields = fields.length > 0 ? fields : ['id', 'display_name'];
      const format = resolveFormat(opts.format);

      const records = await client.read(model, [id], effectiveFields);
      if (records.length === 0) {
        process.stderr.write(`✗ Error: ${model}#${id} not found\n`);
        process.exit(EXIT_CODES.NOT_FOUND);
      }

      await renderSingle(records[0], format);
    } catch (err) {
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return get;
}

// ── records create ───────────────────────────────────────────────────

function buildCreateCommand(): Command {
  const create = new Command('create')
    .description('Create a record [WRITE — requires --confirm]')
    .argument('<model>', 'Odoo model name')
    .addHelpText(
      'after',
      `
Examples:
  odoo records create res.partner --data '{"name":"Acme Corp"}' --confirm
  echo '{"name":"Test"}' | odoo records create project.project --data-file - --confirm
  odoo records create crm.lead --data '{"name":"New Lead"}' --confirm --dry-run
`
    );

  addAuthOptions(create);
  addWriteOptions(create);
  addOutputOptions(create);
  create.option('--data <json>', 'Field values as JSON object');
  create.option('--data-file <file>', "Read --data from file ('-' for stdin)");

  create.action(async (model: string) => {
    const opts = create.optsWithGlobals() as AuthFlags & {
      data?: string;
      dataFile?: string;
      confirm?: boolean;
      dryRun?: boolean;
      context?: string;
      format?: string;
    };

    log('records create %s', model);

    try {
      requireConfirm('WRITE', opts, `records create ${model}`);
    } catch (err) {
      process.exit(handleError(err));
    }

    let values: Record<string, any>;
    try {
      if (opts.dataFile) {
        values = await readJsonFile(opts.dataFile, '--data-file');
      } else if (opts.data) {
        values = parseJsonArg(opts.data, '--data');
      } else {
        process.stderr.write('✗ Error: --data or --data-file is required for create\n');
        process.exit(EXIT_CODES.USAGE_ERROR);
        return;
      }
    } catch (err) {
      process.exit(handleError(err));
      return;
    }

    const context = opts.context ? parseJsonArg(opts.context, '--context') : {};

    if (opts.dryRun) {
      printDryRun(model, 'create', [values], { context });
      return;
    }

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      const format = resolveFormat(opts.format);
      const id = await client.create(model, values, context);

      if (format === 'json' || format === 'ndjson') {
        await writeStdout(JSON.stringify({ id }) + '\n');
      } else {
        process.stderr.write(`✓ Created ${model} id=${id}\n`);
        await writeStdout(String(id) + '\n');
      }
    } catch (err) {
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return create;
}

// ── records write ────────────────────────────────────────────────────

function buildWriteCommand(): Command {
  const write = new Command('write')
    .description('Update records — batch by comma-separated IDs [WRITE — requires --confirm]')
    .argument('<model>', 'Odoo model name')
    .argument('<ids>', 'Record ID or comma-separated IDs (e.g., 1,2,3)')
    .addHelpText(
      'after',
      `
Examples:
  odoo records write crm.lead 42 --data '{"stage_id":5}' --confirm
  odoo records write res.partner 1,2,3 --data '{"active":false}' --confirm
  odoo records write crm.lead 42 --data '{"name":"New Name"}' --confirm --dry-run
`
    );

  addAuthOptions(write);
  addWriteOptions(write);
  write.option('--data <json>', 'Field values to update as JSON object');
  write.option('--data-file <file>', "Read --data from file ('-' for stdin)");

  write.action(async (model: string, idsStr: string) => {
    const opts = write.optsWithGlobals() as AuthFlags & {
      data?: string;
      dataFile?: string;
      confirm?: boolean;
      dryRun?: boolean;
      context?: string;
    };

    let ids: number[];
    try {
      ids = parseIds(idsStr);
    } catch (err) {
      process.exit(handleError(err));
      return;
    }

    log('records write %s ids=%O', model, ids);

    try {
      requireConfirm('WRITE', opts, `records write ${model} [${ids.join(',')}]`);
    } catch (err) {
      process.exit(handleError(err));
    }

    let values: Record<string, any>;
    try {
      if (opts.dataFile) {
        values = await readJsonFile(opts.dataFile, '--data-file');
      } else if (opts.data) {
        values = parseJsonArg(opts.data, '--data');
      } else {
        process.stderr.write('✗ Error: --data or --data-file is required for write\n');
        process.exit(EXIT_CODES.USAGE_ERROR);
        return;
      }
    } catch (err) {
      process.exit(handleError(err));
      return;
    }

    const context = opts.context ? parseJsonArg(opts.context, '--context') : {};

    if (opts.dryRun) {
      printDryRun(model, 'write', [ids, values], { context });
      return;
    }

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      await client.write(model, ids, values, context);
      process.stderr.write(`✓ Updated ${model} ids=[${ids.join(',')}]\n`);
    } catch (err) {
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return write;
}

// ── records delete ───────────────────────────────────────────────────

function buildDeleteCommand(): Command {
  const del = new Command('delete')
    .description('Delete a record [DESTRUCTIVE — requires --confirm]')
    .argument('<model>', 'Odoo model name')
    .argument('<ids>', 'Record ID or comma-separated IDs')
    .addHelpText(
      'after',
      `
Always fetches display_name before deleting for confirmation display.
Batch delete shows count: "Delete 12 records from crm.lead?"

Examples:
  odoo records delete crm.lead 42 --confirm
  odoo records delete res.partner 1,2,3 --confirm
  odoo records delete crm.lead 42 --confirm --dry-run
`
    );

  addAuthOptions(del);
  del.addOption(confirmOption());
  del.addOption(dryRunOption());

  del.action(async (model: string, idsStr: string) => {
    const opts = del.optsWithGlobals() as AuthFlags & {
      confirm?: boolean;
      dryRun?: boolean;
    };

    let ids: number[];
    try {
      ids = parseIds(idsStr);
    } catch (err) {
      process.exit(handleError(err));
      return;
    }

    log('records delete %s ids=%O', model, ids);

    try {
      requireConfirm('DESTRUCTIVE', opts, `records delete ${model} [${ids.join(',')}]`);
    } catch (err) {
      process.exit(handleError(err));
    }

    if (opts.dryRun) {
      printDryRun(model, 'unlink', [ids]);
      process.stderr.write(`DRY RUN: Would delete ${model} ids=[${ids.join(',')}]\n`);
      return;
    }

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      // Fetch names first for display
      const records = await client.read(model, ids, ['id', 'display_name']).catch(() => []);
      if (ids.length === 1 && records.length > 0) {
        process.stderr.write(`Deleting ${model}#${ids[0]} (${records[0].display_name})\n`);
      } else {
        process.stderr.write(`Deleting ${ids.length} records from ${model}\n`);
      }

      await client.unlink(model, ids);
      process.stderr.write(`✓ Deleted ${model} ids=[${ids.join(',')}]\n`);
    } catch (err) {
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return del;
}

// ── records count ────────────────────────────────────────────────────

function buildCountCommand(): Command {
  const count = new Command('count')
    .description('Count matching records [READ]')
    .argument('<model>', 'Odoo model name')
    .addHelpText(
      'after',
      `
Always outputs a bare integer to stdout.

Examples:
  odoo records count res.partner --filter active=true
  COUNT=$(odoo records count crm.lead --filter stage_id.name=Won)
`
    );

  addAuthOptions(count);
  addSearchOptions(count);

  count.action(async (model: string) => {
    const opts = count.optsWithGlobals() as AuthFlags & {
      domain?: string;
      domainJson?: string;
      domainFile?: string;
      filter?: string[];
    };

    log('records count %s', model);

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      const domain = await resolveDomain(opts);
      const n = await client.searchCount(model, domain);
      await writeStdout(String(n) + '\n');
    } catch (err) {
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return count;
}

// ── records call ─────────────────────────────────────────────────────

function buildCallCommand(): Command {
  const call = new Command('call')
    .description('Call an arbitrary model method [WRITE — requires --confirm for mutations]')
    .argument('<model>', 'Odoo model name')
    .argument('<method>', 'Method name (e.g., action_confirm)')
    .addHelpText(
      'after',
      `
Examples:
  odoo records call sale.order action_confirm --ids 42 --confirm
  odoo records call sale.order action_cancel --ids 42,43 --confirm
  odoo records call account.move action_post --ids 101 --kwargs '{"force_whole_entry":true}' --confirm
  odoo records call sale.order action_confirm --ids 42 --dry-run
`
    );

  addAuthOptions(call);
  call.option('--ids <n,n,...>', 'Record IDs (comma-separated)');
  call.option('--args <json>', 'Positional args as JSON array (default: [])');
  call.option('--kwargs <json>', 'Keyword args as JSON object (default: {})');
  call.option('--read-only', 'Treat this as a read-only call (skips --confirm requirement)');
  call.addOption(confirmOption());
  call.addOption(dryRunOption());
  call.addOption(contextOption());
  addOutputOptions(call);

  call.action(async (model: string, method: string) => {
    const opts = call.optsWithGlobals() as AuthFlags & {
      ids?: string;
      args?: string;
      kwargs?: string;
      context?: string;
      readOnly?: boolean;
      confirm?: boolean;
      dryRun?: boolean;
      format?: string;
    };

    log('records call %s.%s readOnly=%s', model, method, opts.readOnly);

    // All methods are WRITE by default. Pass --read-only to skip --confirm.
    // Custom Odoo modules can have methods named read_xxx that mutate data,
    // so we cannot safely infer safety from method names.
    const level = opts.readOnly ? 'READ' : 'WRITE';

    if (level === 'WRITE') {
      try {
        requireConfirm('WRITE', opts, `records call ${model}.${method}`);
      } catch (err) {
        process.exit(handleError(err));
      }
    }

    let args: any[] = [];
    let kwargs: Record<string, any> = {};

    try {
      if (opts.args) args = parseJsonArray(opts.args, '--args');
      if (opts.kwargs) kwargs = parseJsonArg(opts.kwargs, '--kwargs');
      if (opts.context) {
        const ctx = parseJsonArg(opts.context, '--context');
        kwargs = { ...kwargs, context: ctx };
      }
    } catch (err) {
      process.exit(handleError(err));
      return;
    }

    // Prepend IDs to args if --ids provided
    let ids: number[] | undefined;
    if (opts.ids) {
      try {
        ids = parseIds(opts.ids);
      } catch (err) {
        process.exit(handleError(err));
        return;
      }
    }

    const callArgs = ids ? [ids, ...args] : args;

    if (opts.dryRun) {
      printDryRun(model, method, callArgs, kwargs);
      return;
    }

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      const result = await client.call(model, method, callArgs, kwargs, { safetyLevel: level });
      const format = resolveFormat(opts.format);

      if (result !== null && result !== undefined) {
        if (Array.isArray(result)) {
          await render(
            result.filter((r) => typeof r === 'object'),
            format
          );
        } else if (typeof result === 'object') {
          await writeStdout(JSON.stringify(result, null, 2) + '\n');
        } else {
          await writeStdout(String(result) + '\n');
        }
      } else {
        process.stderr.write(`✓ ${model}.${method}() completed\n`);
      }
    } catch (err) {
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return call;
}
