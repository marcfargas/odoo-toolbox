/**
 * Module manager for installing, uninstalling, and managing Odoo modules
 *
 * Provides methods for managing Odoo addons/modules through the ir.module.module API
 *
 * @see https://github.com/odoo/odoo/blob/17.0/odoo/addons/base/models/ir_module.py
 */

import debug from 'debug';
import { OdooClient } from './odoo-client';

const log = debug('odoo-client:module-manager');

export interface ModuleInfo {
  id: number;
  name: string;
  state: 'uninstalled' | 'installed' | 'to install' | 'to upgrade' | 'to remove' | 'uninstallable';
  shortdesc?: string;
  summary?: string;
  description?: string;
  author?: string;
  website?: string;
  installed_version?: string;
  latest_version?: string;
  license?: string;
  application?: boolean;
  category_id?: [number, string];
}

export interface ModuleListOptions {
  /** Filter modules by state */
  state?: ModuleInfo['state'];
  /** Filter modules that are applications */
  application?: boolean;
  /** Limit number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Manager for Odoo module operations
 *
 * Handles installation, uninstallation, upgrades, and listing of Odoo modules.
 */
export class ModuleManager {
  private client: OdooClient;

  constructor(client: OdooClient) {
    this.client = client;
  }

  /**
   * Install a module by name
   *
   * Uses button_immediate_install method from ir.module.module model.
   * This method installs the module and its dependencies immediately.
   *
   * @param moduleName - Technical name of the module (e.g., 'project', 'sale', 'crm')
   * @returns Module info after installation
   *
   * @see https://github.com/odoo/odoo/blob/17.0/odoo/addons/base/models/ir_module.py#L500
   *
   * @example
   * ```typescript
   * await moduleManager.installModule('project');
   * ```
   */
  async installModule(moduleName: string): Promise<ModuleInfo> {
    log('Installing module: %s', moduleName);

    // Find the module
    const modules = await this.client.searchRead<ModuleInfo>(
      'ir.module.module',
      [['name', '=', moduleName]],
      { fields: ['id', 'name', 'state'], limit: 1 }
    );

    if (modules.length === 0) {
      throw new Error(`Module '${moduleName}' not found`);
    }

    const module = modules[0];

    if (module.state === 'installed') {
      log('Module %s is already installed', moduleName);
      return module;
    }

    if (module.state === 'uninstallable') {
      throw new Error(`Module '${moduleName}' is not installable (state: ${module.state})`);
    }

    // Install the module using button_immediate_install
    // This method installs the module and its dependencies immediately
    log('Calling button_immediate_install for module %s (id: %d)', moduleName, module.id);
    await this.client.call('ir.module.module', 'button_immediate_install', [[module.id]]);

    // Fetch updated module info
    const [updatedModule] = await this.client.searchRead<ModuleInfo>(
      'ir.module.module',
      [['id', '=', module.id]],
      {
        fields: ['id', 'name', 'state', 'shortdesc', 'summary', 'installed_version', 'application'],
      }
    );

    log('Module %s installed successfully (state: %s)', moduleName, updatedModule.state);
    return updatedModule;
  }

  /**
   * Uninstall a module by name
   *
   * Uses button_immediate_uninstall method from ir.module.module model.
   * This method uninstalls the module immediately.
   *
   * @param moduleName - Technical name of the module
   * @returns Module info after uninstallation
   *
   * @see https://github.com/odoo/odoo/blob/17.0/odoo/addons/base/models/ir_module.py#L550
   *
   * @example
   * ```typescript
   * await moduleManager.uninstallModule('project');
   * ```
   */
  async uninstallModule(moduleName: string): Promise<ModuleInfo> {
    log('Uninstalling module: %s', moduleName);

    // Find the module
    const modules = await this.client.searchRead<ModuleInfo>(
      'ir.module.module',
      [['name', '=', moduleName]],
      { fields: ['id', 'name', 'state'], limit: 1 }
    );

    if (modules.length === 0) {
      throw new Error(`Module '${moduleName}' not found`);
    }

    const module = modules[0];

    if (module.state === 'uninstalled') {
      log('Module %s is already uninstalled', moduleName);
      return module;
    }

    if (module.state !== 'installed') {
      throw new Error(
        `Module '${moduleName}' cannot be uninstalled (current state: ${module.state})`
      );
    }

    // Uninstall the module using button_immediate_uninstall
    log('Calling button_immediate_uninstall for module %s (id: %d)', moduleName, module.id);
    await this.client.call('ir.module.module', 'button_immediate_uninstall', [[module.id]]);

    // Fetch updated module info
    const [updatedModule] = await this.client.searchRead<ModuleInfo>(
      'ir.module.module',
      [['id', '=', module.id]],
      {
        fields: ['id', 'name', 'state', 'shortdesc', 'summary', 'installed_version', 'application'],
      }
    );

    log('Module %s uninstalled successfully (state: %s)', moduleName, updatedModule.state);
    return updatedModule;
  }

  /**
   * Upgrade a module to its latest version
   *
   * Uses button_immediate_upgrade method from ir.module.module model.
   *
   * @param moduleName - Technical name of the module
   * @returns Module info after upgrade
   *
   * @see https://github.com/odoo/odoo/blob/17.0/odoo/addons/base/models/ir_module.py#L525
   *
   * @example
   * ```typescript
   * await moduleManager.upgradeModule('project');
   * ```
   */
  async upgradeModule(moduleName: string): Promise<ModuleInfo> {
    log('Upgrading module: %s', moduleName);

    // Find the module
    const modules = await this.client.searchRead<ModuleInfo>(
      'ir.module.module',
      [['name', '=', moduleName]],
      { fields: ['id', 'name', 'state'], limit: 1 }
    );

    if (modules.length === 0) {
      throw new Error(`Module '${moduleName}' not found`);
    }

    const module = modules[0];

    if (module.state !== 'installed') {
      throw new Error(
        `Module '${moduleName}' must be installed to upgrade (current state: ${module.state})`
      );
    }

    // Upgrade the module using button_immediate_upgrade
    log('Calling button_immediate_upgrade for module %s (id: %d)', moduleName, module.id);
    await this.client.call('ir.module.module', 'button_immediate_upgrade', [[module.id]]);

    // Fetch updated module info
    const [updatedModule] = await this.client.searchRead<ModuleInfo>(
      'ir.module.module',
      [['id', '=', module.id]],
      {
        fields: ['id', 'name', 'state', 'shortdesc', 'summary', 'installed_version', 'application'],
      }
    );

    log('Module %s upgraded successfully', moduleName);
    return updatedModule;
  }

  /**
   * List available modules with optional filtering
   *
   * @param options - Filtering and pagination options
   * @returns Array of module information
   *
   * @example
   * ```typescript
   * // List all installed modules
   * const installed = await moduleManager.listModules({ state: 'installed' });
   *
   * // List all applications
   * const apps = await moduleManager.listModules({ application: true });
   * ```
   */
  async listModules(options: ModuleListOptions = {}): Promise<ModuleInfo[]> {
    log('Listing modules with options: %o', options);

    const domain: any[] = [];

    if (options.state) {
      domain.push(['state', '=', options.state]);
    }

    if (options.application !== undefined) {
      domain.push(['application', '=', options.application]);
    }

    const searchOptions: any = {
      fields: [
        'id',
        'name',
        'state',
        'shortdesc',
        'summary',
        'author',
        'website',
        'installed_version',
        'latest_version',
        'license',
        'application',
        'category_id',
      ],
    };

    if (options.limit !== undefined) {
      searchOptions.limit = options.limit;
    }

    if (options.offset !== undefined) {
      searchOptions.offset = options.offset;
    }

    const modules = await this.client.searchRead<ModuleInfo>(
      'ir.module.module',
      domain,
      searchOptions
    );

    log('Found %d modules', modules.length);
    return modules;
  }

  /**
   * Get detailed information about a specific module
   *
   * @param moduleName - Technical name of the module
   * @returns Detailed module information
   *
   * @example
   * ```typescript
   * const info = await moduleManager.getModuleInfo('project');
   * console.log(info.description);
   * ```
   */
  async getModuleInfo(moduleName: string): Promise<ModuleInfo> {
    log('Getting info for module: %s', moduleName);

    const modules = await this.client.searchRead<ModuleInfo>(
      'ir.module.module',
      [['name', '=', moduleName]],
      {
        fields: [
          'id',
          'name',
          'state',
          'shortdesc',
          'summary',
          'description',
          'author',
          'website',
          'installed_version',
          'latest_version',
          'license',
          'application',
          'category_id',
        ],
        limit: 1,
      }
    );

    if (modules.length === 0) {
      throw new Error(`Module '${moduleName}' not found`);
    }

    return modules[0];
  }

  /**
   * Check if a module is installed
   *
   * @param moduleName - Technical name of the module
   * @returns True if module is installed
   *
   * @example
   * ```typescript
   * if (await moduleManager.isModuleInstalled('project')) {
   *   console.log('Project module is installed');
   * }
   * ```
   */
  async isModuleInstalled(moduleName: string): Promise<boolean> {
    log('Checking if module is installed: %s', moduleName);

    const modules = await this.client.searchRead<ModuleInfo>(
      'ir.module.module',
      [
        ['name', '=', moduleName],
        ['state', '=', 'installed'],
      ],
      { fields: ['id'], limit: 1 }
    );

    return modules.length > 0;
  }
}
