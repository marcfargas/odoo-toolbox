/**
 * `odoo accounting` command group — all read-only accounting queries.
 *
 * Commands:
 *   accounting cash-accounts      Discover cash/bank journal accounts [READ]
 *   accounting cash-balance       Show balance as-of a date [READ]
 *   accounting trace-recon        Show reconciliation for a move [READ]
 *   accounting posted-moves       List posted journal entries [READ]
 *   accounting days-to-pay        Payment term analysis for an invoice [READ]
 *
 * All commands are READ — no mutations, no --confirm required.
 * Requires account module (Invoicing/Accounting) to be installed.
 */

import { Command } from 'commander';
import debug from 'debug';
import { createAuthClient, type AuthFlags } from '../middleware/auth';
import { addAuthOptions, addOutputOptions } from '../middleware/common-params';
import { resolveFormat, render, renderKeyValue } from '../output/formatter';
import { handleError, EXIT_CODES } from '../output/errors';
import { writeStdout } from '../output/stream-writer';
import { showHelpExtra } from '../help/extra-help';

const log = debug('odoo-cli:accounting');

export function buildAccountingCommand(): Command {
  const acc = new Command('accounting')
    .description('Read-only accounting queries — cash discovery, balances, reconciliation')
    .addHelpText(
      'after',
      `
All commands are READ-ONLY — no confirmation required.
Requires: account Odoo module (Invoicing/Accounting).

Examples:
  odoo accounting cash-accounts
  odoo accounting cash-balance --as-of 2024-03-31
  odoo accounting posted-moves --from 2024-01-01 --to 2024-03-31
  odoo accounting trace-recon 42
  odoo accounting days-to-pay 1042
`
    );

  // --help-extra
  acc.option('--help-extra', 'Show extended skill documentation for accounting');
  acc.hook('preAction', async (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.helpExtra) {
      await showHelpExtra('accounting');
      process.exit(0);
    }
  });

  acc.addCommand(buildCashAccountsCommand());
  acc.addCommand(buildCashBalanceCommand());
  acc.addCommand(buildTraceReconCommand());
  acc.addCommand(buildPostedMovesCommand());
  acc.addCommand(buildDaysToPayCommand());

  return acc;
}

function buildCashAccountsCommand(): Command {
  const cmd = new Command('cash-accounts')
    .description('Discover cash and bank journal accounts [READ]')
    .addHelpText(
      'after',
      `
Examples:
  odoo accounting cash-accounts
  odoo accounting cash-accounts --format json
`
    );

  addAuthOptions(cmd);
  addOutputOptions(cmd);

  cmd.action(async () => {
    const opts = cmd.optsWithGlobals() as AuthFlags & { format?: string };
    log('accounting cash-accounts');

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      const accounts = await client.accounting.discoverCashAccounts();
      const format = resolveFormat(opts.format);

      const rows = accounts.map((a) => ({
        journal_name: a.journalName,
        journal_type: a.journalType,
        account_id: a.accountId,
        account_name: a.accountName,
      }));

      await render(rows, format);
    } catch (err) {
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return cmd;
}

function buildCashBalanceCommand(): Command {
  const cmd = new Command('cash-balance')
    .description('Show cash/bank balance as-of a date [READ]')
    .addHelpText(
      'after',
      `
Examples:
  odoo accounting cash-balance
  odoo accounting cash-balance --as-of 2024-03-31
  BALANCE=$(odoo accounting cash-balance --format json | jq '[.[].balance] | add')
`
    );

  addAuthOptions(cmd);
  addOutputOptions(cmd);
  cmd.option('--as-of <date>', 'Balance date YYYY-MM-DD (default: today)');
  cmd.option('--journal-id <n,...>', 'Specific journal IDs (default: all cash/bank)');

  cmd.action(async () => {
    const opts = cmd.optsWithGlobals() as AuthFlags & {
      asOf?: string;
      journalId?: string;
      format?: string;
    };

    log('accounting cash-balance as-of=%s', opts.asOf);

    const asOf = opts.asOf ?? new Date().toISOString().split('T')[0];

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      const format = resolveFormat(opts.format);

      let cashAccountIds: number[];
      if (opts.journalId) {
        // Resolve account IDs from journal IDs
        const journalIds = opts.journalId.split(',').map((s) => parseInt(s.trim(), 10));
        const journals = await client.searchRead<{ default_account_id: [number, string] | false }>(
          'account.journal',
          [['id', 'in', journalIds]],
          { fields: ['default_account_id'] }
        );
        cashAccountIds = journals
          .filter((j) => Array.isArray(j.default_account_id))
          .map((j) => (j.default_account_id as [number, string])[0]);
      } else {
        cashAccountIds = await client.accounting.getCashAccountIds();
      }

      if (cashAccountIds.length === 0) {
        process.stderr.write('No cash/bank accounts found\n');
        process.exit(EXIT_CODES.NOT_FOUND);
      }

      // Get per-account balances
      const accounts = await client.accounting.discoverCashAccounts();
      const rows: { journal: string; balance: number; currency: string }[] = [];
      let totalBalance = 0;

      for (const account of accounts) {
        if (!cashAccountIds.includes(account.accountId)) continue;
        const balance = await client.accounting.getCashBalance([account.accountId], asOf);
        rows.push({
          journal: account.journalName,
          balance,
          currency: 'EUR', // Odoo doesn't easily expose currency per account without more calls
        });
        totalBalance += balance;
      }

      if (format === 'json' || format === 'ndjson') {
        await writeStdout(JSON.stringify(rows, null, format === 'json' ? 2 : 0) + '\n');
      } else {
        await render(
          rows.map((r) => ({ ...r, balance: r.balance.toFixed(2) })),
          format
        );
        process.stderr.write(`TOTAL: ${totalBalance.toFixed(2)}\n`);
      }
    } catch (err) {
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return cmd;
}

function buildTraceReconCommand(): Command {
  const cmd = new Command('trace-recon')
    .description('Show reconciliation trace for a journal entry move [READ]')
    .argument('<move-id>', 'Journal entry (account.move) ID')
    .addHelpText(
      'after',
      `
Examples:
  odoo accounting trace-recon 42
  odoo accounting trace-recon 42 --format json
`
    );

  addAuthOptions(cmd);
  addOutputOptions(cmd);

  cmd.action(async (moveIdStr: string) => {
    const opts = cmd.optsWithGlobals() as AuthFlags & { format?: string };
    const moveId = parseInt(moveIdStr, 10);

    if (isNaN(moveId)) {
      process.stderr.write(`✗ Error: Invalid move-id '${moveIdStr}'\n`);
      process.exit(EXIT_CODES.USAGE_ERROR);
    }

    log('accounting trace-recon %d', moveId);

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      const format = resolveFormat(opts.format);

      // Find reconcile_id on the move's lines
      const lines = await client.searchRead<{ full_reconcile_id: [number, string] | false }>(
        'account.move.line',
        [
          ['move_id', '=', moveId],
          ['full_reconcile_id', '!=', false],
        ],
        { fields: ['full_reconcile_id'], limit: 1 }
      );

      if (lines.length === 0) {
        process.stderr.write(`No reconciliation found for move#${moveId}\n`);
        process.exit(EXIT_CODES.NOT_FOUND);
      }

      const fullReconcileId = (lines[0].full_reconcile_id as [number, string])[0];
      const trace = await client.accounting.traceReconciliation(fullReconcileId);

      if (format === 'json' || format === 'ndjson') {
        await writeStdout(JSON.stringify(trace, null, format === 'json' ? 2 : 0) + '\n');
      } else {
        const rows = trace.lines.map((l: any) => ({
          move_id: l.move_id,
          account: Array.isArray(l.account_id) ? l.account_id[1] : l.account_id,
          partner: Array.isArray(l.partner_id) ? l.partner_id[1] : '',
          debit: typeof l.debit === 'number' ? l.debit.toFixed(2) : '',
          credit: typeof l.credit === 'number' ? l.credit.toFixed(2) : '',
        }));
        await render(rows, format);
      }
    } catch (err) {
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return cmd;
}

function buildPostedMovesCommand(): Command {
  const cmd = new Command('posted-moves')
    .description('List posted journal entries [READ]')
    .addHelpText(
      'after',
      `
Examples:
  odoo accounting posted-moves --from 2024-01-01 --to 2024-03-31
  odoo accounting posted-moves --journal-id 5 --format csv > moves.csv
`
    );

  addAuthOptions(cmd);
  addOutputOptions(cmd);
  cmd.option('--from <date>', 'Start date YYYY-MM-DD');
  cmd.option('--to <date>', 'End date YYYY-MM-DD');
  cmd.option('--journal-id <n,...>', 'Filter by journal IDs');

  cmd.action(async () => {
    const opts = cmd.optsWithGlobals() as AuthFlags & {
      from?: string;
      to?: string;
      journalId?: string;
      format?: string;
    };

    log('accounting posted-moves from=%s to=%s', opts.from, opts.to);

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      const domain: any[] = [];
      if (opts.from) domain.push(['date', '>=', opts.from]);
      if (opts.to) domain.push(['date', '<=', opts.to]);
      if (opts.journalId) {
        const jIds = opts.journalId.split(',').map((s) => parseInt(s.trim(), 10));
        domain.push(['journal_id', 'in', jIds]);
      }

      const lines = await client.accounting.getPostedMoveLines(domain, {
        fields: [
          'move_id',
          'date',
          'account_id',
          'partner_id',
          'name',
          'debit',
          'credit',
          'balance',
        ],
        limit: 200,
      });

      const format = resolveFormat(opts.format);
      const rows = lines.map((l: any) => ({
        move: Array.isArray(l.move_id) ? l.move_id[1] : l.move_id,
        date: l.date,
        account: Array.isArray(l.account_id) ? l.account_id[1] : l.account_id,
        partner: Array.isArray(l.partner_id) ? l.partner_id[1] : '',
        description: l.name ?? '',
        debit: typeof l.debit === 'number' ? l.debit.toFixed(2) : '',
        credit: typeof l.credit === 'number' ? l.credit.toFixed(2) : '',
      }));

      await render(rows, format);
    } catch (err) {
      process.exit(handleError(err));
    } finally {
      client?.logout();
    }
  });

  return cmd;
}

function buildDaysToPayCommand(): Command {
  const cmd = new Command('days-to-pay')
    .description('Payment term analysis for an invoice [READ]')
    .argument('<move-id>', 'Invoice (account.move) ID')
    .addHelpText(
      'after',
      `
Returns null if the invoice is not yet paid.

Examples:
  odoo accounting days-to-pay 1042
  odoo accounting days-to-pay 1042 --format json
`
    );

  addAuthOptions(cmd);
  addOutputOptions(cmd);

  cmd.action(async (moveIdStr: string) => {
    const opts = cmd.optsWithGlobals() as AuthFlags & { format?: string };
    const moveId = parseInt(moveIdStr, 10);

    if (isNaN(moveId)) {
      process.stderr.write(`✗ Error: Invalid move-id '${moveIdStr}'\n`);
      process.exit(EXIT_CODES.USAGE_ERROR);
    }

    log('accounting days-to-pay %d', moveId);

    let client;
    try {
      client = await createAuthClient(opts);
    } catch (err) {
      process.exit(handleError(err));
    }

    try {
      const result = await client.accounting.calculateDaysToPay(moveId);
      const format = resolveFormat(opts.format);

      if (!result) {
        if (format === 'json' || format === 'ndjson') {
          await writeStdout(JSON.stringify(null) + '\n');
        } else {
          process.stdout.write('Invoice is not yet paid (no reconciliation found)\n');
        }
        return;
      }

      if (format === 'json' || format === 'ndjson') {
        await writeStdout(JSON.stringify(result, null, format === 'json' ? 2 : 0) + '\n');
      } else {
        await renderKeyValue(
          {
            invoice_id: String(moveId),
            days: String(result.days),
            invoice_date: result.invoiceDate,
            payment_date: result.paymentDate,
          },
          format
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
