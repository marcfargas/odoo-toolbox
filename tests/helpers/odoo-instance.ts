/**
 * Test utilities for Odoo integration tests
 */

import * as http from 'http';

export interface OdooConfig {
  url: string;
  database: string;
  username: string;
  password: string;
}

/**
 * Create a test configuration from environment variables
 */
export function getTestConfig(): OdooConfig {
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
export async function waitForOdoo(
  url: string = getTestConfig().url,
  maxAttempts: number = 60,
  intervalMs: number = 2000
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get(url + '/web/health', { timeout: 5000 }, (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
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
    } catch (error) {
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      } else {
        throw new Error(`Odoo failed to start after ${maxAttempts} attempts: ${error}`);
      }
    }
  }
}

/**
 * Clean up test data by deleting records by name pattern
 * Useful for afterEach cleanup
 */
export async function cleanupTestRecords(
  client: any,
  model: string,
  namePattern: string
): Promise<void> {
  try {
    const records = await client.search(model, [['name', 'ilike', namePattern]]);
    if (records.length > 0) {
      await client.unlink(model, records);
    }
  } catch (error) {
    console.warn(`Failed to cleanup ${model} records: ${error}`);
  }
}

/**
 * Create a unique test name with timestamp
 */
export function uniqueTestName(prefix: string): string {
  const timestamp = Date.now();
  return `${prefix}_${timestamp}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Wait for a condition to be true with timeout
 */
export async function waitFor(
  condition: () => Promise<boolean> | boolean,
  timeoutMs: number = 10000,
  intervalMs: number = 100
): Promise<void> {
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
export async function installModuleForTest(
  moduleManager: any,
  moduleName: string,
  installedModules?: string[]
): Promise<any> {
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
export async function uninstallModuleForTest(
  moduleManager: any,
  moduleName: string
): Promise<any> {
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
export async function cleanupInstalledModules(
  moduleManager: any,
  installedModules: string[]
): Promise<void> {
  for (const moduleName of installedModules) {
    try {
      await uninstallModuleForTest(moduleManager, moduleName);
    } catch (error) {
      console.warn(`Failed to cleanup module ${moduleName}: ${error}`);
    }
  }
  
  installedModules.length = 0; // Clear the array
}
