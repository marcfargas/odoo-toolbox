/**
 * Test utilities for Odoo integration tests
 */
export interface OdooConfig {
    url: string;
    database: string;
    username: string;
    password: string;
}
/**
 * Create a test configuration from environment variables
 */
export declare function getTestConfig(): OdooConfig;
/**
 * Wait for Odoo to be ready with health check
 */
export declare function waitForOdoo(url?: string, maxAttempts?: number, intervalMs?: number): Promise<void>;
/**
 * Clean up test data by deleting records by name pattern
 * Useful for afterEach cleanup
 */
export declare function cleanupTestRecords(client: any, model: string, namePattern: string): Promise<void>;
/**
 * Create a unique test name with timestamp
 */
export declare function uniqueTestName(prefix: string): string;
/**
 * Wait for a condition to be true with timeout
 */
export declare function waitFor(condition: () => Promise<boolean> | boolean, timeoutMs?: number, intervalMs?: number): Promise<void>;
/**
 * Install a module for testing
 *
 * Uses the ModuleManager to install a module and tracks it for cleanup.
 * If the module is already installed, does nothing.
 *
 * @param moduleManager - ModuleManager instance
 * @param moduleName - Technical name of the module
 * @param installedModules - Array to track installed modules for cleanup (optional)
 * @returns Module info after installation
 */
export declare function installModuleForTest(moduleManager: any, moduleName: string, installedModules?: string[]): Promise<any>;
/**
 * Uninstall a module after testing
 *
 * Uses the ModuleManager to uninstall a module.
 * If the module is already uninstalled, does nothing.
 *
 * @param moduleManager - ModuleManager instance
 * @param moduleName - Technical name of the module
 * @returns Module info after uninstallation
 */
export declare function uninstallModuleForTest(moduleManager: any, moduleName: string): Promise<any>;
/**
 * Cleanup installed modules after tests
 *
 * Uninstalls all modules in the tracking array.
 * Useful for afterAll/afterEach cleanup.
 *
 * @param moduleManager - ModuleManager instance
 * @param installedModules - Array of module names to uninstall
 */
export declare function cleanupInstalledModules(moduleManager: any, installedModules: string[]): Promise<void>;
//# sourceMappingURL=odoo-instance.d.ts.map