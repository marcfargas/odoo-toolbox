/**
 * Integration tests for the Odoo testcontainer itself.
 *
 * Tests that our testcontainer module works correctly.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startOdoo, OdooPresets, type StartedOdooContainer } from '../src';

describe('Odoo Testcontainer Basic Functionality', () => {
  let odoo: StartedOdooContainer;

  describe('Basic startup', () => {
    beforeAll(async () => {
      odoo = await startOdoo({
        modules: ['base'],
      });
    }, 300_000); // 5 minutes timeout

    afterAll(async () => {
      await odoo?.cleanup();
    });

    it('should start Odoo successfully', () => {
      expect(odoo.url).toMatch(/^http:\/\/.*:\d+$/);
      expect(odoo.database).toBe('test_odoo');
    });

    it('should provide authenticated client', () => {
      expect(odoo.client).toBeDefined();
      expect(odoo.client.getSession()).toBeTruthy();
    });

    it('should have moduleManager available', () => {
      expect(odoo.moduleManager).toBeDefined();
    });

    it('should be able to create records', async () => {
      const partnerId = await odoo.client.create('res.partner', {
        name: 'Test Partner',
      });
      expect(partnerId).toBeGreaterThan(0);
    });
  });
});

describe('Odoo Presets', () => {
  let odoo: StartedOdooContainer;

  describe('HR preset', () => {
    beforeAll(async () => {
      odoo = await OdooPresets.hr();
    }, 300_000);

    afterAll(async () => {
      await odoo?.cleanup();
    });

    it('should have hr module installed', async () => {
      const isInstalled = await odoo.moduleManager.isModuleInstalled('hr');
      expect(isInstalled).toBe(true);
    });

    it('should have hr_attendance module installed', async () => {
      const isInstalled = await odoo.moduleManager.isModuleInstalled('hr_attendance');
      expect(isInstalled).toBe(true);
    });

    it('should be able to create employees', async () => {
      const employeeId = await odoo.client.create('hr.employee', {
        name: 'Test Employee',
      });
      expect(employeeId).toBeGreaterThan(0);
    });
  });
});
