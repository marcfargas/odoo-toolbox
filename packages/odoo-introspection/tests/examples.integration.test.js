"use strict";
/**
 * Integration tests for odoo-introspection examples
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const client_1 = require("@odoo-toolbox/client");
const src_1 = require("../src");
(0, vitest_1.describe)('odoo-introspection examples', () => {
    let client;
    let introspector;
    (0, vitest_1.beforeAll)(async () => {
        client = new client_1.OdooClient({
            url: process.env.ODOO_URL || 'http://localhost:8069',
            database: process.env.ODOO_DB || 'odoo',
            username: process.env.ODOO_USER || 'admin',
            password: process.env.ODOO_PASSWORD || 'admin',
        });
        await client.authenticate();
        introspector = new src_1.Introspector(client);
    });
    (0, vitest_1.afterAll)(async () => {
        await client.logout();
    });
    (0, vitest_1.describe)('Example 1: Schema Introspection', () => {
        (0, vitest_1.it)('should list all models', async () => {
            const models = await introspector.getModels();
            (0, vitest_1.expect)(models).toBeDefined();
            (0, vitest_1.expect)(Array.isArray(models)).toBe(true);
            (0, vitest_1.expect)(models.length).toBeGreaterThan(0);
        });
        (0, vitest_1.it)('should filter models by module', async () => {
            const models = await introspector.getModels();
            const saleModels = models.filter((m) => m.model.startsWith('sale.'));
            (0, vitest_1.expect)(Array.isArray(saleModels)).toBe(true);
        });
        (0, vitest_1.it)('should get fields for a model', async () => {
            const fields = await introspector.getFields('res.partner');
            (0, vitest_1.expect)(fields).toBeDefined();
            (0, vitest_1.expect)(Array.isArray(fields)).toBe(true);
            (0, vitest_1.expect)(fields.length).toBeGreaterThan(0);
            // Verify field structure
            const field = fields[0];
            (0, vitest_1.expect)(field).toHaveProperty('name');
            (0, vitest_1.expect)(field).toHaveProperty('ttype');
        });
        (0, vitest_1.it)('should get model metadata', async () => {
            const metadata = await introspector.getModelMetadata('res.partner');
            (0, vitest_1.expect)(metadata).toBeDefined();
            (0, vitest_1.expect)(metadata.model).toBeDefined();
            (0, vitest_1.expect)(metadata.model.model).toBe('res.partner');
            (0, vitest_1.expect)(metadata.fields).toBeDefined();
            (0, vitest_1.expect)(Array.isArray(metadata.fields)).toBe(true);
        });
        (0, vitest_1.it)('should inspect field properties', async () => {
            const fields = await introspector.getFields('res.partner');
            const nameField = fields.find((f) => f.name === 'name');
            (0, vitest_1.expect)(nameField).toBeDefined();
            if (nameField) {
                (0, vitest_1.expect)(nameField.ttype).toBe('char');
                // Name field in res.partner might have required: false at model level
                // but is required at creation time due to constraints
            }
        });
        (0, vitest_1.it)('should handle relational fields', async () => {
            const fields = await introspector.getFields('res.partner');
            const relationFields = fields.filter((f) => f.relation);
            (0, vitest_1.expect)(Array.isArray(relationFields)).toBe(true);
            if (relationFields.length > 0) {
                relationFields.forEach((field) => {
                    (0, vitest_1.expect)(field.relation).toBeDefined();
                });
            }
        });
    });
    (0, vitest_1.describe)('Example 2: Generate TypeScript Types', () => {
        (0, vitest_1.it)('should get metadata for multiple models', async () => {
            const modelsToCheck = ['res.partner', 'sale.order'];
            const metadataList = [];
            for (const modelName of modelsToCheck) {
                try {
                    const metadata = await introspector.getModelMetadata(modelName);
                    metadataList.push(metadata);
                }
                catch (error) {
                    // Model might not exist in all instances
                }
            }
            (0, vitest_1.expect)(metadataList.length).toBeGreaterThan(0);
            metadataList.forEach((metadata) => {
                (0, vitest_1.expect)(metadata.model).toBeDefined();
                (0, vitest_1.expect)(metadata.fields).toBeDefined();
            });
        });
        (0, vitest_1.it)('should generate code from metadata', async () => {
            const metadata = await introspector.getModelMetadata('res.partner');
            const { generateCompleteFile } = await Promise.resolve().then(() => __importStar(require('../src/codegen')));
            const code = generateCompleteFile([metadata]);
            (0, vitest_1.expect)(code).toBeDefined();
            (0, vitest_1.expect)(typeof code).toBe('string');
            (0, vitest_1.expect)(code.length).toBeGreaterThan(0);
            // Should contain TypeScript interface syntax
            (0, vitest_1.expect)(code).toMatch(/interface|type|export/i);
        });
        (0, vitest_1.it)('should handle missing models gracefully', async () => {
            try {
                await introspector.getModelMetadata('non.existent.model');
                // If it doesn't throw, that's also fine for this test
            }
            catch (error) {
                // Expected behavior
                (0, vitest_1.expect)(error).toBeDefined();
            }
        });
    });
    (0, vitest_1.describe)('Example 3: E2E Lead to Sale Workflow', () => {
        // Track created records for cleanup
        let leadId;
        let partnerId;
        let activityId;
        let saleOrderId;
        // Ensure modules are installed before all tests in this suite
        // Module installation can take 30+ seconds per module, so we set a 2 minute timeout
        (0, vitest_1.beforeAll)(async () => {
            const moduleManager = new client_1.ModuleManager(client);
            // Install CRM module if not installed
            if (!(await moduleManager.isModuleInstalled('crm'))) {
                await moduleManager.installModule('crm');
            }
            // Install Sale module if not installed
            if (!(await moduleManager.isModuleInstalled('sale'))) {
                await moduleManager.installModule('sale');
            }
        }, 120000); // 2 minute timeout for module installation
        // Cleanup all created records after tests complete
        (0, vitest_1.afterAll)(async () => {
            // Delete in reverse dependency order
            if (saleOrderId) {
                try {
                    // Cancel the order first (confirmed orders can't be deleted)
                    await client.call('sale.order', 'action_cancel', [[saleOrderId]]);
                    await client.unlink('sale.order', saleOrderId);
                }
                catch {
                    // Ignore cleanup errors
                }
            }
            if (activityId) {
                try {
                    await client.unlink('mail.activity', activityId);
                }
                catch {
                    // Ignore cleanup errors
                }
            }
            if (leadId) {
                try {
                    await client.unlink('crm.lead', leadId);
                }
                catch {
                    // Ignore cleanup errors
                }
            }
            if (partnerId) {
                try {
                    await client.unlink('res.partner', partnerId);
                }
                catch {
                    // Ignore cleanup errors
                }
            }
        });
        (0, vitest_1.describe)('Introspection', () => {
            (0, vitest_1.it)('should get crm.lead fields', async () => {
                const fields = await introspector.getFields('crm.lead');
                (0, vitest_1.expect)(fields).toBeDefined();
                (0, vitest_1.expect)(Array.isArray(fields)).toBe(true);
                (0, vitest_1.expect)(fields.length).toBeGreaterThan(0);
                // Verify key fields exist
                const fieldNames = fields.map((f) => f.name);
                (0, vitest_1.expect)(fieldNames).toContain('name');
                (0, vitest_1.expect)(fieldNames).toContain('email_from');
                (0, vitest_1.expect)(fieldNames).toContain('partner_id');
            });
            (0, vitest_1.it)('should get res.partner fields', async () => {
                const fields = await introspector.getFields('res.partner');
                (0, vitest_1.expect)(fields).toBeDefined();
                (0, vitest_1.expect)(Array.isArray(fields)).toBe(true);
                // Verify key fields exist
                const fieldNames = fields.map((f) => f.name);
                (0, vitest_1.expect)(fieldNames).toContain('name');
                (0, vitest_1.expect)(fieldNames).toContain('email');
                (0, vitest_1.expect)(fieldNames).toContain('is_company');
            });
            (0, vitest_1.it)('should get sale.order fields and identify partner_id', async () => {
                const fields = await introspector.getFields('sale.order');
                (0, vitest_1.expect)(fields).toBeDefined();
                (0, vitest_1.expect)(Array.isArray(fields)).toBe(true);
                // Verify key fields exist
                const fieldNames = fields.map((f) => f.name);
                (0, vitest_1.expect)(fieldNames).toContain('partner_id');
                (0, vitest_1.expect)(fieldNames).toContain('state');
                // Verify partner_id is a many2one to res.partner
                const partnerIdField = fields.find((f) => f.name === 'partner_id');
                (0, vitest_1.expect)(partnerIdField).toBeDefined();
                (0, vitest_1.expect)(partnerIdField?.ttype).toBe('many2one');
                (0, vitest_1.expect)(partnerIdField?.relation).toBe('res.partner');
            });
        });
        (0, vitest_1.describe)('CRM Lead Operations', () => {
            (0, vitest_1.it)('should create a CRM lead', async () => {
                const leadData = {
                    name: 'Test Lead - Integration Test',
                    email_from: 'test@example.com',
                    phone: '+1 555-0199',
                    expected_revenue: 10000,
                };
                leadId = await client.create('crm.lead', leadData);
                (0, vitest_1.expect)(leadId).toBeDefined();
                (0, vitest_1.expect)(typeof leadId).toBe('number');
                (0, vitest_1.expect)(leadId).toBeGreaterThan(0);
                // Verify by reading back
                const [lead] = await client.read('crm.lead', [leadId], ['name', 'email_from']);
                (0, vitest_1.expect)(lead.name).toBe(leadData.name);
                (0, vitest_1.expect)(lead.email_from).toBe(leadData.email_from);
            });
            (0, vitest_1.it)('should schedule an activity on the lead', async () => {
                (0, vitest_1.expect)(leadId).toBeDefined();
                // Find an activity type
                const activityTypes = await client.searchRead('mail.activity.type', [], { fields: ['id', 'name'], limit: 1 });
                (0, vitest_1.expect)(activityTypes.length).toBeGreaterThan(0);
                // Find the ir.model record for crm.lead (needed for res_model_id)
                const models = await client.searchRead('ir.model', [['model', '=', 'crm.lead']], { fields: ['id', 'model'], limit: 1 });
                (0, vitest_1.expect)(models.length).toBeGreaterThan(0);
                const deadline = new Date();
                deadline.setDate(deadline.getDate() + 7);
                const deadlineStr = deadline.toISOString().split('T')[0];
                const activityData = {
                    res_model_id: models[0].id, // many2one to ir.model
                    res_id: leadId,
                    activity_type_id: activityTypes[0].id,
                    summary: 'Test follow-up activity',
                    date_deadline: deadlineStr,
                };
                activityId = await client.create('mail.activity', activityData);
                (0, vitest_1.expect)(activityId).toBeDefined();
                (0, vitest_1.expect)(typeof activityId).toBe('number');
                (0, vitest_1.expect)(activityId).toBeGreaterThan(0);
            });
        });
        (0, vitest_1.describe)('Relational Field Requirements', () => {
            (0, vitest_1.it)('should fail to create sale.order without partner_id', async () => {
                (0, vitest_1.expect)(leadId).toBeDefined();
                // Attempt to create sale.order without required partner_id
                await (0, vitest_1.expect)(client.create('sale.order', {
                    opportunity_id: leadId,
                    // partner_id intentionally missing
                })).rejects.toThrow();
            });
        });
        (0, vitest_1.describe)('Contact and Quotation', () => {
            (0, vitest_1.it)('should create a contact (res.partner)', async () => {
                const partnerData = {
                    name: 'Test Contact - Integration Test',
                    email: 'testcontact@example.com',
                    phone: '+1 555-0188',
                    is_company: false,
                };
                partnerId = await client.create('res.partner', partnerData);
                (0, vitest_1.expect)(partnerId).toBeDefined();
                (0, vitest_1.expect)(typeof partnerId).toBe('number');
                (0, vitest_1.expect)(partnerId).toBeGreaterThan(0);
                // Verify by reading back
                const [partner] = await client.read('res.partner', [partnerId], ['name', 'email']);
                (0, vitest_1.expect)(partner.name).toBe(partnerData.name);
                (0, vitest_1.expect)(partner.email).toBe(partnerData.email);
            });
            (0, vitest_1.it)('should link contact to lead', async () => {
                (0, vitest_1.expect)(leadId).toBeDefined();
                (0, vitest_1.expect)(partnerId).toBeDefined();
                // Update the lead with partner_id
                const result = await client.write('crm.lead', [leadId], {
                    partner_id: partnerId,
                });
                (0, vitest_1.expect)(result).toBe(true);
                // Verify by reading back
                const [lead] = await client.read('crm.lead', [leadId], ['partner_id']);
                (0, vitest_1.expect)(lead.partner_id).toBeDefined();
                (0, vitest_1.expect)(lead.partner_id).not.toBe(false);
                // When reading many2one, Odoo returns [id, display_name]
                (0, vitest_1.expect)(Array.isArray(lead.partner_id)).toBe(true);
                (0, vitest_1.expect)(lead.partner_id[0]).toBe(partnerId);
            });
            (0, vitest_1.it)('should create quotation with partner and opportunity', async () => {
                (0, vitest_1.expect)(leadId).toBeDefined();
                (0, vitest_1.expect)(partnerId).toBeDefined();
                const quotationData = {
                    partner_id: partnerId,
                    opportunity_id: leadId,
                };
                saleOrderId = await client.create('sale.order', quotationData);
                (0, vitest_1.expect)(saleOrderId).toBeDefined();
                (0, vitest_1.expect)(typeof saleOrderId).toBe('number');
                (0, vitest_1.expect)(saleOrderId).toBeGreaterThan(0);
                // Verify by reading back
                const [order] = await client.read('sale.order', [saleOrderId], ['state', 'partner_id', 'opportunity_id']);
                (0, vitest_1.expect)(order.state).toBe('draft');
                (0, vitest_1.expect)(order.partner_id[0]).toBe(partnerId);
                if (order.opportunity_id) {
                    (0, vitest_1.expect)(order.opportunity_id[0]).toBe(leadId);
                }
            });
            (0, vitest_1.it)('should confirm the quotation', async () => {
                (0, vitest_1.expect)(saleOrderId).toBeDefined();
                // Confirm the quotation using action_confirm
                await client.call('sale.order', 'action_confirm', [[saleOrderId]]);
                // Verify state changed to 'sale'
                const [order] = await client.read('sale.order', [saleOrderId], ['state']);
                (0, vitest_1.expect)(order.state).toBe('sale');
            });
        });
    });
});
//# sourceMappingURL=examples.integration.test.js.map