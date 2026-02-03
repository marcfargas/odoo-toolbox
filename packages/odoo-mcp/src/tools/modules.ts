import { SessionManager } from '../session/index.js';
import { formatError, McpErrorResponse } from '../utils/index.js';
import {
  ModuleInstallInputSchema,
  ModuleInstallOutput,
  ModuleUninstallInputSchema,
  ModuleUninstallOutput,
  ModuleUpgradeInputSchema,
  ModuleUpgradeOutput,
  ModuleListInputSchema,
  ModuleListOutput,
  ModuleInfoInputSchema,
  ModuleInfoOutput,
} from '../schemas/index.js';

export async function handleModuleInstall(
  session: SessionManager,
  input: unknown
): Promise<ModuleInstallOutput | McpErrorResponse> {
  try {
    const params = ModuleInstallInputSchema.parse(input);
    const moduleManager = session.getModuleManager();

    const module = await moduleManager.installModule(params.moduleName);

    return {
      success: true,
      module,
      message: `Successfully installed module ${params.moduleName}`,
    };
  } catch (error) {
    return formatError(error);
  }
}

export async function handleModuleUninstall(
  session: SessionManager,
  input: unknown
): Promise<ModuleUninstallOutput | McpErrorResponse> {
  try {
    const params = ModuleUninstallInputSchema.parse(input);
    const moduleManager = session.getModuleManager();

    const module = await moduleManager.uninstallModule(params.moduleName);

    return {
      success: true,
      module,
      message: `Successfully uninstalled module ${params.moduleName}`,
    };
  } catch (error) {
    return formatError(error);
  }
}

export async function handleModuleUpgrade(
  session: SessionManager,
  input: unknown
): Promise<ModuleUpgradeOutput | McpErrorResponse> {
  try {
    const params = ModuleUpgradeInputSchema.parse(input);
    const moduleManager = session.getModuleManager();

    const module = await moduleManager.upgradeModule(params.moduleName);

    return {
      success: true,
      module,
      message: `Successfully upgraded module ${params.moduleName}`,
    };
  } catch (error) {
    return formatError(error);
  }
}

export async function handleModuleList(
  session: SessionManager,
  input: unknown
): Promise<ModuleListOutput | McpErrorResponse> {
  try {
    const params = ModuleListInputSchema.parse(input);
    const moduleManager = session.getModuleManager();

    const modules = await moduleManager.listModules({
      state: params.state,
      application: params.application,
      limit: params.limit,
      offset: params.offset,
    });

    return {
      success: true,
      modules,
      count: modules.length,
      message: `Found ${modules.length} module(s)`,
    };
  } catch (error) {
    return formatError(error);
  }
}

export async function handleModuleInfo(
  session: SessionManager,
  input: unknown
): Promise<ModuleInfoOutput | McpErrorResponse> {
  try {
    const params = ModuleInfoInputSchema.parse(input);
    const moduleManager = session.getModuleManager();

    const module = await moduleManager.getModuleInfo(params.moduleName);

    return {
      success: true,
      module,
      message: `Retrieved info for module ${params.moduleName}`,
    };
  } catch (error) {
    return formatError(error);
  }
}

export const moduleToolDefinitions = [
  {
    name: 'odoo_module_install',
    description: 'Install an Odoo module',
    inputSchema: {
      type: 'object',
      properties: {
        moduleName: {
          type: 'string',
          description: "Technical module name (e.g., 'sale', 'project')",
        },
      },
      required: ['moduleName'],
    },
  },
  {
    name: 'odoo_module_uninstall',
    description: 'Uninstall an Odoo module',
    inputSchema: {
      type: 'object',
      properties: {
        moduleName: {
          type: 'string',
          description: 'Technical module name',
        },
      },
      required: ['moduleName'],
    },
  },
  {
    name: 'odoo_module_upgrade',
    description: 'Upgrade an installed Odoo module',
    inputSchema: {
      type: 'object',
      properties: {
        moduleName: {
          type: 'string',
          description: 'Technical module name',
        },
      },
      required: ['moduleName'],
    },
  },
  {
    name: 'odoo_module_list',
    description: 'List available Odoo modules with optional filtering',
    inputSchema: {
      type: 'object',
      properties: {
        state: {
          type: 'string',
          enum: [
            'installed',
            'uninstalled',
            'to install',
            'to upgrade',
            'to remove',
            'uninstallable',
          ],
          description: 'Filter by module state',
        },
        application: {
          type: 'boolean',
          description: 'Filter for application modules only',
        },
        limit: {
          type: 'number',
          description: 'Maximum modules to return',
        },
        offset: {
          type: 'number',
          description: 'Number of modules to skip',
        },
      },
      required: [],
    },
  },
  {
    name: 'odoo_module_info',
    description: 'Get detailed information about a specific Odoo module',
    inputSchema: {
      type: 'object',
      properties: {
        moduleName: {
          type: 'string',
          description: 'Technical module name',
        },
      },
      required: ['moduleName'],
    },
  },
];
