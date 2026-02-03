"use strict";
/**
 * Unit tests for module management tools.
 *
 * Tests cover:
 * - Module install/uninstall/upgrade
 * - Module listing and info
 * - Input validation
 * - Error handling
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const modules_1 = require("../../src/tools/modules");
// Create mock session with mock module manager
const createMockSession = (managerMethods = {}) => {
    const mockModuleManager = {
        installModule: vitest_1.vi.fn().mockResolvedValue({
            id: 1,
            name: 'sale',
            state: 'installed',
            shortdesc: 'Sales',
        }),
        uninstallModule: vitest_1.vi.fn().mockResolvedValue({
            id: 1,
            name: 'sale',
            state: 'uninstalled',
        }),
        upgradeModule: vitest_1.vi.fn().mockResolvedValue({
            id: 1,
            name: 'sale',
            state: 'installed',
            installed_version: '17.0.1.1',
        }),
        listModules: vitest_1.vi.fn().mockResolvedValue([
            { id: 1, name: 'sale', state: 'installed' },
            { id: 2, name: 'project', state: 'installed' },
        ]),
        getModuleInfo: vitest_1.vi.fn().mockResolvedValue({
            id: 1,
            name: 'sale',
            state: 'installed',
            shortdesc: 'Sales',
            installed_version: '17.0.1.0',
        }),
        ...managerMethods,
    };
    const mockSession = {
        getModuleManager: vitest_1.vi.fn().mockReturnValue(mockModuleManager),
        isAuthenticated: vitest_1.vi.fn().mockReturnValue(true),
    };
    return { session: mockSession, manager: mockModuleManager };
};
(0, vitest_1.describe)('Module Tools', () => {
    (0, vitest_1.describe)('handleModuleInstall', () => {
        (0, vitest_1.it)('installs module successfully', async () => {
            const { session, manager } = createMockSession();
            const result = await (0, modules_1.handleModuleInstall)(session, { moduleName: 'sale' });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.module.name).toBe('sale');
            (0, vitest_1.expect)(result.module.state).toBe('installed');
            (0, vitest_1.expect)(manager.installModule).toHaveBeenCalledWith('sale');
        });
        (0, vitest_1.it)('returns error for empty module name', async () => {
            const { session } = createMockSession();
            const result = await (0, modules_1.handleModuleInstall)(session, { moduleName: '' });
            (0, vitest_1.expect)(result.success).toBe(false);
            (0, vitest_1.expect)(result.error.code).toBe('INVALID_INPUT');
        });
        (0, vitest_1.it)('handles install failure', async () => {
            const { session } = createMockSession({
                installModule: vitest_1.vi.fn().mockRejectedValue(new Error('Module not found')),
            });
            const result = await (0, modules_1.handleModuleInstall)(session, { moduleName: 'nonexistent' });
            (0, vitest_1.expect)(result.success).toBe(false);
        });
    });
    (0, vitest_1.describe)('handleModuleUninstall', () => {
        (0, vitest_1.it)('uninstalls module successfully', async () => {
            const { session, manager } = createMockSession();
            const result = await (0, modules_1.handleModuleUninstall)(session, { moduleName: 'sale' });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.module.state).toBe('uninstalled');
            (0, vitest_1.expect)(manager.uninstallModule).toHaveBeenCalledWith('sale');
        });
    });
    (0, vitest_1.describe)('handleModuleUpgrade', () => {
        (0, vitest_1.it)('upgrades module successfully', async () => {
            const { session, manager } = createMockSession();
            const result = await (0, modules_1.handleModuleUpgrade)(session, { moduleName: 'sale' });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.module.installed_version).toBe('17.0.1.1');
            (0, vitest_1.expect)(manager.upgradeModule).toHaveBeenCalledWith('sale');
        });
    });
    (0, vitest_1.describe)('handleModuleList', () => {
        (0, vitest_1.it)('lists all modules', async () => {
            const { session } = createMockSession();
            const result = await (0, modules_1.handleModuleList)(session, {});
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.modules).toHaveLength(2);
            (0, vitest_1.expect)(result.count).toBe(2);
        });
        (0, vitest_1.it)('filters by state', async () => {
            const { session, manager } = createMockSession();
            await (0, modules_1.handleModuleList)(session, { state: 'installed' });
            (0, vitest_1.expect)(manager.listModules).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ state: 'installed' }));
        });
        (0, vitest_1.it)('filters by application flag', async () => {
            const { session, manager } = createMockSession();
            await (0, modules_1.handleModuleList)(session, { application: true });
            (0, vitest_1.expect)(manager.listModules).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ application: true }));
        });
        (0, vitest_1.it)('passes pagination options', async () => {
            const { session, manager } = createMockSession();
            await (0, modules_1.handleModuleList)(session, { limit: 10, offset: 5 });
            (0, vitest_1.expect)(manager.listModules).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ limit: 10, offset: 5 }));
        });
    });
    (0, vitest_1.describe)('handleModuleInfo', () => {
        (0, vitest_1.it)('returns module info', async () => {
            const { session, manager } = createMockSession();
            const result = await (0, modules_1.handleModuleInfo)(session, { moduleName: 'sale' });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.module.name).toBe('sale');
            (0, vitest_1.expect)(result.module.shortdesc).toBe('Sales');
            (0, vitest_1.expect)(manager.getModuleInfo).toHaveBeenCalledWith('sale');
        });
        (0, vitest_1.it)('handles module not found', async () => {
            const { session } = createMockSession({
                getModuleInfo: vitest_1.vi.fn().mockRejectedValue(new Error('Module not found')),
            });
            const result = await (0, modules_1.handleModuleInfo)(session, { moduleName: 'nonexistent' });
            (0, vitest_1.expect)(result.success).toBe(false);
        });
    });
});
//# sourceMappingURL=modules.test.js.map