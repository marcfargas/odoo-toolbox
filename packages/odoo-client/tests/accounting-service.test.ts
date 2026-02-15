/**
 * Unit tests for accounting service — pure logic, no Odoo needed.
 *
 * Tests cover:
 * - m2o helpers (via isClosingEntryFromLines)
 * - Cash account extraction from journal data
 * - Partner resolution logic (cash line, counterpart, batch)
 * - Closing entry detection from pre-loaded lines
 */

import { isClosingEntryFromLines } from '../src/services/accounting/functions';

// ── isClosingEntryFromLines ──────────────────────────────────────────

describe('isClosingEntryFromLines', () => {
  it('should detect closing entries with 129x account code', () => {
    const lines = [
      { account_id: [100, '1290 Resultado del ejercicio'] },
      { account_id: [200, '7000 Ventas'] },
    ];
    expect(isClosingEntryFromLines(lines)).toBe(true);
  });

  it('should detect 1291, 1292 etc. as closing', () => {
    const lines = [
      { account_id: [100, '1291 Pérdidas y ganancias'] },
      { account_id: [200, '6400 Sueldos y salarios'] },
    ];
    expect(isClosingEntryFromLines(lines)).toBe(true);
  });

  it('should NOT flag regular entries as closing', () => {
    const lines = [
      { account_id: [100, '6400 Sueldos y salarios'] },
      { account_id: [200, '4100 Proveedores'] },
      { account_id: [300, '5720 Banco'] },
    ];
    expect(isClosingEntryFromLines(lines)).toBe(false);
  });

  it('should handle empty lines array', () => {
    expect(isClosingEntryFromLines([])).toBe(false);
  });

  it('should handle accounts starting with 12 but not 129', () => {
    const lines = [{ account_id: [100, '1200 Capital'] }, { account_id: [200, '1210 Reservas'] }];
    expect(isClosingEntryFromLines(lines)).toBe(false);
  });

  it('should handle accounts where 129 appears mid-string', () => {
    // Account name has 129 in it but doesn't START with 129
    const lines = [{ account_id: [100, '41290 Some account'] }];
    expect(isClosingEntryFromLines(lines)).toBe(false);
  });
});

// ── discoverCashAccounts (with mock client) ─────────────────────────

describe('discoverCashAccounts', () => {
  let discoverCashAccounts: any;

  beforeAll(async () => {
    const mod = await import('../src/services/accounting/functions');
    discoverCashAccounts = mod.discoverCashAccounts;
  });

  it('should extract account IDs from journal default_account_id', async () => {
    const mockClient = {
      searchRead: async () => [
        {
          id: 1,
          name: 'Banco Santander',
          default_account_id: [57, '5720 Banco Santander'],
          type: 'bank',
        },
        { id: 2, name: 'Caja', default_account_id: [58, '5700 Caja'], type: 'cash' },
      ],
    } as any;

    const accounts = await discoverCashAccounts(mockClient);

    expect(accounts).toHaveLength(2);
    expect(accounts[0]).toEqual({
      accountId: 57,
      accountName: '5720 Banco Santander',
      journalId: 1,
      journalName: 'Banco Santander',
      journalType: 'bank',
    });
    expect(accounts[1]).toEqual({
      accountId: 58,
      accountName: '5700 Caja',
      journalId: 2,
      journalName: 'Caja',
      journalType: 'cash',
    });
  });

  it('should skip journals without default_account_id', async () => {
    const mockClient = {
      searchRead: async () => [
        { id: 1, name: 'Banco', default_account_id: [57, '5720 Banco'], type: 'bank' },
        { id: 2, name: 'Broken Journal', default_account_id: false, type: 'bank' },
      ],
    } as any;

    const accounts = await discoverCashAccounts(mockClient);
    expect(accounts).toHaveLength(1);
    expect(accounts[0].journalName).toBe('Banco');
  });

  it('should return empty array when no bank/cash journals exist', async () => {
    const mockClient = {
      searchRead: async () => [],
    } as any;

    const accounts = await discoverCashAccounts(mockClient);
    expect(accounts).toEqual([]);
  });
});

// ── getCashAccountIds ───────────────────────────────────────────────

describe('getCashAccountIds', () => {
  let getCashAccountIds: any;

  beforeAll(async () => {
    const mod = await import('../src/services/accounting/functions');
    getCashAccountIds = mod.getCashAccountIds;
  });

  it('should return just the account IDs', async () => {
    const mockClient = {
      searchRead: async () => [
        { id: 1, name: 'Banco', default_account_id: [57, '5720 Banco'], type: 'bank' },
        { id: 2, name: 'Caja', default_account_id: [58, '5700 Caja'], type: 'cash' },
      ],
    } as any;

    const ids = await getCashAccountIds(mockClient);
    expect(ids).toEqual([57, 58]);
  });
});

// ── resolvePartnerFromMove ──────────────────────────────────────────

describe('resolvePartnerFromMove', () => {
  let resolvePartnerFromMove: any;

  beforeAll(async () => {
    const mod = await import('../src/services/accounting/functions');
    resolvePartnerFromMove = mod.resolvePartnerFromMove;
  });

  it('should resolve partner from cash line when present', async () => {
    const mockClient = {
      searchRead: async () => [
        {
          id: 1,
          account_id: [57, '5720 Banco'],
          partner_id: [10, 'Partner A'],
          debit: 0,
          credit: 1000,
        },
        {
          id: 2,
          account_id: [41, '4100 Proveedores'],
          partner_id: [10, 'Partner A'],
          debit: 1000,
          credit: 0,
        },
      ],
    } as any;

    const result = await resolvePartnerFromMove(mockClient, 1, [57]);
    expect(result.partnerId).toBe(10);
    expect(result.partnerName).toBe('Partner A');
    expect(result.source).toBe('cash_line');
    expect(result.isBatchPayment).toBe(false);
  });

  it('should fall back to counterpart when cash line has no partner', async () => {
    const mockClient = {
      searchRead: async () => [
        { id: 1, account_id: [57, '5720 Banco'], partner_id: false, debit: 0, credit: 1000 },
        {
          id: 2,
          account_id: [41, '4100 Proveedores'],
          partner_id: [10, 'Partner A'],
          debit: 1000,
          credit: 0,
        },
      ],
    } as any;

    const result = await resolvePartnerFromMove(mockClient, 1, [57]);
    expect(result.partnerId).toBe(10);
    expect(result.partnerName).toBe('Partner A');
    expect(result.source).toBe('counterpart');
    expect(result.isBatchPayment).toBe(false);
  });

  it('should detect batch payments (multiple partners on counterparts)', async () => {
    const mockClient = {
      searchRead: async () => [
        { id: 1, account_id: [57, '5720 Banco'], partner_id: false, debit: 0, credit: 3000 },
        {
          id: 2,
          account_id: [41, '4100 Proveedores'],
          partner_id: [10, 'Partner A'],
          debit: 2000,
          credit: 0,
        },
        {
          id: 3,
          account_id: [41, '4100 Proveedores'],
          partner_id: [20, 'Partner B'],
          debit: 1000,
          credit: 0,
        },
      ],
    } as any;

    const result = await resolvePartnerFromMove(mockClient, 1, [57]);
    expect(result.isBatchPayment).toBe(true);
    expect(result.allPartnerIds).toContain(10);
    expect(result.allPartnerIds).toContain(20);
    expect(result.allPartnerIds).toHaveLength(2);
    // Main partner is the one with the largest amount
    expect(result.partnerId).toBe(10);
    expect(result.source).toBe('counterpart');
  });

  it('should return none when no partner found anywhere', async () => {
    const mockClient = {
      searchRead: async () => [
        { id: 1, account_id: [57, '5720 Banco'], partner_id: false, debit: 0, credit: 1000 },
        { id: 2, account_id: [41, '4100 Proveedores'], partner_id: false, debit: 1000, credit: 0 },
      ],
    } as any;

    const result = await resolvePartnerFromMove(mockClient, 1, [57]);
    expect(result.partnerId).toBe(false);
    expect(result.partnerName).toBe(false);
    expect(result.source).toBe('none');
    expect(result.isBatchPayment).toBe(false);
    expect(result.allPartnerIds).toEqual([]);
  });

  it('should deduplicate partner IDs in batch payments', async () => {
    const mockClient = {
      searchRead: async () => [
        { id: 1, account_id: [57, '5720 Banco'], partner_id: false, debit: 0, credit: 3000 },
        { id: 2, account_id: [41, '4100'], partner_id: [10, 'Partner A'], debit: 1000, credit: 0 },
        { id: 3, account_id: [42, '4110'], partner_id: [10, 'Partner A'], debit: 1000, credit: 0 },
        { id: 4, account_id: [43, '4750'], partner_id: [10, 'Partner A'], debit: 1000, credit: 0 },
      ],
    } as any;

    const result = await resolvePartnerFromMove(mockClient, 1, [57]);
    expect(result.isBatchPayment).toBe(false); // Same partner on all lines
    expect(result.allPartnerIds).toEqual([10]);
  });
});

// ── traceReconciliation (with mock) ─────────────────────────────────

describe('traceReconciliation', () => {
  let traceReconciliation: any;

  beforeAll(async () => {
    const mod = await import('../src/services/accounting/functions');
    traceReconciliation = mod.traceReconciliation;
  });

  it('should group lines by reconciliation and extract unique move IDs', async () => {
    const mockClient = {
      searchRead: async () => [
        {
          id: 1,
          move_id: [100, 'INV/2025/001'],
          account_id: [41, '4300 Clientes'],
          partner_id: [10, 'Customer'],
          debit: 0,
          credit: 1000,
          balance: -1000,
          date: '2025-01-15',
        },
        {
          id: 2,
          move_id: [200, 'BNK/2025/050'],
          account_id: [41, '4300 Clientes'],
          partner_id: [10, 'Customer'],
          debit: 1000,
          credit: 0,
          balance: 1000,
          date: '2025-02-01',
        },
      ],
    } as any;

    const result = await traceReconciliation(mockClient, 42);
    expect(result.reconcileId).toBe(42);
    expect(result.lines).toHaveLength(2);
    expect(result.moveIds).toEqual([100, 200]);
    expect(result.lines[0].moveName).toBe('INV/2025/001');
    expect(result.lines[1].moveName).toBe('BNK/2025/050');
    expect(result.lines[0].partnerId).toBe(10);
  });

  it('should handle lines without partner', async () => {
    const mockClient = {
      searchRead: async () => [
        {
          id: 1,
          move_id: [100, 'MISC/001'],
          account_id: [55, '5550 Transit'],
          partner_id: false,
          debit: 500,
          credit: 0,
          balance: 500,
          date: '2025-03-01',
        },
      ],
    } as any;

    const result = await traceReconciliation(mockClient, 99);
    expect(result.lines[0].partnerId).toBe(false);
    expect(result.lines[0].partnerName).toBe(false);
  });
});

// ── calculateDaysToPay (with mock) ──────────────────────────────────

describe('calculateDaysToPay', () => {
  let calculateDaysToPay: any;

  beforeAll(async () => {
    const mod = await import('../src/services/accounting/functions');
    calculateDaysToPay = mod.calculateDaysToPay;
  });

  it('should calculate days between invoice and payment', async () => {
    const mockClient = {
      searchRead: async (_model: string, domain: any[]) => {
        // First call: get reconciled invoice lines
        if (domain.some((d: any) => Array.isArray(d) && d[0] === 'move_id')) {
          return [
            {
              id: 1,
              full_reconcile_id: [42, 'P0042'],
              date: '2025-01-15',
            },
          ];
        }
        // Second call: get all lines in reconciliation group
        return [
          { id: 1, date: '2025-01-15' },
          { id: 2, date: '2025-02-01' },
        ];
      },
    } as any;

    const result = await calculateDaysToPay(mockClient, 100);
    expect(result).not.toBeNull();
    expect(result!.invoiceDate).toBe('2025-01-15');
    expect(result!.paymentDate).toBe('2025-02-01');
    expect(result!.days).toBe(17);
    expect(result!.reconcileId).toBe(42);
    expect(result!.invoiceId).toBe(100);
  });

  it('should return null for unpaid invoices', async () => {
    const mockClient = {
      searchRead: async () => [], // No reconciled lines
    } as any;

    const result = await calculateDaysToPay(mockClient, 100);
    expect(result).toBeNull();
  });

  it('should return 0 days for same-day payment', async () => {
    const mockClient = {
      searchRead: async (_model: string, domain: any[]) => {
        if (domain.some((d: any) => Array.isArray(d) && d[0] === 'move_id')) {
          return [{ id: 1, full_reconcile_id: [1, 'P001'], date: '2025-03-15' }];
        }
        return [
          { id: 1, date: '2025-03-15' },
          { id: 2, date: '2025-03-15' },
        ];
      },
    } as any;

    const result = await calculateDaysToPay(mockClient, 200);
    expect(result!.days).toBe(0);
  });
});

// ── getPostedMoveLines (with mock) ──────────────────────────────────

describe('getPostedMoveLines', () => {
  let getPostedMoveLines: any;

  beforeAll(async () => {
    const mod = await import('../src/services/accounting/functions');
    getPostedMoveLines = mod.getPostedMoveLines;
  });

  it('should automatically add parent_state=posted filter', async () => {
    let capturedDomain: any[];
    const mockClient = {
      searchRead: async (_model: string, domain: any[], _options: any) => {
        capturedDomain = domain;
        return [];
      },
    } as any;

    await getPostedMoveLines(mockClient, [['date', '>=', '2025-01-01']]);

    expect(capturedDomain!).toEqual([
      ['parent_state', '=', 'posted'],
      ['date', '>=', '2025-01-01'],
    ]);
  });

  it('should default limit to 0 (all records)', async () => {
    let capturedOptions: any;
    const mockClient = {
      searchRead: async (_model: string, _domain: any[], options: any) => {
        capturedOptions = options;
        return [];
      },
    } as any;

    await getPostedMoveLines(mockClient);

    expect(capturedOptions.limit).toBe(0);
  });

  it('should respect explicit limit override', async () => {
    let capturedOptions: any;
    const mockClient = {
      searchRead: async (_model: string, _domain: any[], options: any) => {
        capturedOptions = options;
        return [];
      },
    } as any;

    await getPostedMoveLines(mockClient, [], { limit: 10 });

    expect(capturedOptions.limit).toBe(10);
  });

  it('should pass through fields and order options', async () => {
    let capturedOptions: any;
    const mockClient = {
      searchRead: async (_model: string, _domain: any[], options: any) => {
        capturedOptions = options;
        return [];
      },
    } as any;

    await getPostedMoveLines(mockClient, [], {
      fields: ['debit', 'credit'],
      order: 'date asc',
    });

    expect(capturedOptions.fields).toEqual(['debit', 'credit']);
    expect(capturedOptions.order).toBe('date asc');
  });
});

// ── getCashBalance (with mock) ──────────────────────────────────────

describe('getCashBalance', () => {
  let getCashBalance: any;

  beforeAll(async () => {
    const mod = await import('../src/services/accounting/functions');
    getCashBalance = mod.getCashBalance;
  });

  it('should sum balances across all cash account lines', async () => {
    const mockClient = {
      searchRead: async () => [{ balance: 5000 }, { balance: -2000 }, { balance: 1500 }],
    } as any;

    const total = await getCashBalance(mockClient, [57, 58], '2025-06-30');
    expect(total).toBe(4500);
  });

  it('should return 0 when no lines exist', async () => {
    const mockClient = {
      searchRead: async () => [],
    } as any;

    const total = await getCashBalance(mockClient, [57], '2025-01-01');
    expect(total).toBe(0);
  });

  it('should handle null balance values', async () => {
    const mockClient = {
      searchRead: async () => [{ balance: 1000 }, { balance: null }, { balance: 500 }],
    } as any;

    const total = await getCashBalance(mockClient, [57], '2025-06-30');
    expect(total).toBe(1500);
  });
});

// ── AccountingService accessor ──────────────────────────────────────

describe('AccountingService (via client accessor)', () => {
  it('should be accessible via client.accounting', async () => {
    // Minimal mock just to test the accessor exists and is lazy
    const { OdooClient } = await import('../src/client/odoo-client');

    const client = new OdooClient({
      url: 'http://localhost:8069',
      database: 'test',
      username: 'admin',
      password: 'admin',
    });

    expect(client.accounting).toBeDefined();
    // Same instance on repeated access (lazy singleton)
    expect(client.accounting).toBe(client.accounting);
  });
});
