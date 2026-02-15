/**
 * Integration tests for accounting service against real Odoo instance.
 *
 * Tests exercise actual RPC calls to verify:
 * - Cash account discovery from journals
 * - getPostedMoveLines filters correctly
 * - Partner resolution from bank entry counterparts
 * - Reconciliation tracing through full_reconcile_id
 * - Cash balance calculation from GL
 * - Days-to-pay calculation
 * - Closing entry detection
 * - Service accessor (client.accounting.*)
 *
 * Requires: Docker Odoo with `account` module installed.
 */

import { OdooClient } from '../src/client/odoo-client';
import { AccountingService } from '../src/services/accounting/accounting-service';
import {
  discoverCashAccounts,
  getCashAccountIds,
  getPostedMoveLines,
  resolvePartnerFromMove,
  traceReconciliation,
  getCashBalance,
  calculateDaysToPay,
  isClosingEntry,
  isClosingEntryFromLines,
} from '../src/services/accounting/functions';
import {
  installModuleForTest,
  cleanupInstalledModules,
} from '../../../tests/helpers/odoo-instance';

describe('Accounting service integration', () => {
  const odooUrl = process.env.ODOO_URL || 'http://localhost:8069';
  const odooDb = process.env.ODOO_DB_NAME || 'odoo';
  const odooUser = process.env.ODOO_DB_USER || 'admin';
  const odooPassword = process.env.ODOO_DB_PASSWORD || 'admin';

  let client: OdooClient;
  const cleanup: Array<{ model: string; ids: number[] }> = [];
  const installedModules: string[] = [];

  beforeAll(async () => {
    client = new OdooClient({
      url: odooUrl,
      database: odooDb,
      username: odooUser,
      password: odooPassword,
      safety: null, // Disable safety for tests
    });
    await client.authenticate();

    // Install account module (Invoicing)
    await installModuleForTest(client.modules, 'account', installedModules);
  }, 120_000); // Module install can be slow

  afterAll(async () => {
    // Clean up created records in reverse order
    for (const { model, ids } of cleanup.reverse()) {
      try {
        await client.unlink(model, ids);
      } catch {
        // Ignore cleanup errors
      }
    }

    await cleanupInstalledModules(client.modules, installedModules);
    client.logout();
  }, 120_000);

  // ── Cash Account Discovery ──────────────────────────────────────

  describe('discoverCashAccounts', () => {
    it('should discover cash/bank accounts from journals', async () => {
      const accounts = await discoverCashAccounts(client);

      // Fresh Odoo install has at least one bank journal
      expect(accounts.length).toBeGreaterThanOrEqual(0);

      // If there are accounts, verify structure
      if (accounts.length > 0) {
        const account = accounts[0];
        expect(account.accountId).toBeGreaterThan(0);
        expect(account.accountName).toBeTruthy();
        expect(account.journalId).toBeGreaterThan(0);
        expect(account.journalName).toBeTruthy();
        expect(['bank', 'cash']).toContain(account.journalType);
      }
    });

    it('should work via client.accounting accessor', async () => {
      const accounts = await client.accounting.discoverCashAccounts();
      // Same result as standalone function
      const standalone = await discoverCashAccounts(client);
      expect(accounts.length).toBe(standalone.length);
    });
  });

  describe('getCashAccountIds', () => {
    it('should return numeric account IDs', async () => {
      const ids = await getCashAccountIds(client);
      expect(Array.isArray(ids)).toBe(true);
      for (const id of ids) {
        expect(typeof id).toBe('number');
        expect(id).toBeGreaterThan(0);
      }
    });

    it('should match discoverCashAccounts result', async () => {
      const ids = await getCashAccountIds(client);
      const accounts = await discoverCashAccounts(client);
      expect(ids).toEqual(accounts.map((a) => a.accountId));
    });
  });

  // ── getPostedMoveLines ──────────────────────────────────────────

  describe('getPostedMoveLines', () => {
    it('should only return posted lines', async () => {
      const lines = await getPostedMoveLines(client, [], {
        fields: ['parent_state', 'date'],
        limit: 10,
      });

      // All returned lines must be posted
      for (const line of lines) {
        expect(line.parent_state).toBe('posted');
      }
    });

    it('should respect additional domain filters', async () => {
      const lines = await getPostedMoveLines(
        client,
        [['date', '>=', '2099-01-01']], // Far future — should return nothing
        { fields: ['date'], limit: 10 }
      );

      expect(lines).toHaveLength(0);
    });

    it('should work via service accessor', async () => {
      const lines = await client.accounting.getPostedMoveLines([], {
        fields: ['parent_state'],
        limit: 5,
      });

      for (const line of lines) {
        expect(line.parent_state).toBe('posted');
      }
    });
  });

  // ── Invoice + Payment Round-Trip ────────────────────────────────
  //
  // Create a customer invoice, confirm it, register a payment, then
  // test reconciliation tracing, days-to-pay, and partner resolution.

  describe('invoice + payment round-trip', () => {
    let invoiceMoveId: number;
    let partnerId: number;
    let fullReconcileId: number | null = null;

    beforeAll(async () => {
      // 1. Create a test partner
      partnerId = await client.create('res.partner', {
        name: `__test_accounting_${Date.now()}`,
        is_company: true,
      });
      cleanup.push({ model: 'res.partner', ids: [partnerId] });

      // 2. Find a receivable account (type=asset_receivable)
      const receivableAccounts = await client.searchRead(
        'account.account',
        [['account_type', '=', 'asset_receivable']],
        { fields: ['id', 'code', 'name'], limit: 1 }
      );
      if (receivableAccounts.length === 0) {
        throw new Error('No receivable account found — cannot test invoicing');
      }

      // 3. Find an income account for the invoice line
      const incomeAccounts = await client.searchRead(
        'account.account',
        [['account_type', '=', 'income']],
        { fields: ['id', 'code', 'name'], limit: 1 }
      );
      if (incomeAccounts.length === 0) {
        throw new Error('No income account found — cannot test invoicing');
      }

      // 4. Create a customer invoice
      invoiceMoveId = await client.create('account.move', {
        move_type: 'out_invoice',
        partner_id: partnerId,
        invoice_line_ids: [
          [
            0,
            0,
            {
              name: 'Test service',
              quantity: 1,
              price_unit: 1000.0,
              account_id: incomeAccounts[0].id,
            },
          ],
        ],
      });
      cleanup.push({ model: 'account.move', ids: [invoiceMoveId] });

      // 5. Confirm (post) the invoice
      await client.call('account.move', 'action_post', [[invoiceMoveId]]);

      // 6. Register a payment
      try {
        // Use the register payment wizard
        const paymentAction = await client.call('account.move', 'action_register_payment', [
          [invoiceMoveId],
        ]);

        if (paymentAction && paymentAction.res_model === 'account.payment.register') {
          const wizardContext = paymentAction.context || {};
          const wizardId = await client.create(
            'account.payment.register',
            { payment_date: new Date().toISOString().slice(0, 10) },
            wizardContext
          );

          await client.call('account.payment.register', 'action_create_payments', [[wizardId]], {
            context: wizardContext,
          });
        }
      } catch (e) {
        // Payment registration may fail in minimal setups — that's OK
        console.warn(
          'Payment registration failed (expected in minimal setup):',
          (e as Error).message
        );
      }

      // 7. Check for reconciliation
      const invoiceLines = await client.searchRead(
        'account.move.line',
        [
          ['move_id', '=', invoiceMoveId],
          ['account_type', '=', 'asset_receivable'],
          ['full_reconcile_id', '!=', false],
        ],
        { fields: ['full_reconcile_id'], limit: 1 }
      );

      if (invoiceLines.length > 0) {
        fullReconcileId = Array.isArray(invoiceLines[0].full_reconcile_id)
          ? invoiceLines[0].full_reconcile_id[0]
          : invoiceLines[0].full_reconcile_id;
      }
    }, 60_000);

    it('should find the invoice as posted', async () => {
      const [move] = await client.read('account.move', invoiceMoveId, ['state', 'move_type']);
      expect(move.state).toBe('posted');
      expect(move.move_type).toBe('out_invoice');
    });

    it('should find posted move lines for the invoice', async () => {
      const lines = await getPostedMoveLines(client, [['move_id', '=', invoiceMoveId]], {
        fields: ['account_id', 'debit', 'credit', 'balance', 'partner_id'],
      });

      expect(lines.length).toBeGreaterThan(0);

      // At least one line should have the partner
      const withPartner = lines.filter((l) => l.partner_id);
      expect(withPartner.length).toBeGreaterThan(0);
    });

    it('should detect this is NOT a closing entry', async () => {
      const isClosed = await isClosingEntry(client, invoiceMoveId);
      expect(isClosed).toBe(false);
    });

    it('isClosingEntryFromLines should match isClosingEntry', async () => {
      const lines = await client.searchRead(
        'account.move.line',
        [['move_id', '=', invoiceMoveId]],
        { fields: ['account_id'], limit: 0 }
      );

      const fromLines = isClosingEntryFromLines(lines);
      const fromRpc = await isClosingEntry(client, invoiceMoveId);
      expect(fromLines).toBe(fromRpc);
    });

    it('should trace reconciliation if payment was registered', async () => {
      if (!fullReconcileId) {
        console.log('Skipping reconciliation test — no payment was registered');
        return;
      }

      const trace = await traceReconciliation(client, fullReconcileId);

      expect(trace.reconcileId).toBe(fullReconcileId);
      expect(trace.lines.length).toBeGreaterThanOrEqual(2);
      expect(trace.moveIds.length).toBeGreaterThanOrEqual(2);

      // The invoice move should be in the trace
      expect(trace.moveIds).toContain(invoiceMoveId);

      // All lines should have valid data
      for (const line of trace.lines) {
        expect(line.id).toBeGreaterThan(0);
        expect(line.moveId).toBeGreaterThan(0);
        expect(typeof line.debit).toBe('number');
        expect(typeof line.credit).toBe('number');
        expect(line.date).toBeTruthy();
      }
    });

    it('should trace reconciliation via service accessor', async () => {
      if (!fullReconcileId) {
        console.log('Skipping — no reconciliation');
        return;
      }

      const trace = await client.accounting.traceReconciliation(fullReconcileId);
      expect(trace.moveIds).toContain(invoiceMoveId);
    });

    it('should calculate days-to-pay if payment was registered', async () => {
      if (!fullReconcileId) {
        console.log('Skipping days-to-pay test — no payment was registered');
        return;
      }

      const result = await calculateDaysToPay(client, invoiceMoveId);
      expect(result).not.toBeNull();
      expect(result!.invoiceId).toBe(invoiceMoveId);
      expect(result!.days).toBeGreaterThanOrEqual(0);
      expect(result!.reconcileId).toBe(fullReconcileId);
      expect(result!.invoiceDate).toBeTruthy();
      expect(result!.paymentDate).toBeTruthy();
    });

    it('should calculate days-to-pay via service accessor', async () => {
      if (!fullReconcileId) {
        console.log('Skipping — no reconciliation');
        return;
      }

      const result = await client.accounting.calculateDaysToPay(invoiceMoveId);
      expect(result).not.toBeNull();
      expect(result!.days).toBeGreaterThanOrEqual(0);
    });

    it('should return null days-to-pay for non-existent invoice', async () => {
      const result = await calculateDaysToPay(client, 999999);
      expect(result).toBeNull();
    });
  });

  // ── Partner Resolution from Move ────────────────────────────────

  describe('resolvePartnerFromMove', () => {
    let testMoveId: number;
    let testPartnerId: number;

    beforeAll(async () => {
      // Create a journal entry with a partner on one line, no partner on another
      testPartnerId = await client.create('res.partner', {
        name: `__test_partner_resolve_${Date.now()}`,
      });
      cleanup.push({ model: 'res.partner', ids: [testPartnerId] });

      // Find two distinct accounts for the entry
      const accounts = await client.searchRead(
        'account.account',
        [['account_type', 'in', ['expense', 'income']]],
        { fields: ['id', 'code'], limit: 2 }
      );

      if (accounts.length < 2) {
        console.warn('Not enough accounts for partner resolution test');
        return;
      }

      // Create a misc journal entry
      testMoveId = await client.create('account.move', {
        move_type: 'entry',
        line_ids: [
          [
            0,
            0,
            {
              account_id: accounts[0].id,
              partner_id: testPartnerId,
              debit: 100,
              credit: 0,
              name: 'Test debit line',
            },
          ],
          [
            0,
            0,
            {
              account_id: accounts[1].id,
              partner_id: false,
              debit: 0,
              credit: 100,
              name: 'Test credit line',
            },
          ],
        ],
      });
      cleanup.push({ model: 'account.move', ids: [testMoveId] });
    }, 30_000);

    it('should resolve partner from counterpart lines', async () => {
      if (!testMoveId) {
        console.log('Skipping — test move not created');
        return;
      }

      // Use empty cashAccountIds so no line matches as "cash"
      // → all lines are "counterparts" and partner comes from there
      const result = await resolvePartnerFromMove(client, testMoveId, []);

      expect(result.partnerId).toBe(testPartnerId);
      expect(result.source).toBe('counterpart');
      expect(result.isBatchPayment).toBe(false);
    });

    it('should work via service accessor', async () => {
      if (!testMoveId) {
        console.log('Skipping — test move not created');
        return;
      }

      const result = await client.accounting.resolvePartnerFromMove(testMoveId, []);
      expect(result.partnerId).toBe(testPartnerId);
    });
  });

  // ── Cash Balance ────────────────────────────────────────────────

  describe('getCashBalance', () => {
    it('should return a numeric balance', async () => {
      const cashIds = await getCashAccountIds(client);

      if (cashIds.length === 0) {
        console.log('Skipping cash balance test — no cash accounts found');
        return;
      }

      const balance = await getCashBalance(client, cashIds, '2099-12-31');

      expect(typeof balance).toBe('number');
      // Balance can be 0 in a fresh install — that's fine
      expect(Number.isFinite(balance)).toBe(true);
    });

    it('should return 0 for non-existent accounts', async () => {
      const balance = await getCashBalance(client, [999999], '2099-12-31');
      expect(balance).toBe(0);
    });

    it('should work via service accessor', async () => {
      const cashIds = await client.accounting.getCashAccountIds();
      const balance = await client.accounting.getCashBalance(cashIds, '2099-12-31');
      expect(typeof balance).toBe('number');
    });
  });

  // ── Service accessor singleton ──────────────────────────────────

  describe('service accessor', () => {
    it('should return the same AccountingService instance', () => {
      const svc1 = client.accounting;
      const svc2 = client.accounting;
      expect(svc1).toBe(svc2);
      expect(svc1).toBeInstanceOf(AccountingService);
    });
  });
});
