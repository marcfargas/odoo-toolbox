/**
 * Basic export verification test.
 */

import { describe, it, expect } from 'vitest';
import {
  createOdooMcpServer,
  startServer,
  SessionManager,
  allToolDefinitions,
  formatError,
} from '../src/index';

describe('@odoo-toolbox/mcp exports', () => {
  it('exports createOdooMcpServer function', () => {
    expect(typeof createOdooMcpServer).toBe('function');
  });

  it('exports startServer function', () => {
    expect(typeof startServer).toBe('function');
  });

  it('exports SessionManager class', () => {
    expect(typeof SessionManager).toBe('function');
    expect(new SessionManager()).toBeInstanceOf(SessionManager);
  });

  it('exports all tool definitions', () => {
    expect(Array.isArray(allToolDefinitions)).toBe(true);
    expect(allToolDefinitions.length).toBeGreaterThan(0);

    // Check that all tools have required properties
    for (const tool of allToolDefinitions) {
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('inputSchema');
    }
  });

  it('exports formatError function', () => {
    expect(typeof formatError).toBe('function');

    // Test that it formats errors correctly
    const result = formatError(new Error('test error'));
    expect(result.success).toBe(false);
    expect(result.error.message).toBe('test error');
  });

  it('has expected number of tools', () => {
    // 3 connection + 7 CRUD + 5 module + 4 introspection = 19 tools
    expect(allToolDefinitions.length).toBe(19);
  });

  it('includes all expected tool names', () => {
    const toolNames = allToolDefinitions.map((t) => t.name);

    // Connection tools
    expect(toolNames).toContain('odoo_authenticate');
    expect(toolNames).toContain('odoo_logout');
    expect(toolNames).toContain('odoo_connection_status');

    // CRUD tools
    expect(toolNames).toContain('odoo_search');
    expect(toolNames).toContain('odoo_read');
    expect(toolNames).toContain('odoo_search_read');
    expect(toolNames).toContain('odoo_create');
    expect(toolNames).toContain('odoo_write');
    expect(toolNames).toContain('odoo_unlink');
    expect(toolNames).toContain('odoo_call');

    // Module tools
    expect(toolNames).toContain('odoo_module_install');
    expect(toolNames).toContain('odoo_module_uninstall');
    expect(toolNames).toContain('odoo_module_upgrade');
    expect(toolNames).toContain('odoo_module_list');
    expect(toolNames).toContain('odoo_module_info');

    // Introspection tools
    expect(toolNames).toContain('odoo_get_models');
    expect(toolNames).toContain('odoo_get_fields');
    expect(toolNames).toContain('odoo_get_model_metadata');
    expect(toolNames).toContain('odoo_generate_types');
  });
});
