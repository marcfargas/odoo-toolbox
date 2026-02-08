/**
 * Integration tests for mail helpers: postInternalNote, postOpenMessage
 *
 * Tests post a message, re-read it, and verify:
 * - body HTML is preserved
 * - subtype_id is correct (1=comment, 2=note)
 * - is_internal flag matches intent
 * - message_type is 'comment'
 */

import { OdooClient } from '../src/client/odoo-client';
import { postInternalNote, postOpenMessage } from '../src/services/mail';
import { OdooValidationError } from '../src/types/errors';

describe('Mail helpers integration', () => {
  const odooUrl = process.env.ODOO_URL || 'http://localhost:8069';
  const odooDb = process.env.ODOO_DB_NAME || 'odoo';
  const odooUser = process.env.ODOO_DB_USER || 'admin';
  const odooPassword = process.env.ODOO_DB_PASSWORD || 'admin';

  let client: OdooClient;
  let partnerId: number;
  const cleanup: Array<{ model: string; id: number }> = [];

  beforeAll(async () => {
    client = new OdooClient({
      url: odooUrl,
      database: odooDb,
      username: odooUser,
      password: odooPassword,
    });
    await client.authenticate();

    // mail module is initialized via docker-compose (--init base,mail)
    partnerId = await client.create('res.partner', {
      name: `__test_mail_helpers_${Date.now()}`,
    });
    cleanup.push({ model: 'res.partner', id: partnerId });
  });

  afterAll(async () => {
    // Clean up in reverse order (messages before partner)
    for (const { model, id } of cleanup.reverse()) {
      try {
        await client.unlink(model, [id]);
      } catch {
        // Ignore cleanup errors
      }
    }
    client.logout();
  });

  // ── postInternalNote ────────────────────────────────────────────────

  describe('postInternalNote', () => {
    it('should post an internal note with HTML body', async () => {
      const body = '<p>Internal note with <b>bold</b> text.</p>';
      const msgId = await postInternalNote(client, 'res.partner', partnerId, body);
      cleanup.push({ model: 'mail.message', id: msgId });

      expect(msgId).toBeGreaterThan(0);

      // Re-read and verify
      const [msg] = await client.read('mail.message', msgId, [
        'body',
        'message_type',
        'subtype_id',
        'is_internal',
        'model',
        'res_id',
      ]);

      expect(msg.body).toContain('<b>bold</b>');
      expect(msg.message_type).toBe('comment');
      expect(msg.subtype_id[0]).toBe(2); // mail.mt_note
      expect(msg.is_internal).toBe(true);
      expect(msg.model).toBe('res.partner');
      expect(msg.res_id).toBe(partnerId);
    });

    it('should auto-wrap plain text in <p> tags', async () => {
      const msgId = await postInternalNote(
        client,
        'res.partner',
        partnerId,
        'Plain text note from integration test'
      );
      cleanup.push({ model: 'mail.message', id: msgId });

      const [msg] = await client.read('mail.message', msgId, ['body']);
      expect(msg.body).toContain('<p>Plain text note from integration test</p>');
    });

    it('should reject empty body', async () => {
      await expect(postInternalNote(client, 'res.partner', partnerId, '')).rejects.toThrow(
        OdooValidationError
      );

      await expect(postInternalNote(client, 'res.partner', partnerId, '   ')).rejects.toThrow(
        /body must not be empty/
      );
    });

    it('should work via client.mail accessor', async () => {
      const msgId = await client.mail.postInternalNote(
        'res.partner',
        partnerId,
        '<p>Posted via client.mail accessor.</p>'
      );
      cleanup.push({ model: 'mail.message', id: msgId });

      const [msg] = await client.read('mail.message', msgId, ['is_internal', 'subtype_id']);
      expect(msg.is_internal).toBe(true);
      expect(msg.subtype_id[0]).toBe(2);
    });
  });

  // ── postOpenMessage ─────────────────────────────────────────────────

  describe('postOpenMessage', () => {
    it('should post a public message with HTML body', async () => {
      const body = '<p>Public message with <em>italic</em> text.</p>';
      const msgId = await postOpenMessage(client, 'res.partner', partnerId, body);
      cleanup.push({ model: 'mail.message', id: msgId });

      expect(msgId).toBeGreaterThan(0);

      const [msg] = await client.read('mail.message', msgId, [
        'body',
        'message_type',
        'subtype_id',
        'is_internal',
        'model',
        'res_id',
      ]);

      expect(msg.body).toContain('<em>italic</em>');
      expect(msg.message_type).toBe('comment');
      expect(msg.subtype_id[0]).toBe(1); // mail.mt_comment
      expect(msg.is_internal).toBe(false);
      expect(msg.model).toBe('res.partner');
      expect(msg.res_id).toBe(partnerId);
    });

    it('should auto-wrap plain text in <p> tags', async () => {
      const msgId = await postOpenMessage(
        client,
        'res.partner',
        partnerId,
        'Plain text public message'
      );
      cleanup.push({ model: 'mail.message', id: msgId });

      const [msg] = await client.read('mail.message', msgId, ['body']);
      expect(msg.body).toContain('<p>Plain text public message</p>');
    });

    it('should reject empty body', async () => {
      await expect(postOpenMessage(client, 'res.partner', partnerId, '')).rejects.toThrow(
        OdooValidationError
      );
    });

    it('should work via client.mail accessor', async () => {
      const msgId = await client.mail.postOpenMessage(
        'res.partner',
        partnerId,
        '<p>Posted via client.mail accessor.</p>'
      );
      cleanup.push({ model: 'mail.message', id: msgId });

      const [msg] = await client.read('mail.message', msgId, ['is_internal', 'subtype_id']);
      expect(msg.is_internal).toBe(false);
      expect(msg.subtype_id[0]).toBe(1);
    });
  });

  // ── @mentions ───────────────────────────────────────────────────────

  describe('mentions', () => {
    it('should attach @mentions via partnerIds option', async () => {
      // Get admin's partner ID
      const [adminUser] = await client.searchRead('res.users', [['login', '=', 'admin']], {
        fields: ['partner_id'],
        limit: 1,
      });
      const adminPartnerId = adminUser.partner_id[0] as number;

      const msgId = await postOpenMessage(
        client,
        'res.partner',
        partnerId,
        '<p>Mentioning admin for review.</p>',
        { partnerIds: [adminPartnerId] }
      );
      cleanup.push({ model: 'mail.message', id: msgId });

      const [msg] = await client.read('mail.message', msgId, ['partner_ids']);
      expect(msg.partner_ids).toContain(adminPartnerId);
    });
  });

  // ── Round-trip: post both types, read back, verify distinction ──────

  describe('round-trip: internal vs open on same record', () => {
    it('should correctly distinguish internal notes from open messages', async () => {
      const noteId = await postInternalNote(
        client,
        'res.partner',
        partnerId,
        '<p>This is INTERNAL.</p>'
      );
      cleanup.push({ model: 'mail.message', id: noteId });

      const openId = await postOpenMessage(
        client,
        'res.partner',
        partnerId,
        '<p>This is PUBLIC.</p>'
      );
      cleanup.push({ model: 'mail.message', id: openId });

      // Read both in one call
      const messages = await client.read(
        'mail.message',
        [noteId, openId],
        ['body', 'subtype_id', 'is_internal']
      );

      const note = messages.find((m: any) => m.id === noteId)!;
      const open = messages.find((m: any) => m.id === openId)!;

      // Internal note
      expect(note.is_internal).toBe(true);
      expect(note.subtype_id[0]).toBe(2);
      expect(note.body).toContain('INTERNAL');

      // Open message
      expect(open.is_internal).toBe(false);
      expect(open.subtype_id[0]).toBe(1);
      expect(open.body).toContain('PUBLIC');
    });
  });
});
