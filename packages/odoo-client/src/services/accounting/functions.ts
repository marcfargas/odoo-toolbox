/**
 * Accounting standalone functions for Odoo.
 *
 * These functions encapsulate hard-won patterns from real-world
 * financial analysis projects. They handle Odoo-specific quirks like:
 * - Cash accounts defined by journals, not account codes
 * - Partners on counterpart lines, not bank lines
 * - Reconciliation tracing through transient accounts
 * - Year-end closing entry detection
 *
 * @see https://github.com/odoo/odoo/blob/17.0/addons/account/
 */

import debug from 'debug';
import type { OdooClient } from '../../client/odoo-client';
import type {
  CashAccount,
  DaysToPayResult,
  ReconciliationLine,
  ReconciliationTrace,
  ResolvedPartner,
} from './types';

const log = debug('odoo-client:accounting');

// ── Helpers ───────────────────────────────────────────────────────────

/** Extract ID from an Odoo many2one value (either [id, name] or just id). */
function m2oId(value: any): number {
  return Array.isArray(value) ? value[0] : value;
}

/** Extract display name from an Odoo many2one value. */
function m2oName(value: any): string {
  return Array.isArray(value) ? value[1] : String(value ?? '');
}

// ── Cash Account Discovery ───────────────────────────────────────────

/**
 * Discover cash and bank accounts from Odoo journal configuration.
 *
 * Uses `account.journal` with `type IN ('bank', 'cash')` to find the
 * actual cash/bank accounts — more robust than matching by account code
 * prefix (e.g. 57x), which may miss unusual accounts or match loan accounts.
 *
 * @param client - Authenticated OdooClient
 * @returns Array of cash/bank accounts with their journal info
 *
 * @see https://github.com/odoo/odoo/blob/17.0/addons/account/models/account_journal.py
 */
export async function discoverCashAccounts(client: OdooClient): Promise<CashAccount[]> {
  log('discovering cash/bank accounts from journals');

  const journals = await client.searchRead('account.journal', [['type', 'in', ['bank', 'cash']]], {
    fields: ['name', 'default_account_id', 'type'],
    limit: 0,
  });

  const accounts: CashAccount[] = [];

  for (const j of journals) {
    if (!j.default_account_id) {
      log('journal %s (id=%d) has no default_account_id, skipping', j.name, j.id);
      continue;
    }

    accounts.push({
      accountId: m2oId(j.default_account_id),
      accountName: m2oName(j.default_account_id),
      journalId: j.id,
      journalName: j.name,
      journalType: j.type as 'bank' | 'cash',
    });
  }

  log('found %d cash/bank accounts', accounts.length);
  return accounts;
}

/**
 * Get just the account IDs for cash/bank accounts.
 * Convenience wrapper around discoverCashAccounts().
 */
export async function getCashAccountIds(client: OdooClient): Promise<number[]> {
  const accounts = await discoverCashAccounts(client);
  return accounts.map((a) => a.accountId);
}

// ── Reconciliation Tracing ──────────────────────────────────────────

/**
 * Trace all journal entry lines sharing a reconciliation group.
 *
 * When Odoo reconciles invoice receivable/payable lines with payment lines,
 * they share a `full_reconcile_id`. This function retrieves all lines in
 * the group, useful for:
 * - Following payments through transient accounts (410 → 41101 → bank)
 * - Understanding batch payment breakdowns
 * - Tracing the real economic origin of a bank movement
 *
 * @param client - Authenticated OdooClient
 * @param fullReconcileId - The full_reconcile_id to trace
 * @returns All lines and move IDs in the reconciliation group
 */
export async function traceReconciliation(
  client: OdooClient,
  fullReconcileId: number
): Promise<ReconciliationTrace> {
  log('tracing reconciliation id=%d', fullReconcileId);

  const rawLines = await client.searchRead(
    'account.move.line',
    [['full_reconcile_id', '=', fullReconcileId]],
    {
      fields: ['move_id', 'account_id', 'partner_id', 'debit', 'credit', 'balance', 'date'],
      limit: 0,
    }
  );

  const lines: ReconciliationLine[] = rawLines.map((l) => ({
    id: l.id,
    moveId: m2oId(l.move_id),
    moveName: m2oName(l.move_id),
    accountId: m2oId(l.account_id),
    accountName: m2oName(l.account_id),
    partnerId: l.partner_id ? m2oId(l.partner_id) : false,
    partnerName: l.partner_id ? m2oName(l.partner_id) : false,
    debit: l.debit,
    credit: l.credit,
    balance: l.balance ?? l.debit - l.credit,
    date: l.date,
  }));

  const moveIds = [...new Set(lines.map((l) => l.moveId))];

  log(
    'reconciliation id=%d spans %d lines across %d moves',
    fullReconcileId,
    lines.length,
    moveIds.length
  );
  return { reconcileId: fullReconcileId, lines, moveIds };
}

// ── Partner Resolution ──────────────────────────────────────────────

/**
 * Resolve the partner for a bank/cash journal entry.
 *
 * Bank statement entries (move_type='entry') typically have partner_id=false
 * on both the move header AND the cash line. The real partner is on the
 * counterpart lines (payable/receivable accounts like 410, 411, 430).
 *
 * For batch payments (one bank line, multiple supplier payable lines),
 * returns the largest counterpart's partner and flags isBatchPayment=true.
 *
 * @param client - Authenticated OdooClient
 * @param moveId - The account.move ID (bank statement entry)
 * @param cashAccountIds - Account IDs for cash/bank accounts (from getCashAccountIds)
 * @returns Resolved partner info with source indication
 */
export async function resolvePartnerFromMove(
  client: OdooClient,
  moveId: number,
  cashAccountIds: number[]
): Promise<ResolvedPartner> {
  log('resolving partner for move id=%d', moveId);

  const lines = await client.searchRead('account.move.line', [['move_id', '=', moveId]], {
    fields: ['account_id', 'partner_id', 'debit', 'credit'],
    limit: 0,
  });

  const cashAccountSet = new Set(cashAccountIds);

  // Separate cash lines from counterparts
  const cashLines = lines.filter((l) => cashAccountSet.has(m2oId(l.account_id)));
  const counterparts = lines.filter((l) => !cashAccountSet.has(m2oId(l.account_id)));

  // Try cash line first
  const cashLineWithPartner = cashLines.find((l) => l.partner_id);
  if (cashLineWithPartner) {
    return {
      partnerId: m2oId(cashLineWithPartner.partner_id),
      partnerName: m2oName(cashLineWithPartner.partner_id),
      source: 'cash_line',
      isBatchPayment: false,
      allPartnerIds: [m2oId(cashLineWithPartner.partner_id)],
    };
  }

  // Fall back to counterpart lines
  const counterpartsWithPartner = counterparts
    .filter((l) => l.partner_id)
    .sort((a, b) => Math.abs(b.debit - b.credit) - Math.abs(a.debit - a.credit));

  if (!counterpartsWithPartner.length) {
    log('no partner found on move id=%d', moveId);
    return {
      partnerId: false,
      partnerName: false,
      source: 'none',
      isBatchPayment: false,
      allPartnerIds: [],
    };
  }

  // Collect unique partner IDs
  const allPartnerIds = [...new Set(counterpartsWithPartner.map((l) => m2oId(l.partner_id)))];
  const isBatch = allPartnerIds.length > 1;

  if (isBatch) {
    log('batch payment detected on move id=%d: %d partners', moveId, allPartnerIds.length);
  }

  return {
    partnerId: m2oId(counterpartsWithPartner[0].partner_id),
    partnerName: m2oName(counterpartsWithPartner[0].partner_id),
    source: 'counterpart',
    isBatchPayment: isBatch,
    allPartnerIds,
  };
}

// ── Closing Entry Detection ─────────────────────────────────────────

/**
 * Check if a journal entry is a year-end closing entry.
 *
 * Year-end closing entries debit/credit account 129x (resultado del ejercicio)
 * to close PnL accounts to the balance sheet. These should be excluded from
 * operational PnL analysis.
 *
 * @param client - Authenticated OdooClient
 * @param moveId - The account.move ID to check
 * @returns true if any line uses a 129x account (closing entry)
 */
export async function isClosingEntry(client: OdooClient, moveId: number): Promise<boolean> {
  const lines = await client.searchRead('account.move.line', [['move_id', '=', moveId]], {
    fields: ['account_id'],
    limit: 0,
  });

  return lines.some((l) => {
    const name = m2oName(l.account_id);
    return /^129/.test(name);
  });
}

/**
 * Check if journal entry lines (already loaded) include a closing entry.
 * Faster than isClosingEntry() when you already have the lines.
 *
 * @param lines - Array of move lines with account_id field
 * @returns true if any line uses a 129x account
 */
export function isClosingEntryFromLines(lines: Array<{ account_id?: any }>): boolean {
  return lines.some((l) => {
    if (!l.account_id) return false;
    const name = m2oName(l.account_id);
    return /^129/.test(name);
  });
}

// ── Days-to-Pay ─────────────────────────────────────────────────────

/**
 * Calculate days between invoice date and payment date for an invoice.
 *
 * Uses `full_reconcile_id` on receivable/payable lines to find the payment.
 * The payment date is the latest date among all lines sharing the same
 * reconciliation group.
 *
 * @param client - Authenticated OdooClient
 * @param invoiceId - The account.move ID of the invoice
 * @returns Days-to-pay result, or null if the invoice is not yet reconciled
 */
export async function calculateDaysToPay(
  client: OdooClient,
  invoiceId: number
): Promise<DaysToPayResult | null> {
  log('calculating days-to-pay for invoice id=%d', invoiceId);

  // Get reconciled receivable/payable lines from the invoice
  const invoiceLines = await client.searchRead(
    'account.move.line',
    [
      ['move_id', '=', invoiceId],
      ['full_reconcile_id', '!=', false],
      ['account_id.account_type', 'in', ['asset_receivable', 'liability_payable']],
    ],
    { fields: ['full_reconcile_id', 'date'], limit: 0 }
  );

  if (!invoiceLines.length) {
    log('invoice id=%d has no reconciled receivable/payable lines', invoiceId);
    return null;
  }

  const reconcileId = m2oId(invoiceLines[0].full_reconcile_id);
  const invoiceDate = invoiceLines[0].date;

  // Find all lines in the reconciliation — latest date is the payment
  const allLines = await client.searchRead(
    'account.move.line',
    [['full_reconcile_id', '=', reconcileId]],
    { fields: ['date'], limit: 0 }
  );

  const paymentDate = allLines.reduce((max, l) => (l.date > max ? l.date : max), allLines[0].date);

  const msPerDay = 86_400_000;
  const days = Math.round(
    (new Date(paymentDate).getTime() - new Date(invoiceDate).getTime()) / msPerDay
  );

  log(
    'invoice id=%d: %d days to pay (invoice=%s, payment=%s)',
    invoiceId,
    days,
    invoiceDate,
    paymentDate
  );

  return {
    invoiceId,
    invoiceDate,
    paymentDate,
    days,
    reconcileId,
  };
}

// ── Cash Balance ────────────────────────────────────────────────────

/**
 * Calculate cash balance at a given date from the general ledger.
 *
 * Sums all posted move line balances on cash/bank accounts up to and
 * including the given date. This includes opening balances — unlike
 * summing movements in a period, which would miss prior history.
 *
 * @param client - Authenticated OdooClient
 * @param cashAccountIds - Account IDs for cash/bank accounts (from getCashAccountIds)
 * @param asOfDate - Date string (YYYY-MM-DD) to calculate balance as of
 * @param options - Optional: company_ids for multi-company, context
 * @returns Total cash balance as a number
 */
export async function getCashBalance(
  client: OdooClient,
  cashAccountIds: number[],
  asOfDate: string,
  options?: { companyIds?: number[] }
): Promise<number> {
  log('calculating cash balance as of %s across %d accounts', asOfDate, cashAccountIds.length);

  const domain: any[] = [
    ['account_id', 'in', cashAccountIds],
    ['parent_state', '=', 'posted'],
    ['date', '<=', asOfDate],
  ];

  const context: Record<string, any> = {};
  if (options?.companyIds?.length) {
    context.allowed_company_ids = options.companyIds;
  }

  const lines = await client.searchRead('account.move.line', domain, {
    fields: ['balance'],
    limit: 0,
    ...(Object.keys(context).length ? { context } : {}),
  });

  const total = lines.reduce((sum, l) => sum + (l.balance ?? 0), 0);
  log('cash balance as of %s: %d', asOfDate, total);
  return total;
}

// ── Posted Move Lines ───────────────────────────────────────────────

/**
 * Query account.move.line with `parent_state='posted'` automatically applied.
 *
 * Convenience wrapper that prevents the most common accounting query mistake:
 * forgetting to filter out draft/cancelled entries.
 *
 * @param client - Authenticated OdooClient
 * @param domain - Additional domain filters (parent_state is added automatically)
 * @param options - Standard searchRead options (fields, limit, order, etc.)
 * @returns Array of posted journal entry lines
 */
export async function getPostedMoveLines<T extends Record<string, any> = Record<string, any>>(
  client: OdooClient,
  domain: any[] = [],
  options: {
    fields?: string[];
    offset?: number;
    limit?: number;
    order?: string;
  } = {}
): Promise<T[]> {
  const fullDomain = [['parent_state', '=', 'posted'], ...domain];
  const searchOptions = { ...options };

  // Ensure limit is explicit (Odoo defaults to 100)
  if (searchOptions.limit === undefined) {
    searchOptions.limit = 0;
  }

  return client.searchRead<T>('account.move.line', fullDomain, searchOptions);
}
