#!/usr/bin/env node

/**
 * CLI tool for managing Odoo addons
 * 
 * Usage:
 *   npm run addon:install <module-name>   - Install a module
 *   npm run addon:uninstall <module-name> - Uninstall a module
 *   npm run addon:list [state]            - List modules (optional: installed, uninstalled)
 *   npm run addon:info <module-name>      - Get module information
 */

const { OdooClient, ModuleManager } = require('../packages/odoo-client/dist');

const COMMANDS = {
  install: 'install',
  uninstall: 'uninstall',
  list: 'list',
  info: 'info',
};

function printUsage() {
  console.log(`
Odoo Addon Manager

Usage:
  npm run addon:install <module-name>      Install a module
  npm run addon:uninstall <module-name>    Uninstall a module
  npm run addon:list [state]               List modules (optional: installed, uninstalled, all)
  npm run addon:info <module-name>         Get detailed module information

Environment Variables:
  ODOO_URL           Odoo URL (default: http://localhost:8069)
  ODOO_DB_NAME       Database name (default: odoo)
  ODOO_DB_USER       Database user (default: admin)
  ODOO_DB_PASSWORD   Database password (default: admin)

Examples:
  npm run addon:install project
  npm run addon:uninstall project
  npm run addon:list installed
  npm run addon:info sale
`);
}

function getConfig() {
  return {
    url: process.env.ODOO_URL || 'http://localhost:8069',
    database: process.env.ODOO_DB_NAME || 'odoo',
    username: process.env.ODOO_DB_USER || 'admin',
    password: process.env.ODOO_DB_PASSWORD || 'admin',
  };
}

async function installModule(moduleManager, moduleName) {
  console.log(`📥 Installing module: ${moduleName}...`);
  
  try {
    const moduleInfo = await moduleManager.installModule(moduleName);
    console.log(`✅ Module installed successfully!`);
    console.log(`   Name: ${moduleInfo.name}`);
    console.log(`   Description: ${moduleInfo.shortdesc || moduleInfo.summary || 'N/A'}`);
    console.log(`   State: ${moduleInfo.state}`);
    console.log(`   Version: ${moduleInfo.installed_version || 'N/A'}`);
  } catch (error) {
    console.error(`❌ Failed to install module: ${error.message}`);
    process.exit(1);
  }
}

async function uninstallModule(moduleManager, moduleName) {
  console.log(`📤 Uninstalling module: ${moduleName}...`);
  
  try {
    const moduleInfo = await moduleManager.uninstallModule(moduleName);
    console.log(`✅ Module uninstalled successfully!`);
    console.log(`   Name: ${moduleInfo.name}`);
    console.log(`   State: ${moduleInfo.state}`);
  } catch (error) {
    console.error(`❌ Failed to uninstall module: ${error.message}`);
    process.exit(1);
  }
}

async function listModules(moduleManager, state) {
  const options = {};
  
  if (state && state !== 'all') {
    options.state = state;
    console.log(`📋 Listing ${state} modules...`);
  } else {
    console.log(`📋 Listing all modules...`);
  }
  
  try {
    const modules = await moduleManager.listModules(options);
    
    if (modules.length === 0) {
      console.log('No modules found.');
      return;
    }
    
    console.log(`\nFound ${modules.length} modules:\n`);
    
    // Group by category for better readability
    const byCategory = {};
    modules.forEach(m => {
      const category = m.category_id ? m.category_id[1] : 'Uncategorized';
      if (!byCategory[category]) {
        byCategory[category] = [];
      }
      byCategory[category].push(m);
    });
    
    // Print grouped modules
    Object.keys(byCategory).sort().forEach(category => {
      console.log(`\n${category}:`);
      byCategory[category].forEach(m => {
        const state = m.state === 'installed' ? '✓' : ' ';
        const app = m.application ? '📱' : '  ';
        console.log(`  [${state}] ${app} ${m.name.padEnd(30)} ${m.shortdesc || m.summary || ''}`);
      });
    });
    
    console.log(`\n✓ = Installed, 📱 = Application`);
  } catch (error) {
    console.error(`❌ Failed to list modules: ${error.message}`);
    process.exit(1);
  }
}

async function getModuleInfo(moduleManager, moduleName) {
  console.log(`📦 Getting information for module: ${moduleName}...`);
  
  try {
    const moduleInfo = await moduleManager.getModuleInfo(moduleName);
    
    console.log(`\n${moduleInfo.shortdesc || moduleName}`);
    console.log('='.repeat(60));
    console.log(`Technical Name: ${moduleInfo.name}`);
    console.log(`State: ${moduleInfo.state}`);
    console.log(`Category: ${moduleInfo.category_id ? moduleInfo.category_id[1] : 'N/A'}`);
    console.log(`Author: ${moduleInfo.author || 'N/A'}`);
    console.log(`License: ${moduleInfo.license || 'N/A'}`);
    console.log(`Website: ${moduleInfo.website || 'N/A'}`);
    console.log(`Installed Version: ${moduleInfo.installed_version || 'Not installed'}`);
    console.log(`Latest Version: ${moduleInfo.latest_version || 'N/A'}`);
    console.log(`Application: ${moduleInfo.application ? 'Yes' : 'No'}`);
    
    if (moduleInfo.summary) {
      console.log(`\nSummary:`);
      console.log(`  ${moduleInfo.summary}`);
    }
    
    if (moduleInfo.description) {
      const desc = moduleInfo.description
        .split('\n')
        .filter(line => line.trim())
        .slice(0, 10) // First 10 non-empty lines
        .join('\n  ');
      
      if (desc) {
        console.log(`\nDescription:`);
        console.log(`  ${desc}`);
        
        if (moduleInfo.description.split('\n').length > 10) {
          console.log(`  ...`);
        }
      }
    }
  } catch (error) {
    console.error(`❌ Failed to get module info: ${error.message}`);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printUsage();
    process.exit(0);
  }
  
  const command = args[0];
  const moduleName = args[1];
  
  if (!Object.values(COMMANDS).includes(command)) {
    console.error(`❌ Unknown command: ${command}`);
    printUsage();
    process.exit(1);
  }
  
  if (command !== COMMANDS.list && !moduleName) {
    console.error(`❌ Module name is required for command: ${command}`);
    printUsage();
    process.exit(1);
  }
  
  // Connect to Odoo
  const config = getConfig();
  console.log(`🔌 Connecting to Odoo at ${config.url}...`);
  
  const client = new OdooClient(config);
  
  try {
    await client.authenticate();
    console.log(`✅ Connected to database: ${config.database}\n`);
  } catch (error) {
    console.error(`❌ Failed to connect: ${error.message}`);
    process.exit(1);
  }
  
  const moduleManager = new ModuleManager(client);
  
  try {
    switch (command) {
      case COMMANDS.install:
        await installModule(moduleManager, moduleName);
        break;
      
      case COMMANDS.uninstall:
        await uninstallModule(moduleManager, moduleName);
        break;
      
      case COMMANDS.list:
        await listModules(moduleManager, moduleName);
        break;
      
      case COMMANDS.info:
        await getModuleInfo(moduleManager, moduleName);
        break;
    }
  } finally {
    client.logout();
  }
}

main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
