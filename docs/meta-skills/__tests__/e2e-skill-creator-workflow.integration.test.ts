/**
 * E2E Test: Skill Creator Workflow
 *
 * This test validates the end-to-end workflow described in the meta-skills README:
 * 1. Install skill set (copy to .claude/commands)
 * 2. Connect to Odoo using the documented patterns
 * 3. Introspect models and fields
 * 4. Verify the workflow enables skill generation
 *
 * This simulates what a user would experience when following the README instructions.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { OdooClient } from '@odoo-toolbox/client';
import { Introspector } from '@odoo-toolbox/introspection';
import { getTestConfig } from '../../../tests/helpers/odoo-instance';

describe('E2E: Skill Creator Workflow', () => {
  let tempWorkspace: string;
  let client: OdooClient;
  let introspector: Introspector;

  const metaSkillsDir = path.resolve(__dirname, '..');

  beforeAll(async () => {
    // Create temp workspace simulating user's project
    tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'odoo-skills-test-'));

    // Connect to test Odoo
    const config = getTestConfig();
    client = new OdooClient({
      url: config.url,
      database: config.database,
      username: config.username,
      password: config.password,
    });
    await client.authenticate();
    introspector = new Introspector(client);
  }, 30000);

  afterAll(async () => {
    // Cleanup
    if (client) {
      await client.logout();
    }
    if (tempWorkspace && fs.existsSync(tempWorkspace)) {
      fs.rmSync(tempWorkspace, { recursive: true, force: true });
    }
  });

  describe('Step 1: Install skill set', () => {
    it('should have all meta-skills documentation files', () => {
      const requiredDocs = [
        'README.md',
        '01-fundamentals/connection.md',
        '01-fundamentals/field-types.md',
        '01-fundamentals/domains.md',
        '02-introspection/discovering-models.md',
        '02-introspection/analyzing-fields.md',
        '03-skill-generation/skill-format.md',
        '03-skill-generation/workflow.md',
        '04-patterns/crud-operations.md',
        '04-patterns/search-patterns.md',
        '04-patterns/modules.md',
        '04-patterns/properties.md',
      ];

      for (const doc of requiredDocs) {
        const docPath = path.join(metaSkillsDir, doc);
        expect(fs.existsSync(docPath), `Missing: ${doc}`).toBe(true);
      }
    });

    it('should copy meta-skills to workspace .claude/commands', () => {
      // Simulate installation: copy meta-skills to .claude/commands
      const targetDir = path.join(tempWorkspace, '.claude', 'commands', 'odoo-meta-skills');
      fs.mkdirSync(targetDir, { recursive: true });

      // Copy README
      fs.copyFileSync(
        path.join(metaSkillsDir, 'README.md'),
        path.join(targetDir, 'README.md')
      );

      // Copy fundamentals
      const fundamentalsDir = path.join(targetDir, '01-fundamentals');
      fs.mkdirSync(fundamentalsDir, { recursive: true });
      fs.copyFileSync(
        path.join(metaSkillsDir, '01-fundamentals', 'connection.md'),
        path.join(fundamentalsDir, 'connection.md')
      );

      // Verify installation
      expect(fs.existsSync(path.join(targetDir, 'README.md'))).toBe(true);
      expect(fs.existsSync(path.join(fundamentalsDir, 'connection.md'))).toBe(true);
    });

    it('should create .env file with Odoo credentials', () => {
      const config = getTestConfig();
      const envContent = `# Odoo Connection Configuration
ODOO_URL=${config.url}
ODOO_DB=${config.database}
ODOO_USER=${config.username}
ODOO_PASSWORD=${config.password}
`;
      const envPath = path.join(tempWorkspace, '.env');
      fs.writeFileSync(envPath, envContent);

      expect(fs.existsSync(envPath)).toBe(true);

      // Verify .env can be read
      const content = fs.readFileSync(envPath, 'utf-8');
      expect(content).toContain('ODOO_URL=');
      expect(content).toContain('ODOO_DB=');
    });
  });

  describe('Step 2: Connect to Odoo (as documented)', () => {
    it('should connect using the pattern from connection.md', async () => {
      // This follows the exact pattern from connection.md
      const session = client.getSession();

      expect(session).toBeDefined();
      expect(session?.uid).toBeGreaterThan(0);
      expect(session?.db).toBeDefined();
    });

    it('should handle session information as documented', () => {
      const session = client.getSession();

      // These are the properties documented in connection.md
      expect(session?.uid).toBeDefined(); // User ID (number)
      expect(session?.db).toBeDefined(); // Database name (string)
    });
  });

  describe('Step 3: Introspect res.partner model and name field', () => {
    it('should discover models as documented in discovering-models.md', async () => {
      const models = await introspector.getModels();

      expect(models.length).toBeGreaterThan(0);

      // res.partner should always exist
      const partnerModel = models.find((m) => m.model === 'res.partner');
      expect(partnerModel).toBeDefined();
      expect(partnerModel?.name).toBeDefined();
    });

    it('should get fields for res.partner as documented in analyzing-fields.md', async () => {
      const fields = await introspector.getFields('res.partner');

      expect(fields.length).toBeGreaterThan(0);

      // name field should exist with expected properties
      const nameField = fields.find((f) => f.name === 'name');
      expect(nameField).toBeDefined();
      expect(nameField?.ttype).toBe('char');
      // Note: name field metadata may vary; what matters is it exists and has correct type
      expect(nameField?.field_description).toBeDefined();
    });

    it('should understand field metadata as documented', async () => {
      const fields = await introspector.getFields('res.partner');

      // Find relational fields as documented
      const many2oneFields = fields.filter((f) => f.ttype === 'many2one');
      const one2manyFields = fields.filter((f) => f.ttype === 'one2many');

      // res.partner has parent_id (many2one to self)
      const parentField = many2oneFields.find((f) => f.name === 'parent_id');
      expect(parentField).toBeDefined();
      expect(parentField?.relation).toBe('res.partner');

      // res.partner has child_ids (one2many to self)
      const childField = one2manyFields.find((f) => f.name === 'child_ids');
      expect(childField).toBeDefined();
      expect(childField?.relation).toBe('res.partner');
    });
  });

  describe('Step 4: CRUD Operations (as documented)', () => {
    const createdIds: number[] = [];

    afterAll(async () => {
      // Cleanup created records
      for (const id of createdIds) {
        try {
          await client.unlink('res.partner', id);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it('should create a record following crud-operations.md pattern', async () => {
      const id = await client.create('res.partner', {
        name: `E2E Workflow Test ${Date.now()}`,
        email: 'e2e-test@example.com',
      });
      createdIds.push(id);

      expect(id).toBeGreaterThan(0);
    });

    it('should read a record following the documented pattern', async () => {
      const id = await client.create('res.partner', {
        name: `E2E Read Test ${Date.now()}`,
      });
      createdIds.push(id);

      // Pattern from crud-operations.md: read returns array
      const records = await client.read('res.partner', [id], ['name', 'email']);
      const partner = records[0];

      expect(partner.name).toContain('E2E Read Test');
    });

    it('should search records following search-patterns.md', async () => {
      const id = await client.create('res.partner', {
        name: `E2E Search Test ${Date.now()}`,
        is_company: true,
      });
      createdIds.push(id);

      // Pattern from search-patterns.md
      const results = await client.searchRead(
        'res.partner',
        [['id', '=', id]],
        { fields: ['name', 'is_company'] }
      );

      expect(results.length).toBe(1);
      expect(results[0].is_company).toBe(true);
    });
  });

  describe('Step 5: Verify skill generation capability', () => {
    it('should read skill-format.md and understand structure', () => {
      const skillFormatPath = path.join(
        metaSkillsDir,
        '03-skill-generation',
        'skill-format.md'
      );
      const content = fs.readFileSync(skillFormatPath, 'utf-8');

      // Verify key sections exist
      expect(content).toContain('# SKILL Format');
      expect(content).toContain('## Parameters');
      expect(content).toContain('## Usage');
      expect(content).toContain('## Key Concepts');
    });

    it('should read workflow.md and understand generation process', () => {
      const workflowPath = path.join(
        metaSkillsDir,
        '03-skill-generation',
        'workflow.md'
      );
      const content = fs.readFileSync(workflowPath, 'utf-8');

      // Verify workflow steps are documented
      expect(content).toContain('Step 1');
      expect(content).toContain('introspect');
    });

    it('should have sufficient introspection data to generate a skill', async () => {
      // Get all data needed to generate a "create partner" skill
      const fields = await introspector.getFields('res.partner');

      // Should have writeable fields for skill generation
      const writeableFields = fields.filter((f) => !f.readonly);
      expect(writeableFields.length).toBeGreaterThan(0);

      // Key fields for partner creation should exist
      const nameField = fields.find((f) => f.name === 'name');
      const emailField = fields.find((f) => f.name === 'email');
      const isCompanyField = fields.find((f) => f.name === 'is_company');

      expect(nameField).toBeDefined();
      expect(emailField).toBeDefined();
      expect(isCompanyField).toBeDefined();

      // Should have enough info to document the skill
      expect(nameField?.field_description).toBeDefined();
      expect(nameField?.ttype).toBe('char');
      expect(emailField?.ttype).toBe('char');
      expect(isCompanyField?.ttype).toBe('boolean');
    });
  });

  describe('Cleanup verification', () => {
    it('should be able to logout cleanly', async () => {
      // Create a separate client to test logout
      const config = getTestConfig();
      const testClient = new OdooClient({
        url: config.url,
        database: config.database,
        username: config.username,
        password: config.password,
      });

      await testClient.authenticate();
      expect(testClient.getSession()).toBeDefined();

      await testClient.logout();
      // After logout, session should be cleared or invalid
    });
  });
});
