"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const odoo_client_1 = require("../src/client/odoo-client");
const properties_1 = require("../src/types/properties");
(0, vitest_1.describe)('Properties Fields Integration', () => {
    const odooUrl = process.env.ODOO_URL || 'http://localhost:8069';
    const odooDb = process.env.ODOO_DB_NAME || 'odoo';
    const odooUser = process.env.ODOO_DB_USER || 'admin';
    const odooPassword = process.env.ODOO_DB_PASSWORD || 'admin';
    let client;
    let teamId;
    let leadId;
    (0, vitest_1.beforeAll)(async () => {
        client = new odoo_client_1.OdooClient({
            url: odooUrl,
            database: odooDb,
            username: odooUser,
            password: odooPassword,
        });
        await client.authenticate();
        // Get or create a CRM team
        const teams = await client.searchRead('crm.team', [], { limit: 1 });
        if (teams.length === 0) {
            throw new Error('No CRM teams found. Install CRM module first.');
        }
        teamId = teams[0].id;
    });
    (0, vitest_1.afterAll)(async () => {
        // Clean up test lead if created
        if (leadId) {
            try {
                await client.unlink('crm.lead', leadId);
            }
            catch {
                // Ignore cleanup errors
            }
        }
        client.logout();
    });
    (0, vitest_1.describe)('PropertiesDefinition', () => {
        (0, vitest_1.it)('should create and read property definitions', async () => {
            const propertiesDefinition = [
                {
                    name: 'test_char',
                    string: 'Test Character Field',
                    type: 'char',
                },
                {
                    name: 'test_integer',
                    string: 'Test Integer',
                    type: 'integer',
                },
                {
                    name: 'test_boolean',
                    string: 'Test Boolean',
                    type: 'boolean',
                },
                {
                    name: 'test_selection',
                    string: 'Test Selection',
                    type: 'selection',
                    selection: [
                        ['opt1', 'Option 1'],
                        ['opt2', 'Option 2'],
                    ],
                },
            ];
            // Write definitions
            await client.write('crm.team', teamId, {
                lead_properties_definition: propertiesDefinition,
            });
            // Read back
            const team = await client.read('crm.team', teamId, ['lead_properties_definition']);
            (0, vitest_1.expect)(team[0].lead_properties_definition).toBeDefined();
            (0, vitest_1.expect)(Array.isArray(team[0].lead_properties_definition)).toBe(true);
            (0, vitest_1.expect)(team[0].lead_properties_definition.length).toBe(4);
            const charDef = team[0].lead_properties_definition.find((d) => d.name === 'test_char');
            (0, vitest_1.expect)(charDef).toBeDefined();
            (0, vitest_1.expect)(charDef.type).toBe('char');
            (0, vitest_1.expect)(charDef.string).toBe('Test Character Field');
        });
    });
    (0, vitest_1.describe)('Properties values', () => {
        (0, vitest_1.it)('should create a record with properties', async () => {
            const leadProperties = {
                test_char: 'Hello Properties',
                test_integer: 42,
                test_boolean: true,
                test_selection: 'opt1',
            };
            leadId = await client.create('crm.lead', {
                name: 'Test Lead for Properties',
                team_id: teamId,
                lead_properties: leadProperties,
            });
            (0, vitest_1.expect)(leadId).toBeGreaterThan(0);
            // Read back
            const lead = await client.read('crm.lead', leadId, ['lead_properties']);
            (0, vitest_1.expect)(lead[0].lead_properties).toBeDefined();
            (0, vitest_1.expect)(Array.isArray(lead[0].lead_properties)).toBe(true);
            (0, vitest_1.expect)(lead[0].lead_properties.length).toBe(4);
        });
        (0, vitest_1.it)('should update properties', async () => {
            const updatedProperties = {
                test_char: 'Updated Text',
                test_integer: 100,
                test_boolean: false,
                test_selection: 'opt2',
            };
            await client.write('crm.lead', leadId, {
                lead_properties: updatedProperties,
            });
            const lead = await client.read('crm.lead', leadId, ['lead_properties']);
            const charValue = (0, properties_1.getPropertyValue)(lead[0].lead_properties, 'test_char');
            const intValue = (0, properties_1.getPropertyValue)(lead[0].lead_properties, 'test_integer');
            const boolValue = (0, properties_1.getPropertyValue)(lead[0].lead_properties, 'test_boolean');
            const selValue = (0, properties_1.getPropertyValue)(lead[0].lead_properties, 'test_selection');
            (0, vitest_1.expect)(charValue).toBe('Updated Text');
            (0, vitest_1.expect)(intValue).toBe(100);
            (0, vitest_1.expect)(boolValue).toBe(false);
            (0, vitest_1.expect)(selValue).toBe('opt2');
        });
        (0, vitest_1.it)('should handle partial updates (replaces unspecified with false)', async () => {
            // IMPORTANT: Odoo's behavior is to replace unspecified properties with false
            // To update only some properties, you must read first, modify, then write all
            const lead = await client.read('crm.lead', leadId, ['lead_properties']);
            const currentProps = (0, properties_1.propertiesToWriteFormat)(lead[0].lead_properties);
            // Modify only what we want to change
            currentProps.test_integer = 999;
            await client.write('crm.lead', leadId, {
                lead_properties: currentProps,
            });
            const updatedLead = await client.read('crm.lead', leadId, ['lead_properties']);
            const intValue = (0, properties_1.getPropertyValue)(updatedLead[0].lead_properties, 'test_integer');
            const charValue = (0, properties_1.getPropertyValue)(updatedLead[0].lead_properties, 'test_char');
            (0, vitest_1.expect)(intValue).toBe(999);
            (0, vitest_1.expect)(charValue).toBe('Updated Text'); // Preserved because we wrote all properties
        });
    });
    (0, vitest_1.describe)('Helper functions', () => {
        (0, vitest_1.it)('should extract property value by name', async () => {
            // First ensure we have known properties
            const knownProps = {
                test_char: 'Known Value',
                test_integer: 123,
                test_boolean: true,
                test_selection: 'opt1',
            };
            await client.write('crm.lead', leadId, {
                lead_properties: knownProps,
            });
            const lead = await client.read('crm.lead', leadId, ['lead_properties']);
            const value = (0, properties_1.getPropertyValue)(lead[0].lead_properties, 'test_char');
            (0, vitest_1.expect)(value).toBe('Known Value');
            const nonExistent = (0, properties_1.getPropertyValue)(lead[0].lead_properties, 'non_existent');
            (0, vitest_1.expect)(nonExistent).toBeUndefined();
        });
        (0, vitest_1.it)('should convert properties to write format', async () => {
            const lead = await client.read('crm.lead', leadId, ['lead_properties']);
            const writeFormat = (0, properties_1.propertiesToWriteFormat)(lead[0].lead_properties);
            (0, vitest_1.expect)(writeFormat).toEqual({
                test_char: 'Known Value',
                test_integer: 123,
                test_boolean: true,
                test_selection: 'opt1',
            });
        });
        (0, vitest_1.it)('should get property definition by name', async () => {
            const team = await client.read('crm.team', teamId, ['lead_properties_definition']);
            const charDef = (0, properties_1.getPropertyDefinition)(team[0].lead_properties_definition, 'test_char');
            (0, vitest_1.expect)(charDef).toBeDefined();
            (0, vitest_1.expect)(charDef?.type).toBe('char');
            (0, vitest_1.expect)(charDef?.string).toBe('Test Character Field');
            const nonExistent = (0, properties_1.getPropertyDefinition)(team[0].lead_properties_definition, 'non_existent');
            (0, vitest_1.expect)(nonExistent).toBeUndefined();
        });
    });
    (0, vitest_1.describe)('Property type support', () => {
        (0, vitest_1.it)('should support float properties', async () => {
            const definitions = [
                {
                    name: 'test_float',
                    string: 'Test Float',
                    type: 'float',
                },
            ];
            await client.write('crm.team', teamId, {
                lead_properties_definition: definitions,
            });
            await client.write('crm.lead', leadId, {
                lead_properties: { test_float: 3.14159 },
            });
            const lead = await client.read('crm.lead', leadId, ['lead_properties']);
            const floatValue = (0, properties_1.getPropertyValue)(lead[0].lead_properties, 'test_float');
            (0, vitest_1.expect)(floatValue).toBeCloseTo(3.14159, 5);
        });
        (0, vitest_1.it)('should support date properties', async () => {
            const definitions = [
                {
                    name: 'test_date',
                    string: 'Test Date',
                    type: 'date',
                },
            ];
            await client.write('crm.team', teamId, {
                lead_properties_definition: definitions,
            });
            await client.write('crm.lead', leadId, {
                lead_properties: { test_date: '2024-01-15' },
            });
            const lead = await client.read('crm.lead', leadId, ['lead_properties']);
            const dateValue = (0, properties_1.getPropertyValue)(lead[0].lead_properties, 'test_date');
            (0, vitest_1.expect)(dateValue).toBe('2024-01-15');
        });
        (0, vitest_1.it)('should support datetime properties', async () => {
            const definitions = [
                {
                    name: 'test_datetime',
                    string: 'Test DateTime',
                    type: 'datetime',
                },
            ];
            await client.write('crm.team', teamId, {
                lead_properties_definition: definitions,
            });
            const testDateTime = '2024-01-15 10:30:00';
            await client.write('crm.lead', leadId, {
                lead_properties: { test_datetime: testDateTime },
            });
            const lead = await client.read('crm.lead', leadId, ['lead_properties']);
            const datetimeValue = (0, properties_1.getPropertyValue)(lead[0].lead_properties, 'test_datetime');
            (0, vitest_1.expect)(datetimeValue).toBe(testDateTime);
        });
    });
});
//# sourceMappingURL=properties.integration.test.js.map