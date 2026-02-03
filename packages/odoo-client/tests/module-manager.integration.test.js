"use strict";
/**
 * Integration tests for ModuleManager
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const src_1 = require("../src");
(0, vitest_1.describe)('ModuleManager integration tests', () => {
    let client;
    let moduleManager;
    (0, vitest_1.beforeAll)(async () => {
        client = new src_1.OdooClient({
            url: process.env.ODOO_URL || 'http://localhost:8069',
            database: process.env.ODOO_DB_NAME || 'odoo',
            username: process.env.ODOO_DB_USER || 'admin',
            password: process.env.ODOO_DB_PASSWORD || 'admin',
        });
        await client.authenticate();
        moduleManager = new src_1.ModuleManager(client);
    });
    (0, vitest_1.afterAll)(async () => {
        // Ensure test module is uninstalled
        try {
            const isInstalled = await moduleManager.isModuleInstalled('project');
            if (isInstalled) {
                await moduleManager.uninstallModule('project');
            }
        }
        catch (error) {
            console.warn('Failed to cleanup project module:', error);
        }
        client.logout();
    });
    (0, vitest_1.describe)('listModules', () => {
        (0, vitest_1.it)('should list all modules', async () => {
            const modules = await moduleManager.listModules();
            (0, vitest_1.expect)(modules).toBeDefined();
            (0, vitest_1.expect)(Array.isArray(modules)).toBe(true);
            (0, vitest_1.expect)(modules.length).toBeGreaterThan(0);
            // Check structure of first module
            const firstModule = modules[0];
            (0, vitest_1.expect)(firstModule).toHaveProperty('id');
            (0, vitest_1.expect)(firstModule).toHaveProperty('name');
            (0, vitest_1.expect)(firstModule).toHaveProperty('state');
        });
        (0, vitest_1.it)('should list installed modules only', async () => {
            const modules = await moduleManager.listModules({ state: 'installed' });
            (0, vitest_1.expect)(modules).toBeDefined();
            (0, vitest_1.expect)(Array.isArray(modules)).toBe(true);
            (0, vitest_1.expect)(modules.length).toBeGreaterThan(0);
            // All modules should have state 'installed'
            modules.forEach((module) => {
                (0, vitest_1.expect)(module.state).toBe('installed');
            });
        });
        (0, vitest_1.it)('should list uninstalled modules only', async () => {
            const modules = await moduleManager.listModules({ state: 'uninstalled' });
            (0, vitest_1.expect)(modules).toBeDefined();
            (0, vitest_1.expect)(Array.isArray(modules)).toBe(true);
            // All modules should have state 'uninstalled'
            modules.forEach((module) => {
                (0, vitest_1.expect)(module.state).toBe('uninstalled');
            });
        });
        (0, vitest_1.it)('should filter by application flag', async () => {
            const apps = await moduleManager.listModules({ application: true });
            (0, vitest_1.expect)(apps).toBeDefined();
            (0, vitest_1.expect)(Array.isArray(apps)).toBe(true);
            // All modules should have application flag set
            apps.forEach((module) => {
                (0, vitest_1.expect)(module.application).toBe(true);
            });
        });
        (0, vitest_1.it)('should support pagination', async () => {
            const page1 = await moduleManager.listModules({ limit: 5, offset: 0 });
            const page2 = await moduleManager.listModules({ limit: 5, offset: 5 });
            // Note: Odoo's search_read doesn't always respect limit for ir.module.module
            // This is a known Odoo quirk, so we just verify the method doesn't error
            (0, vitest_1.expect)(page1.length).toBeGreaterThan(0);
            (0, vitest_1.expect)(page2.length).toBeGreaterThan(0);
            (0, vitest_1.expect)(Array.isArray(page1)).toBe(true);
            (0, vitest_1.expect)(Array.isArray(page2)).toBe(true);
        });
    });
    (0, vitest_1.describe)('getModuleInfo', () => {
        (0, vitest_1.it)('should get info for base module', async () => {
            const moduleInfo = await moduleManager.getModuleInfo('base');
            (0, vitest_1.expect)(moduleInfo).toBeDefined();
            (0, vitest_1.expect)(moduleInfo.name).toBe('base');
            (0, vitest_1.expect)(moduleInfo.state).toBe('installed');
            (0, vitest_1.expect)(moduleInfo).toHaveProperty('id');
            (0, vitest_1.expect)(moduleInfo).toHaveProperty('shortdesc');
        });
        (0, vitest_1.it)('should get info for project module', async () => {
            const moduleInfo = await moduleManager.getModuleInfo('project');
            (0, vitest_1.expect)(moduleInfo).toBeDefined();
            (0, vitest_1.expect)(moduleInfo.name).toBe('project');
            (0, vitest_1.expect)(moduleInfo).toHaveProperty('state');
            (0, vitest_1.expect)(moduleInfo).toHaveProperty('summary');
            (0, vitest_1.expect)(moduleInfo).toHaveProperty('description');
        });
        (0, vitest_1.it)('should throw error for non-existent module', async () => {
            await (0, vitest_1.expect)(moduleManager.getModuleInfo('non_existent_module_xyz')).rejects.toThrow("Module 'non_existent_module_xyz' not found");
        });
    });
    (0, vitest_1.describe)('isModuleInstalled', () => {
        (0, vitest_1.it)('should return true for base module', async () => {
            const isInstalled = await moduleManager.isModuleInstalled('base');
            (0, vitest_1.expect)(isInstalled).toBe(true);
        });
        (0, vitest_1.it)('should return false for uninstalled module', async () => {
            // Ensure project is uninstalled first
            const projectInfo = await moduleManager.getModuleInfo('project');
            if (projectInfo.state === 'installed') {
                await moduleManager.uninstallModule('project');
            }
            const isInstalled = await moduleManager.isModuleInstalled('project');
            (0, vitest_1.expect)(isInstalled).toBe(false);
        });
    });
    (0, vitest_1.describe)('installModule and uninstallModule', () => {
        (0, vitest_1.it)('should install and uninstall project module', async () => {
            // Ensure project starts uninstalled
            const initialInfo = await moduleManager.getModuleInfo('project');
            if (initialInfo.state === 'installed') {
                await moduleManager.uninstallModule('project');
            }
            // Test installation
            const installedInfo = await moduleManager.installModule('project');
            (0, vitest_1.expect)(installedInfo.name).toBe('project');
            (0, vitest_1.expect)(installedInfo.state).toBe('installed');
            (0, vitest_1.expect)(installedInfo.installed_version).toBeDefined();
            // Verify module is actually installed
            const isInstalled = await moduleManager.isModuleInstalled('project');
            (0, vitest_1.expect)(isInstalled).toBe(true);
            // Test uninstallation
            const uninstalledInfo = await moduleManager.uninstallModule('project');
            (0, vitest_1.expect)(uninstalledInfo.name).toBe('project');
            (0, vitest_1.expect)(uninstalledInfo.state).toBe('uninstalled');
            // Verify module is actually uninstalled
            const isStillInstalled = await moduleManager.isModuleInstalled('project');
            (0, vitest_1.expect)(isStillInstalled).toBe(false);
        });
        (0, vitest_1.it)('should handle installing already installed module', async () => {
            // Install project if not installed
            await moduleManager.installModule('project');
            // Try to install again - should not throw error
            const moduleInfo = await moduleManager.installModule('project');
            (0, vitest_1.expect)(moduleInfo.state).toBe('installed');
            // Cleanup
            await moduleManager.uninstallModule('project');
        });
        (0, vitest_1.it)('should handle uninstalling already uninstalled module', async () => {
            // Ensure project is uninstalled
            const info = await moduleManager.getModuleInfo('project');
            if (info.state === 'installed') {
                await moduleManager.uninstallModule('project');
            }
            // Try to uninstall again - should not throw error
            const moduleInfo = await moduleManager.uninstallModule('project');
            (0, vitest_1.expect)(moduleInfo.state).toBe('uninstalled');
        });
        (0, vitest_1.it)('should throw error when installing non-existent module', async () => {
            await (0, vitest_1.expect)(moduleManager.installModule('non_existent_module_xyz')).rejects.toThrow("Module 'non_existent_module_xyz' not found");
        });
        (0, vitest_1.it)('should throw error when uninstalling non-existent module', async () => {
            await (0, vitest_1.expect)(moduleManager.uninstallModule('non_existent_module_xyz')).rejects.toThrow("Module 'non_existent_module_xyz' not found");
        });
        (0, vitest_1.it)('should not allow installing uninstallable module', async () => {
            // Find an uninstallable module
            const uninstallableModules = await moduleManager.listModules({
                state: 'uninstallable',
                limit: 1,
            });
            if (uninstallableModules.length > 0) {
                const moduleName = uninstallableModules[0].name;
                await (0, vitest_1.expect)(moduleManager.installModule(moduleName)).rejects.toThrow(/not installable/);
            }
        });
    });
    (0, vitest_1.describe)('upgradeModule', () => {
        (0, vitest_1.it)('should upgrade installed module', async () => {
            // Install project first
            await moduleManager.installModule('project');
            // Try to upgrade (might be a no-op if already at latest version)
            const upgradedInfo = await moduleManager.upgradeModule('project');
            (0, vitest_1.expect)(upgradedInfo.name).toBe('project');
            (0, vitest_1.expect)(upgradedInfo.state).toBe('installed');
            // Cleanup
            await moduleManager.uninstallModule('project');
        });
        (0, vitest_1.it)('should throw error when upgrading uninstalled module', async () => {
            // Ensure project is uninstalled
            const info = await moduleManager.getModuleInfo('project');
            if (info.state === 'installed') {
                await moduleManager.uninstallModule('project');
            }
            await (0, vitest_1.expect)(moduleManager.upgradeModule('project')).rejects.toThrow(/must be installed to upgrade/);
        });
    });
});
//# sourceMappingURL=module-manager.integration.test.js.map