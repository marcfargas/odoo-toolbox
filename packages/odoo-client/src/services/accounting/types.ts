/**
 * Types for accounting service.
 */

/**
 * A discovered cash/bank account from Odoo journals.
 */
export interface CashAccount {
  /** Account ID (account.account) */
  accountId: number;
  /** Account display name (e.g., "57200 Banco Santander") */
  accountName: string;
  /** Journal ID (account.journal) */
  journalId: number;
  /** Journal name (e.g., "Banco Santander") */
  journalName: string;
  /** Journal type: 'bank' or 'cash' */
  journalType: 'bank' | 'cash';
}

/**
 * Result of tracing a reconciliation group.
 */
export interface ReconciliationTrace {
  /** The full_reconcile_id being traced */
  reconcileId: number;
  /** All move lines sharing this reconciliation */
  lines: ReconciliationLine[];
  /** Distinct move IDs involved */
  moveIds: number[];
}

export interface ReconciliationLine {
  id: number;
  moveId: number;
  moveName: string;
  accountId: number;
  accountName: string;
  partnerId: number | false;
  partnerName: string | false;
  debit: number;
  credit: number;
  balance: number;
  date: string;
}

/**
 * Result of resolving a partner from a bank move's counterpart lines.
 */
export interface ResolvedPartner {
  /** Partner ID (res.partner) or false if no partner found */
  partnerId: number | false;
  /** Partner display name or false */
  partnerName: string | false;
  /** Source of the resolution */
  source: 'cash_line' | 'counterpart' | 'none';
  /** Whether this is a batch payment (multiple partners on counterparts) */
  isBatchPayment: boolean;
  /** All partner IDs found on counterpart lines (for batch payments) */
  allPartnerIds: number[];
}

/**
 * Days-to-pay result for an invoice.
 */
export interface DaysToPayResult {
  /** Invoice ID */
  invoiceId: number;
  /** Invoice date */
  invoiceDate: string;
  /** Payment date (latest date in reconciliation group) */
  paymentDate: string;
  /** Number of days between invoice and payment */
  days: number;
  /** The full_reconcile_id used */
  reconcileId: number;
}
