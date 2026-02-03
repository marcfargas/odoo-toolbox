/**
 * Unit tests for mail tools.
 *
 * Tests cover:
 * - Post internal note
 * - Post public message
 * - Get messages
 * - Manage followers
 * - Add attachment
 * - Schedule activity
 * - Complete activity
 * - Get activities
 * - Channel message
 * - List channels
 */

import { describe, it, expect, vi } from 'vitest';
import {
  handlePostInternalNote,
  handlePostPublicMessage,
  handleGetMessages,
  handleManageFollowers,
  handleAddAttachment,
  handleScheduleActivity,
  handleCompleteActivity,
  handleGetActivities,
  handleChannelMessage,
  handleListChannels,
} from '../../src/tools/mail';
import { SessionManager } from '../../src/session/session-manager';

// Create mock session with mock client
const createMockSession = (clientMethods: Record<string, unknown> = {}) => {
  const mockClient = {
    call: vi.fn().mockResolvedValue(1),
    searchRead: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(1),
    unlink: vi.fn().mockResolvedValue(true),
    ...clientMethods,
  };

  const mockSession = {
    isAuthenticated: () => true,
    getClient: () => mockClient,
  };

  return { session: mockSession as unknown as SessionManager, client: mockClient };
};

describe('Mail Tools', () => {
  describe('handlePostInternalNote', () => {
    it('posts internal note with body', async () => {
      const { session, client } = createMockSession({
        call: vi.fn().mockResolvedValue(123),
      });

      const result = await handlePostInternalNote(session, {
        model: 'res.partner',
        id: 1,
        body: 'Test note',
      });

      expect(result.success).toBe(true);
      expect((result as { message_id: number }).message_id).toBe(123);
      expect(client.call).toHaveBeenCalledWith(
        'res.partner',
        'message_post',
        [[1]],
        expect.objectContaining({
          body: '<p>Test note</p>',
          message_type: 'comment',
          subtype_xmlid: 'mail.mt_note',
        })
      );
    });

    it('includes attachments when provided', async () => {
      const { session, client } = createMockSession({
        call: vi.fn().mockResolvedValue(123),
      });

      await handlePostInternalNote(session, {
        model: 'res.partner',
        id: 1,
        body: 'Note with attachment',
        attachments: [['test.txt', 'SGVsbG8gV29ybGQ=']],
      });

      expect(client.call).toHaveBeenCalledWith(
        'res.partner',
        'message_post',
        [[1]],
        expect.objectContaining({
          attachments: [['test.txt', 'SGVsbG8gV29ybGQ=']],
        })
      );
    });

    it('validates required fields', async () => {
      const { session } = createMockSession();

      const result = await handlePostInternalNote(session, {
        model: 'res.partner',
        // missing id and body
      });

      expect(result.success).toBe(false);
    });
  });

  describe('handlePostPublicMessage', () => {
    it('posts public message with mt_comment subtype', async () => {
      const { session, client } = createMockSession({
        call: vi.fn().mockResolvedValue(456),
      });

      const result = await handlePostPublicMessage(session, {
        model: 'crm.lead',
        id: 5,
        body: 'Public message',
      });

      expect(result.success).toBe(true);
      expect((result as { message_id: number }).message_id).toBe(456);
      expect(client.call).toHaveBeenCalledWith(
        'crm.lead',
        'message_post',
        [[5]],
        expect.objectContaining({
          subtype_xmlid: 'mail.mt_comment',
        })
      );
    });

    it('includes partner_ids when provided', async () => {
      const { session, client } = createMockSession({
        call: vi.fn().mockResolvedValue(456),
      });

      await handlePostPublicMessage(session, {
        model: 'res.partner',
        id: 1,
        body: 'Message to specific partners',
        partner_ids: [10, 20, 30],
      });

      expect(client.call).toHaveBeenCalledWith(
        'res.partner',
        'message_post',
        [[1]],
        expect.objectContaining({
          partner_ids: [10, 20, 30],
        })
      );
    });
  });

  describe('handleGetMessages', () => {
    it('returns messages from record', async () => {
      const { session, client } = createMockSession({
        searchRead: vi.fn().mockResolvedValue([
          { id: 1, body: '<p>Message 1</p>', message_type: 'comment' },
          { id: 2, body: '<p>Message 2</p>', message_type: 'notification' },
        ]),
      });

      const result = await handleGetMessages(session, {
        model: 'res.partner',
        id: 1,
      });

      expect(result.success).toBe(true);
      expect((result as { count: number }).count).toBe(2);
      expect(client.searchRead).toHaveBeenCalledWith(
        'mail.message',
        expect.arrayContaining([
          ['model', '=', 'res.partner'],
          ['res_id', '=', 1],
        ]),
        expect.objectContaining({ limit: 20 })
      );
    });

    it('filters by message types', async () => {
      const { session, client } = createMockSession({
        searchRead: vi.fn().mockResolvedValue([]),
      });

      await handleGetMessages(session, {
        model: 'res.partner',
        id: 1,
        message_types: ['comment', 'email'],
      });

      expect(client.searchRead).toHaveBeenCalledWith(
        'mail.message',
        expect.arrayContaining([['message_type', 'in', ['comment', 'email']]]),
        expect.any(Object)
      );
    });
  });

  describe('handleManageFollowers', () => {
    it('lists followers', async () => {
      const { session } = createMockSession({
        searchRead: vi.fn().mockResolvedValue([
          { id: 1, partner_id: [10, 'Partner A'] },
          { id: 2, partner_id: [20, 'Partner B'] },
        ]),
      });

      const result = await handleManageFollowers(session, {
        model: 'res.partner',
        id: 1,
        action: 'list',
      });

      expect(result.success).toBe(true);
      expect((result as { count: number }).count).toBe(2);
    });

    it('adds followers', async () => {
      const { session, client } = createMockSession();

      const result = await handleManageFollowers(session, {
        model: 'res.partner',
        id: 1,
        action: 'add',
        partner_ids: [10, 20],
      });

      expect(result.success).toBe(true);
      expect(client.call).toHaveBeenCalledWith('res.partner', 'message_subscribe', [[1]], {
        partner_ids: [10, 20],
      });
    });

    it('removes followers', async () => {
      const { session, client } = createMockSession();

      const result = await handleManageFollowers(session, {
        model: 'res.partner',
        id: 1,
        action: 'remove',
        partner_ids: [10],
      });

      expect(result.success).toBe(true);
      expect(client.call).toHaveBeenCalledWith('res.partner', 'message_unsubscribe', [[1], [10]]);
    });

    it('requires partner_ids for add/remove', async () => {
      const { session } = createMockSession();

      const result = await handleManageFollowers(session, {
        model: 'res.partner',
        id: 1,
        action: 'add',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('handleAddAttachment', () => {
    it('creates attachment on record', async () => {
      const { session, client } = createMockSession({
        create: vi.fn().mockResolvedValue(789),
      });

      const result = await handleAddAttachment(session, {
        model: 'res.partner',
        id: 1,
        filename: 'document.pdf',
        content: 'SGVsbG8gV29ybGQ=',
      });

      expect(result.success).toBe(true);
      expect((result as { attachment_id: number }).attachment_id).toBe(789);
      expect(client.create).toHaveBeenCalledWith('ir.attachment', {
        name: 'document.pdf',
        datas: 'SGVsbG8gV29ybGQ=',
        res_model: 'res.partner',
        res_id: 1,
      });
    });

    it('includes description when provided', async () => {
      const { session, client } = createMockSession({
        create: vi.fn().mockResolvedValue(789),
      });

      await handleAddAttachment(session, {
        model: 'res.partner',
        id: 1,
        filename: 'report.pdf',
        content: 'base64data',
        description: 'Monthly report',
      });

      expect(client.create).toHaveBeenCalledWith(
        'ir.attachment',
        expect.objectContaining({ description: 'Monthly report' })
      );
    });
  });

  describe('handleScheduleActivity', () => {
    it('schedules activity with XML ID', async () => {
      const { session } = createMockSession({
        call: vi
          .fn()
          .mockResolvedValueOnce(5) // xmlid_to_res_id
          .mockResolvedValueOnce(100), // activity_schedule
      });

      const result = await handleScheduleActivity(session, {
        model: 'res.partner',
        id: 1,
        activity_type: 'mail.mail_activity_data_todo',
        summary: 'Follow up',
        date_deadline: '2024-12-31',
      });

      expect(result.success).toBe(true);
      expect((result as { activity_id: number }).activity_id).toBe(100);
    });

    it('schedules activity with numeric type ID', async () => {
      const { session, client } = createMockSession({
        call: vi.fn().mockResolvedValue(100),
      });

      await handleScheduleActivity(session, {
        model: 'res.partner',
        id: 1,
        activity_type: '5',
        summary: 'Call client',
        date_deadline: '2024-12-31',
      });

      expect(client.call).toHaveBeenCalledWith(
        'res.partner',
        'activity_schedule',
        [[1]],
        expect.objectContaining({ activity_type_id: 5 })
      );
    });
  });

  describe('handleCompleteActivity', () => {
    it('marks activity as done', async () => {
      const { session, client } = createMockSession();

      const result = await handleCompleteActivity(session, {
        activity_ids: 10,
        action: 'done',
        feedback: 'Completed successfully',
      });

      expect(result.success).toBe(true);
      expect(client.call).toHaveBeenCalledWith('mail.activity', 'action_feedback', [[10]], {
        feedback: 'Completed successfully',
      });
    });

    it('cancels activities', async () => {
      const { session, client } = createMockSession();

      const result = await handleCompleteActivity(session, {
        activity_ids: [10, 20],
        action: 'cancel',
      });

      expect(result.success).toBe(true);
      expect(client.unlink).toHaveBeenCalledWith('mail.activity', [10, 20]);
    });
  });

  describe('handleGetActivities', () => {
    it('returns activities', async () => {
      const { session } = createMockSession({
        searchRead: vi.fn().mockResolvedValue([
          { id: 1, summary: 'Task 1', state: 'today' },
          { id: 2, summary: 'Task 2', state: 'planned' },
        ]),
      });

      const result = await handleGetActivities(session, {});

      expect(result.success).toBe(true);
      expect((result as { count: number }).count).toBe(2);
    });

    it('filters by model and state', async () => {
      const { session, client } = createMockSession({
        searchRead: vi.fn().mockResolvedValue([]),
      });

      await handleGetActivities(session, {
        model: 'crm.lead',
        state: 'overdue',
      });

      expect(client.searchRead).toHaveBeenCalledWith(
        'mail.activity',
        expect.arrayContaining([
          ['res_model', '=', 'crm.lead'],
          ['state', '=', 'overdue'],
        ]),
        expect.any(Object)
      );
    });
  });

  describe('handleChannelMessage', () => {
    it('posts message to channel', async () => {
      const { session } = createMockSession({
        call: vi
          .fn()
          .mockResolvedValueOnce(1) // search_count for discuss.channel
          .mockResolvedValueOnce(999), // message_post
      });

      const result = await handleChannelMessage(session, {
        channel_id: 5,
        body: 'Hello channel!',
      });

      expect(result.success).toBe(true);
      expect((result as { message_id: number }).message_id).toBe(999);
    });
  });

  describe('handleListChannels', () => {
    it('lists channels', async () => {
      const { session } = createMockSession({
        call: vi.fn().mockResolvedValue(1), // search_count for discuss.channel
        searchRead: vi.fn().mockResolvedValue([
          { id: 1, name: 'General', channel_type: 'channel' },
          { id: 2, name: 'Sales', channel_type: 'channel' },
        ]),
      });

      const result = await handleListChannels(session, {});

      expect(result.success).toBe(true);
      expect((result as { count: number }).count).toBe(2);
      expect((result as { channel_model: string }).channel_model).toBe('discuss.channel');
    });

    it('filters by channel type', async () => {
      const { session, client } = createMockSession({
        call: vi.fn().mockResolvedValue(1),
        searchRead: vi.fn().mockResolvedValue([]),
      });

      await handleListChannels(session, {
        channel_type: 'group',
      });

      expect(client.searchRead).toHaveBeenCalledWith(
        'discuss.channel',
        expect.arrayContaining([['channel_type', '=', 'group']]),
        expect.any(Object)
      );
    });
  });
});
