/**
 * Example 5: Managing Odoo Modules (Addons)
 *
 * This example demonstrates how to:
 * - List available modules
 * - Check if a module is installed
 * - Install and uninstall modules
 * - Get detailed module information
 */

import { OdooClient, ModuleManager } from '@odoo-toolbox/client';

async function main() {
  // Connect to Odoo
  const client = new OdooClient({
    url: process.env.ODOO_URL || 'http://localhost:8069',
    database: process.env.ODOO_DB_NAME || 'odoo',
    username: process.env.ODOO_DB_USER || 'admin',
    password: process.env.ODOO_DB_PASSWORD || 'admin',
  });

  await client.authenticate();
  console.log('✅ Connected to Odoo\n');

  // Create module manager
  const moduleManager = new ModuleManager(client);

  // ========================================
  // Example 1: List installed modules
  // ========================================
  console.log('📋 Example 1: List installed modules');
  console.log('━'.repeat(60));

  const installed = await moduleManager.listModules({
    state: 'installed',
    limit: 10,
  });

  console.log(`Found ${installed.length} installed modules:\n`);
  installed.forEach((module) => {
    const app = module.application ? '📱' : '  ';
    console.log(`${app} ${module.name.padEnd(30)} ${module.shortdesc || module.summary || ''}`);
  });

  // ========================================
  // Example 2: List available applications
  // ========================================
  console.log('\n📱 Example 2: List available applications');
  console.log('━'.repeat(60));

  const apps = await moduleManager.listModules({
    application: true,
    state: 'uninstalled',
    limit: 10,
  });

  console.log(`Found ${apps.length} uninstalled applications:\n`);
  apps.forEach((module) => {
    console.log(`  ${module.name.padEnd(30)} ${module.shortdesc || module.summary || ''}`);
  });

  // ========================================
  // Example 3: Check if module is installed
  // ========================================
  console.log('\n🔍 Example 3: Check if module is installed');
  console.log('━'.repeat(60));

  const isProjectInstalled = await moduleManager.isModuleInstalled('project');
  console.log(`Is 'project' module installed? ${isProjectInstalled ? 'Yes ✅' : 'No ❌'}`);

  const isSaleInstalled = await moduleManager.isModuleInstalled('sale');
  console.log(`Is 'sale' module installed? ${isSaleInstalled ? 'Yes ✅' : 'No ❌'}`);

  // ========================================
  // Example 4: Get detailed module info
  // ========================================
  console.log('\n📦 Example 4: Get detailed module information');
  console.log('━'.repeat(60));

  const projectInfo = await moduleManager.getModuleInfo('project');
  console.log(`Module: ${projectInfo.name}`);
  console.log(`Name: ${projectInfo.shortdesc}`);
  console.log(`State: ${projectInfo.state}`);
  console.log(`Summary: ${projectInfo.summary}`);
  console.log(`Author: ${projectInfo.author}`);
  console.log(`License: ${projectInfo.license}`);
  console.log(`Website: ${projectInfo.website}`);
  console.log(`Category: ${projectInfo.category_id ? projectInfo.category_id[1] : 'N/A'}`);

  // ========================================
  // Example 5: Install a module
  // ========================================
  console.log('\n📥 Example 5: Install a module');
  console.log('━'.repeat(60));

  // Check if already installed
  if (!isProjectInstalled) {
    console.log('Installing project module...');
    const installedModule = await moduleManager.installModule('project');
    console.log(`✅ Installed: ${installedModule.name} (${installedModule.state})`);
    console.log(`   Version: ${installedModule.installed_version}`);
  } else {
    console.log('⏭️  Project module is already installed');
  }

  // ========================================
  // Example 6: Uninstall a module
  // ========================================
  console.log('\n📤 Example 6: Uninstall a module');
  console.log('━'.repeat(60));

  const isNowInstalled = await moduleManager.isModuleInstalled('project');
  if (isNowInstalled) {
    console.log('Uninstalling project module...');
    const uninstalledModule = await moduleManager.uninstallModule('project');
    console.log(`✅ Uninstalled: ${uninstalledModule.name} (${uninstalledModule.state})`);
  } else {
    console.log('⏭️  Project module is not installed');
  }

  // ========================================
  // Example 7: Upgrade a module
  // ========================================
  console.log('\n🔄 Example 7: Upgrade a module');
  console.log('━'.repeat(60));

  // First, install the module
  await moduleManager.installModule('project');
  console.log('Module installed, attempting upgrade...');

  const upgradedModule = await moduleManager.upgradeModule('project');
  console.log(`✅ Upgraded: ${upgradedModule.name}`);
  console.log(`   Version: ${upgradedModule.installed_version}`);

  // Cleanup: uninstall the module
  await moduleManager.uninstallModule('project');
  console.log('✅ Cleanup complete');

  // ========================================
  // Example 8: Batch module operations
  // ========================================
  console.log('\n🔢 Example 8: Batch module operations');
  console.log('━'.repeat(60));

  const modulesToCheck = ['project', 'sale', 'crm', 'hr'];
  console.log('Checking installation status for multiple modules:\n');

  for (const moduleName of modulesToCheck) {
    const isInstalled = await moduleManager.isModuleInstalled(moduleName);
    const status = isInstalled ? '✅ Installed' : '❌ Not installed';
    console.log(`  ${moduleName.padEnd(20)} ${status}`);
  }

  // ========================================
  // Example 9: Error handling
  // ========================================
  console.log('\n⚠️  Example 9: Error handling');
  console.log('━'.repeat(60));

  try {
    // Try to get info for non-existent module
    await moduleManager.getModuleInfo('non_existent_module_xyz');
  } catch (error: any) {
    console.log(`Expected error caught: ${error.message}`);
  }

  try {
    // Try to install non-existent module
    await moduleManager.installModule('non_existent_module_xyz');
  } catch (error: any) {
    console.log(`Expected error caught: ${error.message}`);
  }

  // Disconnect
  client.logout();
  console.log('\n✅ Examples completed successfully!');
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
