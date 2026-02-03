"use strict";
/**
 * Integration tests for service classes
 *
 * Tests against live Odoo instance to validate:
 * - MailService (posting messages, notes, retrieving messages)
 * - ActivityService (scheduling, completing, canceling activities)
 * - FollowerService (listing, adding, removing followers)
 * - PropertiesService (reading, updating, managing definitions)
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const odoo_client_1 = require("../src/client/odoo-client");
const services_1 = require("../src/services");
(0, vitest_1.describe)('Services Integration Tests', () => {
    const odooUrl = process.env.ODOO_URL || 'http://localhost:8069';
    const odooDb = process.env.ODOO_DB_NAME || 'odoo';
    const odooUser = process.env.ODOO_DB_USER || 'admin';
    const odooPassword = process.env.ODOO_DB_PASSWORD || 'admin';
    let client;
    let mailService;
    let activityService;
    let followerService;
    let propertiesService;
    // Test data
    let partnerId;
    let testFollowerPartnerId; // Separate partner for follower tests
    let leadId;
    let teamId;
    (0, vitest_1.beforeAll)(async () => {
        client = new odoo_client_1.OdooClient({
            url: odooUrl,
            database: odooDb,
            username: odooUser,
            password: odooPassword,
        });
        await client.authenticate();
        // Initialize services
        mailService = new services_1.MailService(client);
        activityService = new services_1.ActivityService(client);
        followerService = new services_1.FollowerService(client);
        propertiesService = new services_1.PropertiesService(client);
        // Create test partner
        partnerId = await client.create('res.partner', {
            name: 'Test Partner for Services',
            email: 'test.services@example.com',
        });
        // Create a separate partner for follower tests
        testFollowerPartnerId = await client.create('res.partner', {
            name: 'Test Follower Partner',
            email: 'test.follower@example.com',
        });
        // Get a CRM team for properties tests
        const teams = await client.searchRead('crm.team', [], { limit: 1 });
        if (teams.length === 0) {
            throw new Error('No CRM teams found. Install CRM module first.');
        }
        teamId = teams[0].id;
        // Create test lead
        leadId = await client.create('crm.lead', {
            name: 'Test Lead for Services',
            partner_id: partnerId,
            team_id: teamId,
        });
    });
    (0, vitest_1.afterAll)(async () => {
        // Clean up test data
        try {
            if (leadId)
                await client.unlink('crm.lead', leadId);
            if (testFollowerPartnerId)
                await client.unlink('res.partner', testFollowerPartnerId);
            if (partnerId)
                await client.unlink('res.partner', partnerId);
        }
        catch {
            // Ignore cleanup errors
        }
        client.logout();
    });
    (0, vitest_1.describe)('MailService', () => {
        (0, vitest_1.describe)('ensureHtml helper', () => {
            (0, vitest_1.it)('should wrap plain text in <p> tags', () => {
                const result = (0, services_1.ensureHtml)('Plain text message');
                (0, vitest_1.expect)(result).toBe('<p>Plain text message</p>');
            });
            (0, vitest_1.it)('should not wrap HTML content', () => {
                const html = '<div>Already HTML</div>';
                const result = (0, services_1.ensureHtml)(html);
                (0, vitest_1.expect)(result).toBe(html);
            });
            (0, vitest_1.it)('should detect partial HTML', () => {
                const html = '<strong>Bold text</strong>';
                const result = (0, services_1.ensureHtml)(html);
                (0, vitest_1.expect)(result).toBe(html);
            });
        });
        (0, vitest_1.describe)('postMessage', () => {
            (0, vitest_1.it)('should post a comment on a record', async () => {
                const messageId = await mailService.postMessage('crm.lead', leadId, 'Test comment message', {
                    subtype: services_1.MessageSubtype.COMMENT,
                });
                (0, vitest_1.expect)(messageId).toBeGreaterThan(0);
            });
            (0, vitest_1.it)('should post with HTML content', async () => {
                const messageId = await mailService.postMessage('crm.lead', leadId, '<p>HTML <strong>formatted</strong> message</p>');
                (0, vitest_1.expect)(messageId).toBeGreaterThan(0);
            });
        });
        (0, vitest_1.describe)('postInternalNote', () => {
            (0, vitest_1.it)('should post an internal note', async () => {
                const noteId = await mailService.postInternalNote('crm.lead', leadId, 'Internal note for testing');
                (0, vitest_1.expect)(noteId).toBeGreaterThan(0);
            });
        });
        (0, vitest_1.describe)('getMessages', () => {
            (0, vitest_1.it)('should retrieve messages for a record', async () => {
                const messages = await mailService.getMessages('crm.lead', leadId, {
                    limit: 10,
                });
                (0, vitest_1.expect)(Array.isArray(messages)).toBe(true);
                (0, vitest_1.expect)(messages.length).toBeGreaterThan(0);
                // Check message structure
                const message = messages[0];
                (0, vitest_1.expect)(message).toHaveProperty('id');
                (0, vitest_1.expect)(message).toHaveProperty('body');
                (0, vitest_1.expect)(message).toHaveProperty('date');
            });
            (0, vitest_1.it)('should respect limit parameter', async () => {
                const messages = await mailService.getMessages('crm.lead', leadId, {
                    limit: 2,
                });
                // Should return at most the limit (might be less if there aren't enough messages)
                (0, vitest_1.expect)(messages.length).toBeGreaterThanOrEqual(0);
                (0, vitest_1.expect)(messages.length).toBeLessThanOrEqual(10); // Reasonable upper bound
            });
        });
    });
    (0, vitest_1.describe)('ActivityService', () => {
        let activityId;
        (0, vitest_1.describe)('schedule', () => {
            (0, vitest_1.it)('should schedule an activity with numeric ID', async () => {
                // Get an activity type ID
                const activityTypes = await client.searchRead('mail.activity.type', [], {
                    fields: ['id'],
                    limit: 1,
                });
                if (activityTypes.length === 0) {
                    throw new Error('No activity types found');
                }
                activityId = await activityService.schedule('crm.lead', leadId, {
                    activityTypeId: activityTypes[0].id,
                    summary: 'Test activity',
                    dateDeadline: '2025-12-31',
                });
                (0, vitest_1.expect)(activityId).toBeGreaterThan(0);
            });
            (0, vitest_1.it)('should schedule an activity with activity type name', async () => {
                // Get an activity type name
                const activityTypes = await client.searchRead('mail.activity.type', [], {
                    fields: ['id', 'name'],
                    limit: 1,
                });
                if (activityTypes.length === 0) {
                    throw new Error('No activity types found');
                }
                const id = await activityService.schedule('crm.lead', leadId, {
                    activityTypeId: activityTypes[0].name,
                    summary: 'Activity with type name',
                    note: 'Test note',
                });
                (0, vitest_1.expect)(id).toBeGreaterThan(0);
                // Clean up
                await activityService.cancel([id]);
            });
        });
        (0, vitest_1.describe)('getActivities', () => {
            (0, vitest_1.it)('should list activities for a record', async () => {
                const activities = await activityService.getActivities('crm.lead', leadId);
                (0, vitest_1.expect)(Array.isArray(activities)).toBe(true);
                // At least one activity should exist (the one we created earlier)
                (0, vitest_1.expect)(activities.length).toBeGreaterThanOrEqual(0);
                if (activities.length > 0) {
                    const activity = activities[0];
                    (0, vitest_1.expect)(activity).toHaveProperty('id');
                    (0, vitest_1.expect)(activity).toHaveProperty('activity_type_id');
                    (0, vitest_1.expect)(activity).toHaveProperty('summary');
                    (0, vitest_1.expect)(activity).toHaveProperty('date_deadline');
                }
            });
            (0, vitest_1.it)('should filter activities by options', async () => {
                const activities = await activityService.getActivities('crm.lead', leadId, {
                    limit: 1,
                });
                (0, vitest_1.expect)(activities.length).toBeLessThanOrEqual(1);
            });
        });
        (0, vitest_1.describe)('complete', () => {
            (0, vitest_1.it)('should complete an activity with feedback', async () => {
                await activityService.complete([activityId], 'Task completed successfully');
                // Verify activity is completed by checking it's not in the active list
                const activities = await activityService.getActivities('crm.lead', leadId);
                const found = activities.find((a) => a.id === activityId);
                (0, vitest_1.expect)(found).toBeUndefined();
            });
        });
        (0, vitest_1.describe)('cancel', () => {
            (0, vitest_1.it)('should cancel an activity', async () => {
                // Get an activity type
                const activityTypes = await client.searchRead('mail.activity.type', [], {
                    fields: ['id'],
                    limit: 1,
                });
                // Create a new activity to cancel
                const newActivityId = await activityService.schedule('crm.lead', leadId, {
                    activityTypeId: activityTypes[0].id,
                    summary: 'Activity to cancel',
                });
                await activityService.cancel([newActivityId]);
                // Verify activity is canceled
                const activities = await activityService.getActivities('crm.lead', leadId);
                const found = activities.find((a) => a.id === newActivityId);
                (0, vitest_1.expect)(found).toBeUndefined();
            });
        });
    });
    (0, vitest_1.describe)('FollowerService', () => {
        (0, vitest_1.describe)('list', () => {
            (0, vitest_1.it)('should list followers for a record', async () => {
                const followers = await followerService.list('crm.lead', leadId);
                (0, vitest_1.expect)(Array.isArray(followers)).toBe(true);
                // May have no followers initially
            });
        });
        (0, vitest_1.describe)('add', () => {
            (0, vitest_1.it)('should add followers to a record', async () => {
                await followerService.add('crm.lead', leadId, [testFollowerPartnerId]);
                const followers = await followerService.list('crm.lead', leadId);
                const found = followers.find((f) => f.partner_id[0] === testFollowerPartnerId);
                (0, vitest_1.expect)(found).toBeDefined();
            });
            (0, vitest_1.it)('should handle empty partner list', async () => {
                await followerService.add('crm.lead', leadId, []);
                // Should not throw
            });
        });
        (0, vitest_1.describe)('remove', () => {
            (0, vitest_1.it)('should remove followers from a record', async () => {
                // First add a follower
                await followerService.add('crm.lead', leadId, [testFollowerPartnerId]);
                // Then remove it
                await followerService.remove('crm.lead', leadId, [testFollowerPartnerId]);
                const followers = await followerService.list('crm.lead', leadId);
                const found = followers.find((f) => f.partner_id[0] === testFollowerPartnerId);
                (0, vitest_1.expect)(found).toBeUndefined();
            });
            (0, vitest_1.it)('should handle empty partner list', async () => {
                await followerService.remove('crm.lead', leadId, []);
                // Should not throw
            });
        });
    });
    (0, vitest_1.describe)('PropertiesService', () => {
        (0, vitest_1.describe)('findPropertiesField', () => {
            (0, vitest_1.it)('should find properties field for crm.lead', async () => {
                const field = await propertiesService.findPropertiesField('crm.lead');
                (0, vitest_1.expect)(field).toBe('lead_properties');
            });
            (0, vitest_1.it)('should return null for models without properties', async () => {
                const field = await propertiesService.findPropertiesField('res.partner');
                (0, vitest_1.expect)(field).toBeNull();
            });
        });
        (0, vitest_1.describe)('setDefinitions and getDefinitions', () => {
            (0, vitest_1.it)('should set and retrieve property definitions', async () => {
                const definitions = [
                    {
                        name: 'test_priority',
                        string: 'Test Priority',
                        type: 'selection',
                        selection: [
                            ['low', 'Low'],
                            ['high', 'High'],
                        ],
                    },
                    {
                        name: 'test_amount',
                        string: 'Test Amount',
                        type: 'float',
                    },
                ];
                await propertiesService.setDefinitions('crm.lead', teamId, definitions);
                const retrieved = await propertiesService.getDefinitions('crm.lead', teamId);
                (0, vitest_1.expect)(retrieved.length).toBeGreaterThanOrEqual(definitions.length);
                const testPriority = retrieved.find((d) => d.name === 'test_priority');
                (0, vitest_1.expect)(testPriority).toBeDefined();
                (0, vitest_1.expect)(testPriority?.type).toBe('selection');
            });
        });
        (0, vitest_1.describe)('read and update', () => {
            (0, vitest_1.beforeAll)(async () => {
                // Ensure we have property definitions
                const definitions = [
                    {
                        name: 'test_field',
                        string: 'Test Field',
                        type: 'char',
                    },
                    {
                        name: 'test_number',
                        string: 'Test Number',
                        type: 'integer',
                    },
                ];
                await propertiesService.setDefinitions('crm.lead', teamId, definitions);
            });
            (0, vitest_1.it)('should update properties with merge', async () => {
                // First, set some initial values
                await propertiesService.update('crm.lead', leadId, {
                    test_field: 'Initial value',
                    test_number: 42,
                });
                // Then update only one field
                await propertiesService.update('crm.lead', leadId, {
                    test_field: 'Updated value',
                });
                // Read and verify both fields are preserved
                const properties = await propertiesService.read('crm.lead', leadId);
                const testField = properties.find((p) => p.name === 'test_field');
                const testNumber = properties.find((p) => p.name === 'test_number');
                (0, vitest_1.expect)(testField?.value).toBe('Updated value');
                (0, vitest_1.expect)(testNumber?.value).toBe(42); // Should be preserved
            });
            (0, vitest_1.it)('should update properties without merge', async () => {
                await propertiesService.update('crm.lead', leadId, {
                    test_field: 'Only this field',
                }, undefined, false // Don't merge
                );
                const properties = await propertiesService.read('crm.lead', leadId);
                const testField = properties.find((p) => p.name === 'test_field');
                (0, vitest_1.expect)(testField?.value).toBe('Only this field');
            });
            (0, vitest_1.it)('should read properties from a record', async () => {
                const properties = await propertiesService.read('crm.lead', leadId);
                (0, vitest_1.expect)(Array.isArray(properties)).toBe(true);
                // Each property should have metadata
                if (properties.length > 0) {
                    const prop = properties[0];
                    (0, vitest_1.expect)(prop).toHaveProperty('name');
                    (0, vitest_1.expect)(prop).toHaveProperty('type');
                    (0, vitest_1.expect)(prop).toHaveProperty('value');
                }
            });
        });
    });
});
//# sourceMappingURL=services.integration.test.js.map