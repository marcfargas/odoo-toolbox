/**
 * Dynamic tool registry for module-specific MCP tools.
 *
 * This registry enables dynamic registration and unregistration of tools
 * based on installed Odoo modules, matching the MCP protocol's support
 * for dynamic tool lists and change notifications.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { SessionManager } from '../session/index.js';

/**
 * Handler function for a tool invocation.
 */
export type ToolHandler = (session: SessionManager, args: unknown) => Promise<unknown> | unknown;

/**
 * Configuration for a module-specific tool set.
 */
export interface ModuleToolConfig {
  /**
   * Unique identifier for this module's tools (e.g., 'sale', 'project', 'crm')
   */
  moduleName: string;

  /**
   * Odoo module names that must be installed for these tools to be registered.
   * If empty, tools are always available (core tools).
   */
  requiredModules: string[];

  /**
   * Tool definitions to register when module is available.
   */
  tools: Tool[];

  /**
   * Map of tool names to their handler functions.
   */
  handlers: Map<string, ToolHandler>;
}

/**
 * Registry for dynamically managing MCP tools based on installed Odoo modules.
 *
 * Features:
 * - Register/unregister tools by module
 * - Query available tools
 * - Look up handlers by tool name
 * - Track module dependencies
 */
export class DynamicToolRegistry {
  /**
   * Map of module name to its tool configuration.
   */
  private moduleConfigs = new Map<string, ModuleToolConfig>();

  /**
   * Map of tool name to the module it belongs to.
   */
  private toolToModule = new Map<string, string>();

  /**
   * Map of tool name to its handler function.
   */
  private handlers = new Map<string, ToolHandler>();

  /**
   * Map of tool name to its definition.
   */
  private toolDefinitions = new Map<string, Tool>();

  /**
   * Set of currently registered module names.
   */
  private registeredModules = new Set<string>();

  /**
   * Register a module's tools.
   *
   * @param config Module tool configuration
   */
  register(config: ModuleToolConfig): void {
    // Prevent duplicate registration
    if (this.registeredModules.has(config.moduleName)) {
      return;
    }

    // Store the configuration
    this.moduleConfigs.set(config.moduleName, config);
    this.registeredModules.add(config.moduleName);

    // Register each tool
    for (const tool of config.tools) {
      this.toolToModule.set(tool.name, config.moduleName);
      this.toolDefinitions.set(tool.name, tool);

      // Register handler if provided
      const handler = config.handlers.get(tool.name);
      if (handler) {
        this.handlers.set(tool.name, handler);
      }
    }
  }

  /**
   * Unregister a module's tools.
   *
   * @param moduleName Module name to unregister
   * @returns True if module was registered and removed, false otherwise
   */
  unregister(moduleName: string): boolean {
    const config = this.moduleConfigs.get(moduleName);
    if (!config) {
      return false;
    }

    // Remove all tools for this module
    for (const tool of config.tools) {
      this.toolToModule.delete(tool.name);
      this.toolDefinitions.delete(tool.name);
      this.handlers.delete(tool.name);
    }

    // Remove module tracking
    this.moduleConfigs.delete(moduleName);
    this.registeredModules.delete(moduleName);

    return true;
  }

  /**
   * Get all currently registered tool definitions.
   *
   * @returns Array of tool definitions
   */
  getTools(): Tool[] {
    return Array.from(this.toolDefinitions.values());
  }

  /**
   * Get handler for a specific tool.
   *
   * @param toolName Tool name
   * @returns Handler function or undefined if not found
   */
  getHandler(toolName: string): ToolHandler | undefined {
    return this.handlers.get(toolName);
  }

  /**
   * Check if a tool is registered.
   *
   * @param toolName Tool name
   * @returns True if tool is registered
   */
  hasTool(toolName: string): boolean {
    return this.toolDefinitions.has(toolName);
  }

  /**
   * Check if a module is registered.
   *
   * @param moduleName Module name
   * @returns True if module is registered
   */
  hasModule(moduleName: string): boolean {
    return this.registeredModules.has(moduleName);
  }

  /**
   * Get the module name for a specific tool.
   *
   * @param toolName Tool name
   * @returns Module name or undefined if tool not found
   */
  getModuleForTool(toolName: string): string | undefined {
    return this.toolToModule.get(toolName);
  }

  /**
   * Get all registered module names.
   *
   * @returns Array of registered module names
   */
  getRegisteredModules(): string[] {
    return Array.from(this.registeredModules);
  }

  /**
   * Clear all registered tools and modules.
   */
  clear(): void {
    this.moduleConfigs.clear();
    this.toolToModule.clear();
    this.handlers.clear();
    this.toolDefinitions.clear();
    this.registeredModules.clear();
  }

  /**
   * Get statistics about the registry.
   */
  getStats(): {
    moduleCount: number;
    toolCount: number;
    handlerCount: number;
  } {
    return {
      moduleCount: this.registeredModules.size,
      toolCount: this.toolDefinitions.size,
      handlerCount: this.handlers.size,
    };
  }
}
