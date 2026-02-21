/**
 * Unit tests for timesheets service validation logic.
 */

import { OdooValidationError } from '../src/types/errors';

describe('timesheets validation', () => {
  let startTimer: any;
  let logTime: any;
  let stopTimer: any;

  const mockClient = {
    getSession: () => ({ uid: 2 }),
    searchRead: async (model: string) => {
      if (model === 'hr.employee') return [{ id: 7 }];
      return [];
    },
    read: async () => [{ id: 1, unit_amount: 1.5, create_date: '2026-02-14 10:00:00' }],
    create: async () => 1,
    call: async () => ({}),
  } as any;

  beforeAll(async () => {
    const mod = await import('../src/services/timesheets/functions');
    startTimer = mod.startTimer;
    logTime = mod.logTime;
    stopTimer = mod.stopTimer;
  });

  describe('startTimer', () => {
    it('should reject empty description', async () => {
      await expect(startTimer(mockClient, { description: '', projectId: 1 })).rejects.toThrow(
        OdooValidationError
      );
      await expect(startTimer(mockClient, { description: '   ', projectId: 1 })).rejects.toThrow(
        /description is required/
      );
    });

    it('should reject missing projectId', async () => {
      await expect(startTimer(mockClient, { description: 'Work', projectId: 0 })).rejects.toThrow(
        OdooValidationError
      );
      await expect(startTimer(mockClient, { description: 'Work', projectId: 0 })).rejects.toThrow(
        /Project ID is required/
      );
    });
  });

  describe('logTime', () => {
    it('should reject empty description', async () => {
      await expect(
        logTime(mockClient, { description: '', projectId: 1, hours: 2 })
      ).rejects.toThrow(OdooValidationError);
    });

    it('should reject missing projectId', async () => {
      await expect(
        logTime(mockClient, { description: 'Work', projectId: 0, hours: 2 })
      ).rejects.toThrow(/Project ID is required/);
    });

    it('should reject zero hours', async () => {
      await expect(
        logTime(mockClient, { description: 'Work', projectId: 1, hours: 0 })
      ).rejects.toThrow(/Hours must be greater than 0/);
    });

    it('should reject negative hours', async () => {
      await expect(
        logTime(mockClient, { description: 'Work', projectId: 1, hours: -1 })
      ).rejects.toThrow(/Hours must be greater than 0/);
    });
  });

  describe('stopTimer', () => {
    it('should reject if entry already has duration', async () => {
      // mockClient.read returns unit_amount = 1.5 (not a running timer)
      await expect(stopTimer(mockClient, 999)).rejects.toThrow(OdooValidationError);
      await expect(stopTimer(mockClient, 999)).rejects.toThrow(/not a running timer/);
    });
  });
});
