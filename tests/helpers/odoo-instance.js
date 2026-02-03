"use strict";
/**
 * Test utilities for Odoo integration tests
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTestConfig = getTestConfig;
exports.waitForOdoo = waitForOdoo;
exports.cleanupTestRecords = cleanupTestRecords;
exports.uniqueTestName = uniqueTestName;
exports.waitFor = waitFor;
exports.installModuleForTest = installModuleForTest;
exports.uninstallModuleForTest = uninstallModuleForTest;
exports.cleanupInstalledModules = cleanupInstalledModules;
const http = __importStar(require("http"));
/**
 * Create a test configuration from environment variables
 */
function getTestConfig() {
    return {
        url: process.env.ODOO_URL || 'http://localhost:8069',
        database: process.env.ODOO_DB_NAME || 'odoo',
        username: process.env.ODOO_DB_USER || 'admin',
        password: process.env.ODOO_DB_PASSWORD || 'admin',
    };
}
/**
 * Wait for Odoo to be ready with health check
 */
async function waitForOdoo(url = getTestConfig().url, maxAttempts = 60, intervalMs = 2000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            await new Promise((resolve, reject) => {
                const req = http.get(url + '/web/health', { timeout: 5000 }, (res) => {
                    if (res.statusCode === 200) {
                        resolve();
                    }
                    else {
                        reject(new Error(`Status code: ${res.statusCode}`));
                    }
                });
                req.on('error', reject);
                req.on('timeout', () => {
                    req.destroy();
                    reject(new Error('Request timeout'));
                });
            });
            return;
        }
        catch (error) {
            if (attempt < maxAttempts) {
                await new Promise((resolve) => setTimeout(resolve, intervalMs));
            }
            else {
                throw new Error(`Odoo failed to start after ${maxAttempts} attempts: ${error}`);
            }
        }
    }
}
/**
 * Clean up test data by deleting records by name pattern
 * Useful for afterEach cleanup
 */
async function cleanupTestRecords(client, model, namePattern) {
    try {
        const records = await client.search(model, [['name', 'ilike', namePattern]]);
        if (records.length > 0) {
            await client.unlink(model, records);
        }
    }
    catch (error) {
        console.warn(`Failed to cleanup ${model} records: ${error}`);
    }
}
/**
 * Create a unique test name with timestamp
 */
function uniqueTestName(prefix) {
    const timestamp = Date.now();
    return `${prefix}_${timestamp}_${Math.random().toString(36).substring(7)}`;
}
/**
 * Wait for a condition to be true with timeout
 */
async function waitFor(condition, timeoutMs = 10000, intervalMs = 100) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
        const result = await condition();
        if (result) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    throw new Error(`Condition not met within ${timeoutMs}ms`);
}
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
async function installModuleForTest(moduleManager, moduleName, installedModules) {
    const isInstalled = await moduleManager.isModuleInstalled(moduleName);
    if (!isInstalled) {
        const moduleInfo = await moduleManager.installModule(moduleName);
        if (installedModules) {
            installedModules.push(moduleName);
        }
        return moduleInfo;
    }
    return moduleManager.getModuleInfo(moduleName);
}
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
async function uninstallModuleForTest(moduleManager, moduleName) {
    const isInstalled = await moduleManager.isModuleInstalled(moduleName);
    if (isInstalled) {
        return await moduleManager.uninstallModule(moduleName);
    }
    return moduleManager.getModuleInfo(moduleName);
}
/**
 * Cleanup installed modules after tests
 *
 * Uninstalls all modules in the tracking array.
 * Useful for afterAll/afterEach cleanup.
 *
 * @param moduleManager - ModuleManager instance
 * @param installedModules - Array of module names to uninstall
 */
async function cleanupInstalledModules(moduleManager, installedModules) {
    for (const moduleName of installedModules) {
        try {
            await uninstallModuleForTest(moduleManager, moduleName);
        }
        catch (error) {
            console.warn(`Failed to cleanup module ${moduleName}: ${error}`);
        }
    }
    installedModules.length = 0; // Clear the array
}
//# sourceMappingURL=odoo-instance.js.map