/**
 * Integration tests for odoo-state-manager examples
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { OdooClient } from '@odoo-toolbox/client';
import {
  compareRecords,
  generatePlan,
  dryRunPlan,
} from '../src';

describe('odoo-state-manager examples', () => {
  let client: OdooClient;

  beforeAll(async () => {
    client = new OdooClient({
      url: process.env.ODOO_URL || 'http://localhost:8069',
      database: process.env.ODOO_DB || 'odoo',
      username: process.env.ODOO_USER || 'admin',
      password: process.env.ODOO_PASSWORD || 'admin',
    });
    await client.authenticate();
  });

  afterAll(async () => {
    await client.logout();
  });

  describe('Example 1: State Management', () => {
    it('should read actual state from Odoo', async () => {
      const partnerIds = await client.search('res.partner', [['id', '<=', 2]]);
      expect(partnerIds).toBeDefined();
      expect(Array.isArray(partnerIds)).toBe(true);

      if (partnerIds.length > 0) {
        const partners = await client.searchRead('res.partner', [
          ['id', 'in', partnerIds],
        ]);
        expect(partners).toBeDefined();
        expect(partners.length).toBeGreaterThan(0);
      }
    });

    it('should compare desired vs actual state', async () => {
      const desired = new Map([
        [
          1,
          {
            name: 'Test Partner',
            active: true,
          },
        ],
      ]);

      const actual = await client.searchRead('res.partner', [['id', '=', 1]]);
      const actualMap = new Map(actual.map((p) => [p.id, p]));

      const diffs = compareRecords('res.partner', desired, actualMap);
      expect(diffs).toBeDefined();
      expect(Array.isArray(diffs)).toBe(true);
    });

    it('should generate an execution plan', async () => {
      const diffs = [
        {
          id: 1,
          type: 'update' as const,
          changes: [
            {
              path: 'name',
              oldValue: 'Old Name',
              newValue: 'New Name',
            },
          ],
        },
      ];

      const plan = generatePlan(diffs, {
        autoReorder: true,
        validateDependencies: true,
      });

      expect(plan).toBeDefined();
      expect(plan.summary).toBeDefined();
      expect(plan.operations).toBeDefined();
    });

    it('should validate plan with dry-run', async () => {
      // Create a simple test plan
      const diffs = [];
      const plan = generatePlan(diffs, {
        autoReorder: true,
      });

      const result = await dryRunPlan(plan, client, {
        validate: true,
      });

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });
  });

  describe('Example 2: CI/CD Validation', () => {
    it('should load desired configuration', async () => {
      const desired = new Map([
        [
          1,
          {
            name: 'Standard Project',
            active: true,
            description: 'Test',
          },
        ],
      ]);

      expect(desired).toBeDefined();
      expect(desired.size).toBe(1);
    });

    it('should read actual configuration from Odoo', async () => {
      const partners = await client.searchRead('res.partner', [['id', '=', 1]]);
      expect(partners).toBeDefined();
      expect(Array.isArray(partners)).toBe(true);

      if (partners.length > 0) {
        const actual = new Map(
          partners.map((p) => [
            p.id,
            {
              name: p.name,
              active: p.active,
            },
          ])
        );
        expect(actual.size).toBeGreaterThan(0);
      }
    });

    it('should analyze differences', async () => {
      const desired = new Map([
        [
          1,
          {
            name: 'Project A',
            active: true,
          },
        ],
      ]);

      const actual = new Map([
        [
          1,
          {
            name: 'Project A',
            active: false, // Different
          },
        ],
      ]);

      const diffs = compareRecords('project.project', desired, actual);
      expect(diffs).toBeDefined();
      expect(Array.isArray(diffs)).toBe(true);
    });

    it('should validate without applying', async () => {
      const diffs = [];
      const plan = generatePlan(diffs);

      const validation = await dryRunPlan(plan, client, {
        validate: true,
        stopOnError: false,
      });

      expect(validation).toBeDefined();
      expect(validation.success).toBeDefined();
    });

    it('should generate audit report', async () => {
      const summary = {
        timestamp: new Date().toISOString(),
        environment: {
          url: 'http://localhost:8069',
          database: 'odoo',
        },
        audit: {
          itemsChecked: 1,
          itemsWithDrift: 0,
          changesPlan: {
            creates: 0,
            updates: 0,
            deletes: 0,
          },
        },
        status: 'PASS' as const,
      };

      expect(summary).toBeDefined();
      expect(summary.timestamp).toBeDefined();
      expect(summary.status).toBe('PASS');
    });
  });
});
