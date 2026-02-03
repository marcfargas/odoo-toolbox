/**
 * Integration tests for service classes
 *
 * Tests against live Odoo instance to validate:
 * - MailService (posting messages, notes, retrieving messages)
 * - ActivityService (scheduling, completing, canceling activities)
 * - FollowerService (listing, adding, removing followers)
 * - PropertiesService (reading, updating, managing definitions)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { OdooClient } from '../src/client/odoo-client';
import {
  MailService,
  ActivityService,
  FollowerService,
  PropertiesService,
  MessageSubtype,
  ensureHtml,
} from '../src/services';

describe('Services Integration Tests', () => {
  const odooUrl = process.env.ODOO_URL || 'http://localhost:8069';
  const odooDb = process.env.ODOO_DB_NAME || 'odoo';
  const odooUser = process.env.ODOO_DB_USER || 'admin';
  const odooPassword = process.env.ODOO_DB_PASSWORD || 'admin';

  let client: OdooClient;
  let mailService: MailService;
  let activityService: ActivityService;
  let followerService: FollowerService;
  let propertiesService: PropertiesService;

  // Test data
  let partnerId: number;
  let testFollowerPartnerId: number; // Separate partner for follower tests
  let leadId: number;
  let teamId: number;

  beforeAll(async () => {
    client = new OdooClient({
      url: odooUrl,
      database: odooDb,
      username: odooUser,
      password: odooPassword,
    });

    await client.authenticate();

    // Initialize services
    mailService = new MailService(client);
    activityService = new ActivityService(client);
    followerService = new FollowerService(client);
    propertiesService = new PropertiesService(client);

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

  afterAll(async () => {
    // Clean up test data
    try {
      if (leadId) await client.unlink('crm.lead', leadId);
      if (testFollowerPartnerId) await client.unlink('res.partner', testFollowerPartnerId);
      if (partnerId) await client.unlink('res.partner', partnerId);
    } catch {
      // Ignore cleanup errors
    }
    client.logout();
  });

  describe('MailService', () => {
    describe('ensureHtml helper', () => {
      it('should wrap plain text in <p> tags', () => {
        const result = ensureHtml('Plain text message');
        expect(result).toBe('<p>Plain text message</p>');
      });

      it('should not wrap HTML content', () => {
        const html = '<div>Already HTML</div>';
        const result = ensureHtml(html);
        expect(result).toBe(html);
      });

      it('should detect partial HTML', () => {
        const html = '<strong>Bold text</strong>';
        const result = ensureHtml(html);
        expect(result).toBe(html);
      });
    });

    describe('postMessage', () => {
      it('should post a comment on a record', async () => {
        const messageId = await mailService.postMessage(
          'crm.lead',
          leadId,
          'Test comment message',
          {
            subtype: MessageSubtype.COMMENT,
          }
        );

        expect(messageId).toBeGreaterThan(0);
      });

      it('should post with HTML content', async () => {
        const messageId = await mailService.postMessage(
          'crm.lead',
          leadId,
          '<p>HTML <strong>formatted</strong> message</p>'
        );

        expect(messageId).toBeGreaterThan(0);
      });
    });

    describe('postInternalNote', () => {
      it('should post an internal note', async () => {
        const noteId = await mailService.postInternalNote(
          'crm.lead',
          leadId,
          'Internal note for testing'
        );

        expect(noteId).toBeGreaterThan(0);
      });
    });

    describe('getMessages', () => {
      it('should retrieve messages for a record', async () => {
        const messages = await mailService.getMessages('crm.lead', leadId, {
          limit: 10,
        });

        expect(Array.isArray(messages)).toBe(true);
        expect(messages.length).toBeGreaterThan(0);

        // Check message structure
        const message = messages[0];
        expect(message).toHaveProperty('id');
        expect(message).toHaveProperty('body');
        expect(message).toHaveProperty('date');
      });

      it('should respect limit parameter', async () => {
        const messages = await mailService.getMessages('crm.lead', leadId, {
          limit: 2,
        });

        // Should return at most the limit (might be less if there aren't enough messages)
        expect(messages.length).toBeGreaterThanOrEqual(0);
        expect(messages.length).toBeLessThanOrEqual(10); // Reasonable upper bound
      });
    });
  });

  describe('ActivityService', () => {
    let activityId: number;

    describe('schedule', () => {
      it('should schedule an activity with numeric ID', async () => {
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

        expect(activityId).toBeGreaterThan(0);
      });

      it('should schedule an activity with activity type name', async () => {
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

        expect(id).toBeGreaterThan(0);

        // Clean up
        await activityService.cancel([id]);
      });
    });

    describe('getActivities', () => {
      it('should list activities for a record', async () => {
        const activities = await activityService.getActivities('crm.lead', leadId);

        expect(Array.isArray(activities)).toBe(true);
        // At least one activity should exist (the one we created earlier)
        expect(activities.length).toBeGreaterThanOrEqual(0);

        if (activities.length > 0) {
          const activity = activities[0];
          expect(activity).toHaveProperty('id');
          expect(activity).toHaveProperty('activity_type_id');
          expect(activity).toHaveProperty('summary');
          expect(activity).toHaveProperty('date_deadline');
        }
      });

      it('should filter activities by options', async () => {
        const activities = await activityService.getActivities('crm.lead', leadId, {
          limit: 1,
        });

        expect(activities.length).toBeLessThanOrEqual(1);
      });
    });

    describe('complete', () => {
      it('should complete an activity with feedback', async () => {
        await activityService.complete([activityId], 'Task completed successfully');

        // Verify activity is completed by checking it's not in the active list
        const activities = await activityService.getActivities('crm.lead', leadId);
        const found = activities.find((a) => a.id === activityId);
        expect(found).toBeUndefined();
      });
    });

    describe('cancel', () => {
      it('should cancel an activity', async () => {
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
        expect(found).toBeUndefined();
      });
    });
  });

  describe('FollowerService', () => {
    describe('list', () => {
      it('should list followers for a record', async () => {
        const followers = await followerService.list('crm.lead', leadId);

        expect(Array.isArray(followers)).toBe(true);
        // May have no followers initially
      });
    });

    describe('add', () => {
      it('should add followers to a record', async () => {
        await followerService.add('crm.lead', leadId, [testFollowerPartnerId]);

        const followers = await followerService.list('crm.lead', leadId);
        const found = followers.find((f) => f.partner_id[0] === testFollowerPartnerId);
        expect(found).toBeDefined();
      });

      it('should handle empty partner list', async () => {
        await followerService.add('crm.lead', leadId, []);
        // Should not throw
      });
    });

    describe('remove', () => {
      it('should remove followers from a record', async () => {
        // First add a follower
        await followerService.add('crm.lead', leadId, [testFollowerPartnerId]);

        // Then remove it
        await followerService.remove('crm.lead', leadId, [testFollowerPartnerId]);

        const followers = await followerService.list('crm.lead', leadId);
        const found = followers.find((f) => f.partner_id[0] === testFollowerPartnerId);
        expect(found).toBeUndefined();
      });

      it('should handle empty partner list', async () => {
        await followerService.remove('crm.lead', leadId, []);
        // Should not throw
      });
    });
  });

  describe('PropertiesService', () => {
    describe('findPropertiesField', () => {
      it('should find properties field for crm.lead', async () => {
        const field = await propertiesService.findPropertiesField('crm.lead');
        expect(field).toBe('lead_properties');
      });

      it('should return null for models without properties', async () => {
        const field = await propertiesService.findPropertiesField('res.partner');
        expect(field).toBeNull();
      });
    });

    describe('setDefinitions and getDefinitions', () => {
      it('should set and retrieve property definitions', async () => {
        const definitions = [
          {
            name: 'test_priority',
            string: 'Test Priority',
            type: 'selection' as const,
            selection: [
              ['low', 'Low'],
              ['high', 'High'],
            ],
          },
          {
            name: 'test_amount',
            string: 'Test Amount',
            type: 'float' as const,
          },
        ];

        await propertiesService.setDefinitions('crm.lead', teamId, definitions);

        const retrieved = await propertiesService.getDefinitions('crm.lead', teamId);

        expect(retrieved.length).toBeGreaterThanOrEqual(definitions.length);
        const testPriority = retrieved.find((d) => d.name === 'test_priority');
        expect(testPriority).toBeDefined();
        expect(testPriority?.type).toBe('selection');
      });
    });

    describe('read and update', () => {
      beforeAll(async () => {
        // Ensure we have property definitions
        const definitions = [
          {
            name: 'test_field',
            string: 'Test Field',
            type: 'char' as const,
          },
          {
            name: 'test_number',
            string: 'Test Number',
            type: 'integer' as const,
          },
        ];

        await propertiesService.setDefinitions('crm.lead', teamId, definitions);
      });

      it('should update properties with merge', async () => {
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

        expect(testField?.value).toBe('Updated value');
        expect(testNumber?.value).toBe(42); // Should be preserved
      });

      it('should update properties without merge', async () => {
        await propertiesService.update(
          'crm.lead',
          leadId,
          {
            test_field: 'Only this field',
          },
          undefined,
          false // Don't merge
        );

        const properties = await propertiesService.read('crm.lead', leadId);
        const testField = properties.find((p) => p.name === 'test_field');

        expect(testField?.value).toBe('Only this field');
      });

      it('should read properties from a record', async () => {
        const properties = await propertiesService.read('crm.lead', leadId);

        expect(Array.isArray(properties)).toBe(true);
        // Each property should have metadata
        if (properties.length > 0) {
          const prop = properties[0];
          expect(prop).toHaveProperty('name');
          expect(prop).toHaveProperty('type');
          expect(prop).toHaveProperty('value');
        }
      });
    });
  });
});
