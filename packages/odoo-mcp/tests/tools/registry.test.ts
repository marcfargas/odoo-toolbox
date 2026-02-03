/**
 * Unit tests for DynamicToolRegistry.
 *
 * Tests cover:
 * - Tool registration and unregistration
 * - Handler lookup
 * - Module tracking
 * - Statistics
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DynamicToolRegistry, ModuleToolConfig } from '../../src/tools/registry';

describe('DynamicToolRegistry', () => {
  let registry: DynamicToolRegistry;

  beforeEach(() => {
    registry = new DynamicToolRegistry();
  });

  describe('registration', () => {
    it('registers a module with tools', () => {
      const config: ModuleToolConfig = {
        moduleName: 'sale',
        requiredModules: ['sale'],
        tools: [
          {
            name: 'odoo_sale_create_quotation',
            description: 'Create a sales quotation',
            inputSchema: {
              type: 'object',
              properties: {
                partner_id: { type: 'number' },
              },
              required: ['partner_id'],
            },
          },
        ],
        handlers: new Map([['odoo_sale_create_quotation', async () => ({ success: true })]]),
      };

      registry.register(config);

      expect(registry.hasModule('sale')).toBe(true);
      expect(registry.hasTool('odoo_sale_create_quotation')).toBe(true);
      expect(registry.getTools()).toHaveLength(1);
      expect(registry.getHandler('odoo_sale_create_quotation')).toBeDefined();
    });

    it('prevents duplicate module registration', () => {
      const config: ModuleToolConfig = {
        moduleName: 'project',
        requiredModules: ['project'],
        tools: [
          {
            name: 'odoo_project_create_task',
            description: 'Create a project task',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
        handlers: new Map(),
      };

      registry.register(config);
      registry.register(config); // Second registration should be ignored

      expect(registry.getTools()).toHaveLength(1);
    });

    it('registers multiple modules', () => {
      const saleConfig: ModuleToolConfig = {
        moduleName: 'sale',
        requiredModules: ['sale'],
        tools: [
          {
            name: 'odoo_sale_create_quotation',
            description: 'Create quotation',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
        handlers: new Map(),
      };

      const projectConfig: ModuleToolConfig = {
        moduleName: 'project',
        requiredModules: ['project'],
        tools: [
          {
            name: 'odoo_project_create_task',
            description: 'Create task',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
        handlers: new Map(),
      };

      registry.register(saleConfig);
      registry.register(projectConfig);

      expect(registry.getTools()).toHaveLength(2);
      expect(registry.hasModule('sale')).toBe(true);
      expect(registry.hasModule('project')).toBe(true);
    });

    it('tracks tool-to-module mapping', () => {
      const config: ModuleToolConfig = {
        moduleName: 'crm',
        requiredModules: ['crm'],
        tools: [
          {
            name: 'odoo_crm_create_lead',
            description: 'Create a lead',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
        handlers: new Map(),
      };

      registry.register(config);

      expect(registry.getModuleForTool('odoo_crm_create_lead')).toBe('crm');
      expect(registry.getModuleForTool('unknown_tool')).toBeUndefined();
    });
  });

  describe('unregistration', () => {
    it('unregisters a module and its tools', () => {
      const config: ModuleToolConfig = {
        moduleName: 'sale',
        requiredModules: ['sale'],
        tools: [
          {
            name: 'odoo_sale_create_quotation',
            description: 'Create quotation',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
        handlers: new Map([['odoo_sale_create_quotation', async () => ({})]]),
      };

      registry.register(config);
      expect(registry.hasModule('sale')).toBe(true);

      const result = registry.unregister('sale');

      expect(result).toBe(true);
      expect(registry.hasModule('sale')).toBe(false);
      expect(registry.hasTool('odoo_sale_create_quotation')).toBe(false);
      expect(registry.getTools()).toHaveLength(0);
      expect(registry.getHandler('odoo_sale_create_quotation')).toBeUndefined();
    });

    it('returns false for unregistering non-existent module', () => {
      const result = registry.unregister('nonexistent');
      expect(result).toBe(false);
    });

    it('only removes tools from specific module', () => {
      const saleConfig: ModuleToolConfig = {
        moduleName: 'sale',
        requiredModules: ['sale'],
        tools: [
          {
            name: 'odoo_sale_create_quotation',
            description: 'Create quotation',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
        handlers: new Map(),
      };

      const projectConfig: ModuleToolConfig = {
        moduleName: 'project',
        requiredModules: ['project'],
        tools: [
          {
            name: 'odoo_project_create_task',
            description: 'Create task',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
        handlers: new Map(),
      };

      registry.register(saleConfig);
      registry.register(projectConfig);

      registry.unregister('sale');

      expect(registry.hasModule('sale')).toBe(false);
      expect(registry.hasModule('project')).toBe(true);
      expect(registry.getTools()).toHaveLength(1);
      expect(registry.hasTool('odoo_project_create_task')).toBe(true);
    });
  });

  describe('tool queries', () => {
    it('returns empty array when no tools registered', () => {
      expect(registry.getTools()).toEqual([]);
    });

    it('returns all registered tools', () => {
      const config: ModuleToolConfig = {
        moduleName: 'core',
        requiredModules: [],
        tools: [
          {
            name: 'odoo_search',
            description: 'Search records',
            inputSchema: { type: 'object', properties: {} },
          },
          {
            name: 'odoo_read',
            description: 'Read records',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
        handlers: new Map(),
      };

      registry.register(config);

      const tools = registry.getTools();
      expect(tools).toHaveLength(2);
      expect(tools.map((t) => t.name)).toEqual(['odoo_search', 'odoo_read']);
    });
  });

  describe('handler queries', () => {
    it('returns undefined for non-existent tool', () => {
      expect(registry.getHandler('nonexistent')).toBeUndefined();
    });

    it('returns handler for registered tool', () => {
      const mockHandler = async () => ({ success: true });
      const config: ModuleToolConfig = {
        moduleName: 'test',
        requiredModules: [],
        tools: [
          {
            name: 'test_tool',
            description: 'Test tool',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
        handlers: new Map([['test_tool', mockHandler]]),
      };

      registry.register(config);

      expect(registry.getHandler('test_tool')).toBe(mockHandler);
    });
  });

  describe('module queries', () => {
    it('returns registered module names', () => {
      registry.register({
        moduleName: 'sale',
        requiredModules: ['sale'],
        tools: [],
        handlers: new Map(),
      });

      registry.register({
        moduleName: 'project',
        requiredModules: ['project'],
        tools: [],
        handlers: new Map(),
      });

      const modules = registry.getRegisteredModules();
      expect(modules).toHaveLength(2);
      expect(modules).toContain('sale');
      expect(modules).toContain('project');
    });
  });

  describe('clear', () => {
    it('removes all registered modules and tools', () => {
      const config: ModuleToolConfig = {
        moduleName: 'sale',
        requiredModules: ['sale'],
        tools: [
          {
            name: 'odoo_sale_create_quotation',
            description: 'Create quotation',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
        handlers: new Map([['odoo_sale_create_quotation', async () => ({})]]),
      };

      registry.register(config);
      expect(registry.getTools()).toHaveLength(1);

      registry.clear();

      expect(registry.getTools()).toHaveLength(0);
      expect(registry.hasModule('sale')).toBe(false);
      expect(registry.getRegisteredModules()).toHaveLength(0);
    });
  });

  describe('statistics', () => {
    it('returns correct stats', () => {
      const config1: ModuleToolConfig = {
        moduleName: 'sale',
        requiredModules: ['sale'],
        tools: [
          {
            name: 'odoo_sale_create_quotation',
            description: 'Create quotation',
            inputSchema: { type: 'object', properties: {} },
          },
          {
            name: 'odoo_sale_confirm_order',
            description: 'Confirm order',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
        handlers: new Map([['odoo_sale_create_quotation', async () => ({})]]),
      };

      const config2: ModuleToolConfig = {
        moduleName: 'project',
        requiredModules: ['project'],
        tools: [
          {
            name: 'odoo_project_create_task',
            description: 'Create task',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
        handlers: new Map([['odoo_project_create_task', async () => ({})]]),
      };

      registry.register(config1);
      registry.register(config2);

      const stats = registry.getStats();
      expect(stats.moduleCount).toBe(2);
      expect(stats.toolCount).toBe(3);
      expect(stats.handlerCount).toBe(2);
    });

    it('returns zero stats for empty registry', () => {
      const stats = registry.getStats();
      expect(stats.moduleCount).toBe(0);
      expect(stats.toolCount).toBe(0);
      expect(stats.handlerCount).toBe(0);
    });
  });

  describe('notifications', () => {
    it('can set server for notifications', () => {
      const mockServer = {
        sendToolListChanged: vi.fn().mockResolvedValue(undefined),
      };

      registry.setServer(mockServer as any);

      // Should not throw
      expect(() => registry.setServer(mockServer as any)).not.toThrow();
    });

    it('sends notification when notifyToolListChanged is called', async () => {
      const mockServer = {
        sendToolListChanged: vi.fn().mockResolvedValue(undefined),
      };

      registry.setServer(mockServer as any);

      await registry.notifyToolListChanged();

      expect(mockServer.sendToolListChanged).toHaveBeenCalledTimes(1);
    });

    it('does not send notification when no server is set', async () => {
      // Should not throw when no server is configured
      await expect(registry.notifyToolListChanged()).resolves.not.toThrow();
    });
  });
});
