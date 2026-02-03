import { z } from 'zod';
import { ModuleInfo } from '@odoo-toolbox/client';

export const ModuleInstallInputSchema = z.object({
  moduleName: z.string().min(1).describe("Technical module name (e.g., 'sale', 'project')"),
});

export type ModuleInstallInput = z.infer<typeof ModuleInstallInputSchema>;

export interface ModuleInstallOutput {
  success: boolean;
  module?: ModuleInfo;
  message: string;
}

export const ModuleUninstallInputSchema = z.object({
  moduleName: z.string().min(1).describe('Technical module name'),
});

export type ModuleUninstallInput = z.infer<typeof ModuleUninstallInputSchema>;

export interface ModuleUninstallOutput {
  success: boolean;
  module?: ModuleInfo;
  message: string;
}

export const ModuleUpgradeInputSchema = z.object({
  moduleName: z.string().min(1).describe('Technical module name'),
});

export type ModuleUpgradeInput = z.infer<typeof ModuleUpgradeInputSchema>;

export interface ModuleUpgradeOutput {
  success: boolean;
  module?: ModuleInfo;
  message: string;
}

export const ModuleListInputSchema = z.object({
  state: z
    .enum(['installed', 'uninstalled', 'to install', 'to upgrade', 'to remove', 'uninstallable'])
    .optional()
    .describe('Filter by module state'),
  application: z.boolean().optional().describe('Filter for application modules only'),
  limit: z.number().int().positive().optional().describe('Maximum modules to return'),
  offset: z.number().int().nonnegative().optional().describe('Number of modules to skip'),
});

export type ModuleListInput = z.infer<typeof ModuleListInputSchema>;

export interface ModuleListOutput {
  success: boolean;
  modules: ModuleInfo[];
  count: number;
  message: string;
}

export const ModuleInfoInputSchema = z.object({
  moduleName: z.string().min(1).describe('Technical module name'),
});

export type ModuleInfoInput = z.infer<typeof ModuleInfoInputSchema>;

export interface ModuleInfoOutput {
  success: boolean;
  module?: ModuleInfo;
  message: string;
}
