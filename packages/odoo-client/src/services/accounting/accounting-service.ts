/**
 * Accounting service — the typed interface exposed via `client.accounting.*`
 *
 * Provides helpers for common accounting operations that require
 * domain knowledge of Odoo's data model:
 * - Cash account discovery from journals
 * - Partner resolution from bank statement counterparts
 * - Reconciliation tracing through transient accounts
 * - Year-end closing entry detection
 * - Days-to-pay calculation
 * - Cash balance from general ledger
 *
 * Access via `client.accounting` — never instantiate directly.
 */

import type { OdooClient } from '../../client/odoo-client';
import type { CashAccount, DaysToPayResult, ReconciliationTrace, ResolvedPartner } from './types';
import {
  discoverCashAccounts as _discoverCashAccounts,
  getCashAccountIds as _getCashAccountIds,
  traceReconciliation as _traceReconciliation,
  resolvePartnerFromMove as _resolvePartnerFromMove,
  isClosingEntry as _isClosingEntry,
  isClosingEntryFromLines as _isClosingEntryFromLines,
  calculateDaysToPay as _calculateDaysToPay,
  getCashBalance as _getCashBalance,
  getPostedMoveLines as _getPostedMoveLines,
} from './functions';

export class AccountingService {
  /** @internal */
  constructor(private client: OdooClient) {}

  /**
   * Discover cash and bank accounts from Odoo journal configuration.
   *
   * Uses journal `type IN ('bank', 'cash')` — more robust than matching
   * by account code prefix.
   *
   * ```typescript
   * const accounts = await client.accounting.discoverCashAccounts();
   * console.log(accounts.map(a => `${a.accountName} (${a.journalName})`));
   * ```
   */
  async discoverCashAccounts(): Promise<CashAccount[]> {
    return _discoverCashAccounts(this.client);
  }

  /**
   * Get just the account IDs for cash/bank accounts.
   *
   * ```typescript
   * const cashIds = await client.accounting.getCashAccountIds();
   * // Use in domains: ['account_id', 'in', cashIds]
   * ```
   */
  async getCashAccountIds(): Promise<number[]> {
    return _getCashAccountIds(this.client);
  }

  /**
   * Trace all journal entry lines sharing a reconciliation group.
   *
   * Follows `full_reconcile_id` to find all lines in a settlement,
   * useful for tracing payments through transient accounts.
   *
   * ```typescript
   * const trace = await client.accounting.traceReconciliation(42);
   * console.log(`${trace.lines.length} lines across ${trace.moveIds.length} moves`);
   * ```
   */
  async traceReconciliation(fullReconcileId: number): Promise<ReconciliationTrace> {
    return _traceReconciliation(this.client, fullReconcileId);
  }

  /**
   * Resolve the partner for a bank/cash journal entry.
   *
   * Handles the common case where bank lines have no partner — the real
   * partner is on the counterpart lines (410, 411, 430, etc.).
   *
   * ```typescript
   * const cashIds = await client.accounting.getCashAccountIds();
   * const partner = await client.accounting.resolvePartnerFromMove(moveId, cashIds);
   * if (partner.isBatchPayment) {
   *   console.log('Batch payment to:', partner.allPartnerIds);
   * }
   * ```
   */
  async resolvePartnerFromMove(moveId: number, cashAccountIds: number[]): Promise<ResolvedPartner> {
    return _resolvePartnerFromMove(this.client, moveId, cashAccountIds);
  }

  /**
   * Check if a journal entry is a year-end closing entry (uses 129x account).
   *
   * ```typescript
   * if (await client.accounting.isClosingEntry(moveId)) {
   *   console.log('Skipping closing entry');
   * }
   * ```
   */
  async isClosingEntry(moveId: number): Promise<boolean> {
    return _isClosingEntry(this.client, moveId);
  }

  /**
   * Check already-loaded lines for closing entry (no RPC call).
   *
   * ```typescript
   * if (client.accounting.isClosingEntryFromLines(lines)) {
   *   continue; // skip this move
   * }
   * ```
   */
  isClosingEntryFromLines(lines: Array<{ account_id: any }>): boolean {
    return _isClosingEntryFromLines(lines);
  }

  /**
   * Calculate days between invoice date and payment date.
   *
   * Uses `full_reconcile_id` on receivable/payable lines to find the payment.
   * Returns null if the invoice is not yet reconciled (unpaid).
   *
   * ```typescript
   * const result = await client.accounting.calculateDaysToPay(invoiceId);
   * if (result) {
   *   console.log(`Paid in ${result.days} days`);
   * }
   * ```
   */
  async calculateDaysToPay(invoiceId: number): Promise<DaysToPayResult | null> {
    return _calculateDaysToPay(this.client, invoiceId);
  }

  /**
   * Calculate cash balance at a given date from the general ledger.
   *
   * Sums all posted balances on cash/bank accounts through the given date,
   * including opening balances. More accurate than summing period movements.
   *
   * ```typescript
   * const cashIds = await client.accounting.getCashAccountIds();
   * const balance = await client.accounting.getCashBalance(cashIds, '2025-06-30');
   * console.log(`Cash balance: €${balance.toFixed(2)}`);
   * ```
   */
  async getCashBalance(
    cashAccountIds: number[],
    asOfDate: string,
    options?: { companyIds?: number[] }
  ): Promise<number> {
    return _getCashBalance(this.client, cashAccountIds, asOfDate, options);
  }

  /**
   * Query posted journal entry lines with `parent_state='posted'` auto-applied.
   *
   * Prevents the most common accounting query mistake: forgetting to filter
   * out draft/cancelled entries. Also defaults limit to 0 (all records).
   *
   * ```typescript
   * const pnlLines = await client.accounting.getPostedMoveLines(
   *   [['account_id.code', '=like', '7%'], ['date', '>=', '2025-01-01']],
   *   { fields: ['account_id', 'debit', 'credit', 'balance', 'partner_id'] }
   * );
   * ```
   */
  async getPostedMoveLines<T extends Record<string, any> = Record<string, any>>(
    domain?: any[],
    options?: {
      fields?: string[];
      offset?: number;
      limit?: number;
      order?: string;
    }
  ): Promise<T[]> {
    return _getPostedMoveLines<T>(this.client, domain, options);
  }
}
