/**
 * Meta-Skills Documentation Tests: 01-fundamentals/
 *
 * These tests validate that the code examples in the meta-skills documentation
 * actually work against a real Odoo instance.
 *
 * Tests cover: connection.md, field-types.md, domains.md
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  OdooClient,
  OdooAuthError,
  OdooNetworkError,
} from '@odoo-toolbox/client';
import {
  getTestConfig,
  uniqueTestName,
} from '../../../tests/helpers/odoo-instance';

describe('Meta-Skills: 01-fundamentals/', () => {
  let client: OdooClient;
  const createdRecords: Array<{ model: string; id: number }> = [];

  beforeAll(async () => {
    const config = getTestConfig();
    client = new OdooClient({
      url: config.url,
      database: config.database,
      username: config.username,
      password: config.password,
    });

    await client.authenticate();
  }, 30000);

  afterAll(async () => {
    // Cleanup created records
    for (const { model, id } of createdRecords.reverse()) {
      try {
        await client.unlink(model, id);
      } catch {
        // Ignore cleanup errors
      }
    }
    await client.logout();
  });

  describe('connection.md', () => {
    describe('Basic Connection patterns', () => {
      it('should authenticate with correct credentials', async () => {
        // Pattern from connection.md: Basic connection
        const config = getTestConfig();
        const testClient = new OdooClient({
          url: config.url,
          database: config.database,
          username: config.username,
          password: config.password,
        });

        await testClient.authenticate();

        // Should be authenticated
        const session = testClient.getSession();
        expect(session).toBeDefined();
        expect(session?.uid).toBeGreaterThan(0);

        await testClient.logout();
      });

      it('should get session information after authentication', async () => {
        // Pattern from connection.md: Session information
        const session = client.getSession();

        expect(session).toBeDefined();
        expect(session?.uid).toBeGreaterThan(0);
        expect(session?.db).toBeDefined();
      });
    });

    describe('Error handling patterns', () => {
      it('should throw OdooAuthError on invalid credentials', async () => {
        // Pattern from connection.md: Error handling
        const config = getTestConfig();
        const badClient = new OdooClient({
          url: config.url,
          database: config.database,
          username: 'invalid_user_that_does_not_exist',
          password: 'wrong_password',
        });

        await expect(badClient.authenticate()).rejects.toThrow(OdooAuthError);
      });

      it('should throw error on invalid URL', async () => {
        // Pattern from connection.md: Network error handling
        // Note: The client wraps network errors in OdooAuthError during authenticate()
        const badClient = new OdooClient({
          url: 'http://localhost:9999', // Wrong port
          database: 'test',
          username: 'admin',
          password: 'admin',
        });

        // Network errors during authentication are wrapped in OdooAuthError
        await expect(badClient.authenticate()).rejects.toThrow();
      }, 10000);
    });
  });

  describe('field-types.md', () => {
    describe('Basic field types', () => {
      it('should handle char, text, integer, float, boolean fields', async () => {
        // Pattern from field-types.md: Basic field types
        // Note: credit_limit requires sale module; using base fields instead
        const partnerId = await client.create('res.partner', {
          name: uniqueTestName('Field Types Test'), // char
          comment: 'This is a long text comment', // text (html in UI but text storage)
          color: 5, // integer
          is_company: false, // boolean
        });
        createdRecords.push({ model: 'res.partner', id: partnerId });

        const [partner] = await client.read('res.partner', [partnerId], [
          'name',
          'comment',
          'color',
          'is_company',
        ]);

        expect(typeof partner.name).toBe('string');
        expect(typeof partner.color).toBe('number');
        expect(typeof partner.is_company).toBe('boolean');
      });

      it('should handle date and datetime fields', async () => {
        // Pattern from field-types.md: Date/datetime handling
        const partnerId = await client.create('res.partner', {
          name: uniqueTestName('Date Test'),
          date: '2024-01-15', // date
        });
        createdRecords.push({ model: 'res.partner', id: partnerId });

        const [partner] = await client.read('res.partner', [partnerId], [
          'date',
        ]);

        expect(partner.date).toBe('2024-01-15');
      });
    });

    describe('Many2One Read/Write Asymmetry', () => {
      it('should write Many2One as ID, read as [id, name]', async () => {
        // CRITICAL Pattern from field-types.md: Many2One asymmetry
        // Write: pass just the ID
        // Read: returns [id, display_name]

        // Create parent
        const parentId = await client.create('res.partner', {
          name: uniqueTestName('Parent for M2O Test'),
          is_company: true,
        });
        createdRecords.push({ model: 'res.partner', id: parentId });

        // Create child with Many2One - WRITE just the ID
        const childId = await client.create('res.partner', {
          name: uniqueTestName('Child for M2O Test'),
          parent_id: parentId, // Just the ID!
        });
        createdRecords.push({ model: 'res.partner', id: childId });

        // READ returns [id, display_name] tuple
        const [child] = await client.read('res.partner', [childId], [
          'parent_id',
        ]);

        expect(child.parent_id).toBeDefined();
        expect(Array.isArray(child.parent_id)).toBe(true);
        expect(child.parent_id.length).toBe(2);
        expect(child.parent_id[0]).toBe(parentId); // First element is ID
        expect(typeof child.parent_id[1]).toBe('string'); // Second is name
      });

      it('should extract ID from Many2One read result', async () => {
        // Pattern from field-types.md: Extracting values from Many2One
        const parentId = await client.create('res.partner', {
          name: uniqueTestName('Parent Extract Test'),
          is_company: true,
        });
        createdRecords.push({ model: 'res.partner', id: parentId });

        const childId = await client.create('res.partner', {
          name: uniqueTestName('Child Extract Test'),
          parent_id: parentId,
        });
        createdRecords.push({ model: 'res.partner', id: childId });

        const [child] = await client.read('res.partner', [childId], [
          'parent_id',
        ]);

        // Pattern: Extract ID and name from tuple
        const extractedId = child.parent_id ? child.parent_id[0] : null;
        const extractedName = child.parent_id ? child.parent_id[1] : null;

        expect(extractedId).toBe(parentId);
        expect(extractedName).toBeDefined();
      });
    });

    describe('Many2Many fields', () => {
      it('should read Many2Many as array of IDs', async () => {
        // Pattern from field-types.md: Many2Many reading
        const partnerId = await client.create('res.partner', {
          name: uniqueTestName('M2M Test Partner'),
        });
        createdRecords.push({ model: 'res.partner', id: partnerId });

        const [partner] = await client.read('res.partner', [partnerId], [
          'category_id',
        ]);

        // Many2Many returns array of IDs (may be empty)
        expect(Array.isArray(partner.category_id)).toBe(true);
      });

      it('should write Many2Many using command [6, 0, ids]', async () => {
        // Pattern from field-types.md: Many2Many writing with commands

        // First, find or create some categories
        let categoryIds: number[] = await client.search(
          'res.partner.category',
          [],
          { limit: 2 }
        );

        if (categoryIds.length === 0) {
          const catId = await client.create('res.partner.category', {
            name: uniqueTestName('Test Category'),
          });
          categoryIds = [catId];
          createdRecords.push({ model: 'res.partner.category', id: catId });
        }

        // Create partner with categories using [6, 0, ids] command
        const partnerId = await client.create('res.partner', {
          name: uniqueTestName('M2M Write Test'),
          category_id: [[6, 0, categoryIds]], // Replace all with these IDs
        });
        createdRecords.push({ model: 'res.partner', id: partnerId });

        // Verify
        const [partner] = await client.read('res.partner', [partnerId], [
          'category_id',
        ]);
        expect(partner.category_id.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('Selection fields', () => {
      it('should read and write selection fields as string values', async () => {
        // Pattern from field-types.md: Selection fields
        const partnerId = await client.create('res.partner', {
          name: uniqueTestName('Selection Test'),
          type: 'contact', // Selection field
        });
        createdRecords.push({ model: 'res.partner', id: partnerId });

        const [partner] = await client.read('res.partner', [partnerId], [
          'type',
        ]);

        expect(partner.type).toBe('contact');
      });
    });
  });

  describe('domains.md', () => {
    let testPartnerIds: number[] = [];

    beforeAll(async () => {
      // Create test data for domain tests
      testPartnerIds = [];

      const id1 = await client.create('res.partner', {
        name: uniqueTestName('Domain Test Alpha'),
        is_company: true,
        email: 'alpha@domain-test.com',
      });
      testPartnerIds.push(id1);
      createdRecords.push({ model: 'res.partner', id: id1 });

      const id2 = await client.create('res.partner', {
        name: uniqueTestName('Domain Test Beta'),
        is_company: false,
        email: 'beta@domain-test.com',
      });
      testPartnerIds.push(id2);
      createdRecords.push({ model: 'res.partner', id: id2 });

      const id3 = await client.create('res.partner', {
        name: uniqueTestName('Domain Test Gamma'),
        is_company: true,
        email: 'gamma@other.com',
      });
      testPartnerIds.push(id3);
      createdRecords.push({ model: 'res.partner', id: id3 });
    });

    describe('Basic operators', () => {
      it('should filter with = operator', async () => {
        // Pattern from domains.md: Equals operator
        const results = await client.searchRead(
          'res.partner',
          [['is_company', '=', true]],
          { fields: ['name', 'is_company'] }
        );

        results.forEach((r) => {
          expect(r.is_company).toBe(true);
        });
      });

      it('should filter with != operator', async () => {
        // Pattern from domains.md: Not equals
        const results = await client.searchRead(
          'res.partner',
          [['is_company', '!=', true]],
          { fields: ['name', 'is_company'] }
        );

        results.forEach((r) => {
          expect(r.is_company).toBe(false);
        });
      });

      it('should filter with ilike operator (case-insensitive)', async () => {
        // Pattern from domains.md: Pattern matching
        const results = await client.searchRead(
          'res.partner',
          [['name', 'ilike', '%Domain Test%']],
          { fields: ['name'] }
        );

        expect(results.length).toBeGreaterThanOrEqual(3);
        results.forEach((r) => {
          expect(r.name.toLowerCase()).toContain('domain test');
        });
      });

      it('should filter with in operator', async () => {
        // Pattern from domains.md: Value in list
        const results = await client.searchRead(
          'res.partner',
          [['id', 'in', testPartnerIds]],
          { fields: ['name'] }
        );

        expect(results.length).toBe(3);
      });
    });

    describe('Logical operators', () => {
      it('should combine conditions with AND (default)', async () => {
        // Pattern from domains.md: Implicit AND
        const results = await client.searchRead(
          'res.partner',
          [
            ['name', 'ilike', '%Domain Test%'],
            ['is_company', '=', true],
          ],
          { fields: ['name', 'is_company'] }
        );

        results.forEach((r) => {
          expect(r.name.toLowerCase()).toContain('domain test');
          expect(r.is_company).toBe(true);
        });
      });

      it('should combine conditions with OR using | prefix', async () => {
        // Pattern from domains.md: OR operator (prefix notation)
        const results = await client.searchRead(
          'res.partner',
          [
            '|',
            ['email', 'ilike', '%@domain-test.com'],
            ['email', 'ilike', '%@other.com'],
          ],
          { fields: ['email'] }
        );

        const ourTestResults = results.filter(
          (r) =>
            r.email &&
            (r.email.includes('@domain-test.com') ||
              r.email.includes('@other.com'))
        );

        expect(ourTestResults.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('Special values', () => {
      it('should filter for non-empty values using != false', async () => {
        // Pattern from domains.md: Field is set (not empty)
        const results = await client.searchRead(
          'res.partner',
          [
            ['email', '!=', false],
            ['name', 'ilike', '%Domain Test%'],
          ],
          { fields: ['email'] }
        );

        results.forEach((r) => {
          expect(r.email).toBeTruthy();
        });
      });

      it('should filter for empty values using = false', async () => {
        // Create a partner without email
        const noEmailId = await client.create('res.partner', {
          name: uniqueTestName('Domain Test No Email'),
        });
        createdRecords.push({ model: 'res.partner', id: noEmailId });

        // Pattern from domains.md: Field is empty
        const results = await client.searchRead(
          'res.partner',
          [
            ['email', '=', false],
            ['id', '=', noEmailId],
          ],
          { fields: ['name', 'email'] }
        );

        expect(results.length).toBe(1);
        expect(results[0].email).toBeFalsy();
      });
    });

    describe('Relational field traversal', () => {
      it('should traverse Many2One with dot notation', async () => {
        // Pattern from domains.md: Dot notation traversal
        // Find partners whose parent company has a specific condition

        // First create a company with a specific condition
        const companyId = await client.create('res.partner', {
          name: uniqueTestName('Domain Company'),
          is_company: true,
        });
        createdRecords.push({ model: 'res.partner', id: companyId });

        // Create a contact under that company
        const contactId = await client.create('res.partner', {
          name: uniqueTestName('Domain Contact'),
          parent_id: companyId,
        });
        createdRecords.push({ model: 'res.partner', id: contactId });

        // Search using dot notation to traverse the relation
        const results = await client.searchRead(
          'res.partner',
          [['parent_id.is_company', '=', true], ['id', '=', contactId]],
          { fields: ['name', 'parent_id'] }
        );

        expect(results.length).toBe(1);
        expect(results[0].id).toBe(contactId);
      });
    });
  });
});
