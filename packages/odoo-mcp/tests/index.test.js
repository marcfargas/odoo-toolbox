"use strict";
/**
 * Basic export verification test.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const index_1 = require("../src/index");
(0, vitest_1.describe)('@odoo-toolbox/mcp exports', () => {
    (0, vitest_1.it)('exports createOdooMcpServer function', () => {
        (0, vitest_1.expect)(typeof index_1.createOdooMcpServer).toBe('function');
    });
    (0, vitest_1.it)('exports startServer function', () => {
        (0, vitest_1.expect)(typeof index_1.startServer).toBe('function');
    });
    (0, vitest_1.it)('exports SessionManager class', () => {
        (0, vitest_1.expect)(typeof index_1.SessionManager).toBe('function');
        (0, vitest_1.expect)(new index_1.SessionManager()).toBeInstanceOf(index_1.SessionManager);
    });
    (0, vitest_1.it)('exports all tool definitions', () => {
        (0, vitest_1.expect)(Array.isArray(index_1.allToolDefinitions)).toBe(true);
        (0, vitest_1.expect)(index_1.allToolDefinitions.length).toBeGreaterThan(0);
        // Check that all tools have required properties
        for (const tool of index_1.allToolDefinitions) {
            (0, vitest_1.expect)(tool).toHaveProperty('name');
            (0, vitest_1.expect)(tool).toHaveProperty('description');
            (0, vitest_1.expect)(tool).toHaveProperty('inputSchema');
        }
    });
    (0, vitest_1.it)('exports formatError function', () => {
        (0, vitest_1.expect)(typeof index_1.formatError).toBe('function');
        // Test that it formats errors correctly
        const result = (0, index_1.formatError)(new Error('test error'));
        (0, vitest_1.expect)(result.success).toBe(false);
        (0, vitest_1.expect)(result.error.message).toBe('test error');
    });
    (0, vitest_1.it)('has expected number of tools', () => {
        // 3 connection + 7 CRUD + 5 module + 4 introspection + 10 mail + 5 properties = 34 tools
        (0, vitest_1.expect)(index_1.allToolDefinitions.length).toBe(34);
    });
    (0, vitest_1.it)('includes all expected tool names', () => {
        const toolNames = index_1.allToolDefinitions.map((t) => t.name);
        // Connection tools
        (0, vitest_1.expect)(toolNames).toContain('odoo_authenticate');
        (0, vitest_1.expect)(toolNames).toContain('odoo_logout');
        (0, vitest_1.expect)(toolNames).toContain('odoo_connection_status');
        // CRUD tools
        (0, vitest_1.expect)(toolNames).toContain('odoo_search');
        (0, vitest_1.expect)(toolNames).toContain('odoo_read');
        (0, vitest_1.expect)(toolNames).toContain('odoo_search_read');
        (0, vitest_1.expect)(toolNames).toContain('odoo_create');
        (0, vitest_1.expect)(toolNames).toContain('odoo_write');
        (0, vitest_1.expect)(toolNames).toContain('odoo_unlink');
        (0, vitest_1.expect)(toolNames).toContain('odoo_call');
        // Module tools
        (0, vitest_1.expect)(toolNames).toContain('odoo_module_install');
        (0, vitest_1.expect)(toolNames).toContain('odoo_module_uninstall');
        (0, vitest_1.expect)(toolNames).toContain('odoo_module_upgrade');
        (0, vitest_1.expect)(toolNames).toContain('odoo_module_list');
        (0, vitest_1.expect)(toolNames).toContain('odoo_module_info');
        // Introspection tools
        (0, vitest_1.expect)(toolNames).toContain('odoo_get_models');
        (0, vitest_1.expect)(toolNames).toContain('odoo_get_fields');
        (0, vitest_1.expect)(toolNames).toContain('odoo_get_model_metadata');
        (0, vitest_1.expect)(toolNames).toContain('odoo_generate_types');
        // Mail tools
        (0, vitest_1.expect)(toolNames).toContain('odoo_post_internal_note');
        (0, vitest_1.expect)(toolNames).toContain('odoo_post_public_message');
        (0, vitest_1.expect)(toolNames).toContain('odoo_get_messages');
        (0, vitest_1.expect)(toolNames).toContain('odoo_manage_followers');
        (0, vitest_1.expect)(toolNames).toContain('odoo_add_attachment');
        (0, vitest_1.expect)(toolNames).toContain('odoo_schedule_activity');
        (0, vitest_1.expect)(toolNames).toContain('odoo_complete_activity');
        (0, vitest_1.expect)(toolNames).toContain('odoo_get_activities');
        (0, vitest_1.expect)(toolNames).toContain('odoo_channel_message');
        (0, vitest_1.expect)(toolNames).toContain('odoo_list_channels');
        // Properties tools
        (0, vitest_1.expect)(toolNames).toContain('odoo_read_properties');
        (0, vitest_1.expect)(toolNames).toContain('odoo_update_properties');
        (0, vitest_1.expect)(toolNames).toContain('odoo_find_properties_field');
        (0, vitest_1.expect)(toolNames).toContain('odoo_get_property_definitions');
        (0, vitest_1.expect)(toolNames).toContain('odoo_set_property_definitions');
    });
});
//# sourceMappingURL=index.test.js.map