"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const mail_1 = require("../../src/tools/mail");
// Create mock session with mock client
const createMockSession = (clientMethods = {}) => {
    const mockClient = {
        call: vitest_1.vi.fn().mockResolvedValue(1),
        searchRead: vitest_1.vi.fn().mockResolvedValue([]),
        create: vitest_1.vi.fn().mockResolvedValue(1),
        unlink: vitest_1.vi.fn().mockResolvedValue(true),
        ...clientMethods,
    };
    const mockSession = {
        isAuthenticated: () => true,
        getClient: () => mockClient,
    };
    return { session: mockSession, client: mockClient };
};
(0, vitest_1.describe)('Mail Tools', () => {
    (0, vitest_1.describe)('handlePostInternalNote', () => {
        (0, vitest_1.it)('posts internal note with body', async () => {
            const { session, client } = createMockSession({
                call: vitest_1.vi.fn().mockResolvedValue(123),
            });
            const result = await (0, mail_1.handlePostInternalNote)(session, {
                model: 'res.partner',
                id: 1,
                body: 'Test note',
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.message_id).toBe(123);
            (0, vitest_1.expect)(client.call).toHaveBeenCalledWith('res.partner', 'message_post', [[1]], vitest_1.expect.objectContaining({
                body: '<p>Test note</p>',
                message_type: 'comment',
                subtype_xmlid: 'mail.mt_note',
            }));
        });
        (0, vitest_1.it)('includes attachments when provided', async () => {
            const { session, client } = createMockSession({
                call: vitest_1.vi.fn().mockResolvedValue(123),
            });
            await (0, mail_1.handlePostInternalNote)(session, {
                model: 'res.partner',
                id: 1,
                body: 'Note with attachment',
                attachments: [['test.txt', 'SGVsbG8gV29ybGQ=']],
            });
            (0, vitest_1.expect)(client.call).toHaveBeenCalledWith('res.partner', 'message_post', [[1]], vitest_1.expect.objectContaining({
                attachments: [['test.txt', 'SGVsbG8gV29ybGQ=']],
            }));
        });
        (0, vitest_1.it)('validates required fields', async () => {
            const { session } = createMockSession();
            const result = await (0, mail_1.handlePostInternalNote)(session, {
                model: 'res.partner',
                // missing id and body
            });
            (0, vitest_1.expect)(result.success).toBe(false);
        });
    });
    (0, vitest_1.describe)('handlePostPublicMessage', () => {
        (0, vitest_1.it)('posts public message with mt_comment subtype', async () => {
            const { session, client } = createMockSession({
                call: vitest_1.vi.fn().mockResolvedValue(456),
            });
            const result = await (0, mail_1.handlePostPublicMessage)(session, {
                model: 'crm.lead',
                id: 5,
                body: 'Public message',
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.message_id).toBe(456);
            (0, vitest_1.expect)(client.call).toHaveBeenCalledWith('crm.lead', 'message_post', [[5]], vitest_1.expect.objectContaining({
                subtype_xmlid: 'mail.mt_comment',
            }));
        });
        (0, vitest_1.it)('includes partner_ids when provided', async () => {
            const { session, client } = createMockSession({
                call: vitest_1.vi.fn().mockResolvedValue(456),
            });
            await (0, mail_1.handlePostPublicMessage)(session, {
                model: 'res.partner',
                id: 1,
                body: 'Message to specific partners',
                partner_ids: [10, 20, 30],
            });
            (0, vitest_1.expect)(client.call).toHaveBeenCalledWith('res.partner', 'message_post', [[1]], vitest_1.expect.objectContaining({
                partner_ids: [10, 20, 30],
            }));
        });
    });
    (0, vitest_1.describe)('handleGetMessages', () => {
        (0, vitest_1.it)('returns messages from record', async () => {
            const { session, client } = createMockSession({
                searchRead: vitest_1.vi.fn().mockResolvedValue([
                    { id: 1, body: '<p>Message 1</p>', message_type: 'comment' },
                    { id: 2, body: '<p>Message 2</p>', message_type: 'notification' },
                ]),
            });
            const result = await (0, mail_1.handleGetMessages)(session, {
                model: 'res.partner',
                id: 1,
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.count).toBe(2);
            (0, vitest_1.expect)(client.searchRead).toHaveBeenCalledWith('mail.message', vitest_1.expect.arrayContaining([
                ['model', '=', 'res.partner'],
                ['res_id', '=', 1],
            ]), vitest_1.expect.objectContaining({ limit: 20 }));
        });
        (0, vitest_1.it)('filters by message types', async () => {
            const { session, client } = createMockSession({
                searchRead: vitest_1.vi.fn().mockResolvedValue([]),
            });
            await (0, mail_1.handleGetMessages)(session, {
                model: 'res.partner',
                id: 1,
                message_types: ['comment', 'email'],
            });
            (0, vitest_1.expect)(client.searchRead).toHaveBeenCalledWith('mail.message', vitest_1.expect.arrayContaining([['message_type', 'in', ['comment', 'email']]]), vitest_1.expect.any(Object));
        });
    });
    (0, vitest_1.describe)('handleManageFollowers', () => {
        (0, vitest_1.it)('lists followers', async () => {
            const { session } = createMockSession({
                searchRead: vitest_1.vi.fn().mockResolvedValue([
                    { id: 1, partner_id: [10, 'Partner A'] },
                    { id: 2, partner_id: [20, 'Partner B'] },
                ]),
            });
            const result = await (0, mail_1.handleManageFollowers)(session, {
                model: 'res.partner',
                id: 1,
                action: 'list',
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.count).toBe(2);
        });
        (0, vitest_1.it)('adds followers', async () => {
            const { session, client } = createMockSession();
            const result = await (0, mail_1.handleManageFollowers)(session, {
                model: 'res.partner',
                id: 1,
                action: 'add',
                partner_ids: [10, 20],
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(client.call).toHaveBeenCalledWith('res.partner', 'message_subscribe', [[1]], {
                partner_ids: [10, 20],
            });
        });
        (0, vitest_1.it)('removes followers', async () => {
            const { session, client } = createMockSession();
            const result = await (0, mail_1.handleManageFollowers)(session, {
                model: 'res.partner',
                id: 1,
                action: 'remove',
                partner_ids: [10],
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(client.call).toHaveBeenCalledWith('res.partner', 'message_unsubscribe', [[1], [10]]);
        });
        (0, vitest_1.it)('requires partner_ids for add/remove', async () => {
            const { session } = createMockSession();
            const result = await (0, mail_1.handleManageFollowers)(session, {
                model: 'res.partner',
                id: 1,
                action: 'add',
            });
            (0, vitest_1.expect)(result.success).toBe(false);
        });
    });
    (0, vitest_1.describe)('handleAddAttachment', () => {
        (0, vitest_1.it)('creates attachment on record', async () => {
            const { session, client } = createMockSession({
                create: vitest_1.vi.fn().mockResolvedValue(789),
            });
            const result = await (0, mail_1.handleAddAttachment)(session, {
                model: 'res.partner',
                id: 1,
                filename: 'document.pdf',
                content: 'SGVsbG8gV29ybGQ=',
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.attachment_id).toBe(789);
            (0, vitest_1.expect)(client.create).toHaveBeenCalledWith('ir.attachment', {
                name: 'document.pdf',
                datas: 'SGVsbG8gV29ybGQ=',
                res_model: 'res.partner',
                res_id: 1,
            });
        });
        (0, vitest_1.it)('includes description when provided', async () => {
            const { session, client } = createMockSession({
                create: vitest_1.vi.fn().mockResolvedValue(789),
            });
            await (0, mail_1.handleAddAttachment)(session, {
                model: 'res.partner',
                id: 1,
                filename: 'report.pdf',
                content: 'base64data',
                description: 'Monthly report',
            });
            (0, vitest_1.expect)(client.create).toHaveBeenCalledWith('ir.attachment', vitest_1.expect.objectContaining({ description: 'Monthly report' }));
        });
    });
    (0, vitest_1.describe)('handleScheduleActivity', () => {
        (0, vitest_1.it)('schedules activity with XML ID', async () => {
            const { session } = createMockSession({
                call: vitest_1.vi
                    .fn()
                    .mockResolvedValueOnce(5) // xmlid_to_res_id
                    .mockResolvedValueOnce(100), // activity_schedule
            });
            const result = await (0, mail_1.handleScheduleActivity)(session, {
                model: 'res.partner',
                id: 1,
                activity_type: 'mail.mail_activity_data_todo',
                summary: 'Follow up',
                date_deadline: '2024-12-31',
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.activity_id).toBe(100);
        });
        (0, vitest_1.it)('schedules activity with numeric type ID', async () => {
            const { session, client } = createMockSession({
                call: vitest_1.vi.fn().mockResolvedValue(100),
            });
            await (0, mail_1.handleScheduleActivity)(session, {
                model: 'res.partner',
                id: 1,
                activity_type: '5',
                summary: 'Call client',
                date_deadline: '2024-12-31',
            });
            (0, vitest_1.expect)(client.call).toHaveBeenCalledWith('res.partner', 'activity_schedule', [[1]], vitest_1.expect.objectContaining({ activity_type_id: 5 }));
        });
    });
    (0, vitest_1.describe)('handleCompleteActivity', () => {
        (0, vitest_1.it)('marks activity as done', async () => {
            const { session, client } = createMockSession();
            const result = await (0, mail_1.handleCompleteActivity)(session, {
                activity_ids: 10,
                action: 'done',
                feedback: 'Completed successfully',
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(client.call).toHaveBeenCalledWith('mail.activity', 'action_feedback', [[10]], {
                feedback: 'Completed successfully',
            });
        });
        (0, vitest_1.it)('cancels activities', async () => {
            const { session, client } = createMockSession();
            const result = await (0, mail_1.handleCompleteActivity)(session, {
                activity_ids: [10, 20],
                action: 'cancel',
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(client.unlink).toHaveBeenCalledWith('mail.activity', [10, 20]);
        });
    });
    (0, vitest_1.describe)('handleGetActivities', () => {
        (0, vitest_1.it)('returns activities', async () => {
            const { session } = createMockSession({
                searchRead: vitest_1.vi.fn().mockResolvedValue([
                    { id: 1, summary: 'Task 1', state: 'today' },
                    { id: 2, summary: 'Task 2', state: 'planned' },
                ]),
            });
            const result = await (0, mail_1.handleGetActivities)(session, {});
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.count).toBe(2);
        });
        (0, vitest_1.it)('filters by model and state', async () => {
            const { session, client } = createMockSession({
                searchRead: vitest_1.vi.fn().mockResolvedValue([]),
            });
            await (0, mail_1.handleGetActivities)(session, {
                model: 'crm.lead',
                state: 'overdue',
            });
            (0, vitest_1.expect)(client.searchRead).toHaveBeenCalledWith('mail.activity', vitest_1.expect.arrayContaining([
                ['res_model', '=', 'crm.lead'],
                ['state', '=', 'overdue'],
            ]), vitest_1.expect.any(Object));
        });
    });
    (0, vitest_1.describe)('handleChannelMessage', () => {
        (0, vitest_1.it)('posts message to channel', async () => {
            const { session } = createMockSession({
                call: vitest_1.vi
                    .fn()
                    .mockResolvedValueOnce(1) // search_count for discuss.channel
                    .mockResolvedValueOnce(999), // message_post
            });
            const result = await (0, mail_1.handleChannelMessage)(session, {
                channel_id: 5,
                body: 'Hello channel!',
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.message_id).toBe(999);
        });
    });
    (0, vitest_1.describe)('handleListChannels', () => {
        (0, vitest_1.it)('lists channels', async () => {
            const { session } = createMockSession({
                call: vitest_1.vi.fn().mockResolvedValue(1), // search_count for discuss.channel
                searchRead: vitest_1.vi.fn().mockResolvedValue([
                    { id: 1, name: 'General', channel_type: 'channel' },
                    { id: 2, name: 'Sales', channel_type: 'channel' },
                ]),
            });
            const result = await (0, mail_1.handleListChannels)(session, {});
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.count).toBe(2);
            (0, vitest_1.expect)(result.channel_model).toBe('discuss.channel');
        });
        (0, vitest_1.it)('filters by channel type', async () => {
            const { session, client } = createMockSession({
                call: vitest_1.vi.fn().mockResolvedValue(1),
                searchRead: vitest_1.vi.fn().mockResolvedValue([]),
            });
            await (0, mail_1.handleListChannels)(session, {
                channel_type: 'group',
            });
            (0, vitest_1.expect)(client.searchRead).toHaveBeenCalledWith('discuss.channel', vitest_1.expect.arrayContaining([['channel_type', '=', 'group']]), vitest_1.expect.any(Object));
        });
    });
});
//# sourceMappingURL=mail.test.js.map