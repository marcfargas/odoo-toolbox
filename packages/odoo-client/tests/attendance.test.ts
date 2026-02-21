/**
 * Unit tests for attendance service functions.
 */

import { OdooValidationError } from '../src/types/errors';
import { resolveEmployeeId } from '../src/services/attendance/functions';

// We can't easily unit-test clockIn/clockOut without mocking the full client,
// but we can test resolveEmployeeId behavior and validate the types compile.

describe('resolveEmployeeId', () => {
  it('should return provided employeeId directly', async () => {
    const mockClient = {} as any;
    const result = await resolveEmployeeId(mockClient, 42);
    expect(result).toBe(42);
  });

  it('should throw when no session and no employeeId', async () => {
    const mockClient = {
      getSession: () => null,
    } as any;

    await expect(resolveEmployeeId(mockClient)).rejects.toThrow(OdooValidationError);
    await expect(resolveEmployeeId(mockClient)).rejects.toThrow(/no active session/);
  });

  it('should throw when no employee found for user', async () => {
    const mockClient = {
      getSession: () => ({ uid: 99 }),
      searchRead: async () => [],
    } as any;

    await expect(resolveEmployeeId(mockClient)).rejects.toThrow(OdooValidationError);
    await expect(resolveEmployeeId(mockClient)).rejects.toThrow(/No hr.employee record/);
  });

  it('should resolve employee from session uid', async () => {
    const mockClient = {
      getSession: () => ({ uid: 2 }),
      searchRead: async () => [{ id: 7 }],
    } as any;

    const result = await resolveEmployeeId(mockClient);
    expect(result).toBe(7);
  });
});
