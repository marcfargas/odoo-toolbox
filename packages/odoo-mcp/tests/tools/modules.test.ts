/**
 * Unit tests for module management tools.
 *
 * Tests cover:
 * - Module install/uninstall/upgrade
 * - Module listing and info
 * - Input validation
 * - Error handling
 */

import { describe, it, expect, vi } from 'vitest';
import {
  handleModuleInstall,
  handleModuleUninstall,
  handleModuleUpgrade,
  handleModuleList,
  handleModuleInfo,
} from '../../src/tools/modules';
import { SessionManager } from '../../src/session/session-manager';

// Create mock session with mock module manager
const createMockSession = (managerMethods: Record<string, any> = {}) => {
  const mockModuleManager = {
    installModule: vi.fn().mockResolvedValue({
      id: 1,
      name: 'sale',
      state: 'installed',
      shortdesc: 'Sales',
    }),
    uninstallModule: vi.fn().mockResolvedValue({
      id: 1,
      name: 'sale',
      state: 'uninstalled',
    }),
    upgradeModule: vi.fn().mockResolvedValue({
      id: 1,
      name: 'sale',
      state: 'installed',
      installed_version: '17.0.1.1',
    }),
    listModules: vi.fn().mockResolvedValue([
      { id: 1, name: 'sale', state: 'installed' },
      { id: 2, name: 'project', state: 'installed' },
    ]),
    getModuleInfo: vi.fn().mockResolvedValue({
      id: 1,
      name: 'sale',
      state: 'installed',
      shortdesc: 'Sales',
      installed_version: '17.0.1.0',
    }),
    ...managerMethods,
  };

  const mockSession = {
    getModuleManager: vi.fn().mockReturnValue(mockModuleManager),
    isAuthenticated: vi.fn().mockReturnValue(true),
  };

  return { session: mockSession as unknown as SessionManager, manager: mockModuleManager };
};

describe('Module Tools', () => {
  describe('handleModuleInstall', () => {
    it('installs module successfully', async () => {
      const { session, manager } = createMockSession();

      const result = await handleModuleInstall(session, { moduleName: 'sale' });

      expect(result.success).toBe(true);
      expect((result as any).module.name).toBe('sale');
      expect((result as any).module.state).toBe('installed');
      expect(manager.installModule).toHaveBeenCalledWith('sale');
    });

    it('returns error for empty module name', async () => {
      const { session } = createMockSession();

      const result = await handleModuleInstall(session, { moduleName: '' });

      expect(result.success).toBe(false);
      expect((result as any).error.code).toBe('INVALID_INPUT');
    });

    it('handles install failure', async () => {
      const { session } = createMockSession({
        installModule: vi.fn().mockRejectedValue(new Error('Module not found')),
      });

      const result = await handleModuleInstall(session, { moduleName: 'nonexistent' });

      expect(result.success).toBe(false);
    });
  });

  describe('handleModuleUninstall', () => {
    it('uninstalls module successfully', async () => {
      const { session, manager } = createMockSession();

      const result = await handleModuleUninstall(session, { moduleName: 'sale' });

      expect(result.success).toBe(true);
      expect((result as any).module.state).toBe('uninstalled');
      expect(manager.uninstallModule).toHaveBeenCalledWith('sale');
    });
  });

  describe('handleModuleUpgrade', () => {
    it('upgrades module successfully', async () => {
      const { session, manager } = createMockSession();

      const result = await handleModuleUpgrade(session, { moduleName: 'sale' });

      expect(result.success).toBe(true);
      expect((result as any).module.installed_version).toBe('17.0.1.1');
      expect(manager.upgradeModule).toHaveBeenCalledWith('sale');
    });
  });

  describe('handleModuleList', () => {
    it('lists all modules', async () => {
      const { session } = createMockSession();

      const result = await handleModuleList(session, {});

      expect(result.success).toBe(true);
      expect((result as any).modules).toHaveLength(2);
      expect((result as any).count).toBe(2);
    });

    it('filters by state', async () => {
      const { session, manager } = createMockSession();

      await handleModuleList(session, { state: 'installed' });

      expect(manager.listModules).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'installed' })
      );
    });

    it('filters by application flag', async () => {
      const { session, manager } = createMockSession();

      await handleModuleList(session, { application: true });

      expect(manager.listModules).toHaveBeenCalledWith(
        expect.objectContaining({ application: true })
      );
    });

    it('passes pagination options', async () => {
      const { session, manager } = createMockSession();

      await handleModuleList(session, { limit: 10, offset: 5 });

      expect(manager.listModules).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, offset: 5 })
      );
    });
  });

  describe('handleModuleInfo', () => {
    it('returns module info', async () => {
      const { session, manager } = createMockSession();

      const result = await handleModuleInfo(session, { moduleName: 'sale' });

      expect(result.success).toBe(true);
      expect((result as any).module.name).toBe('sale');
      expect((result as any).module.shortdesc).toBe('Sales');
      expect(manager.getModuleInfo).toHaveBeenCalledWith('sale');
    });

    it('handles module not found', async () => {
      const { session } = createMockSession({
        getModuleInfo: vi.fn().mockRejectedValue(new Error('Module not found')),
      });

      const result = await handleModuleInfo(session, { moduleName: 'nonexistent' });

      expect(result.success).toBe(false);
    });
  });
});
