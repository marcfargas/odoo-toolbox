/**
 * Integration tests for the Odoo testcontainer itself.
 *
 * Tests that our testcontainer module works correctly.
 *
 * Architecture: both describe blocks share the same container instance.
 * HR modules are installed on-demand in the second block's beforeAll.
 * Cleanup happens once at the end of the second describe block.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getSharedOdooContainer, cleanupSharedOdooContainer } from './shared-odoo-container';
import { type StartedOdooContainer } from '../src';

describe('Odoo Testcontainer Basic Functionality', () => {
  let odoo: StartedOdooContainer;

  beforeAll(async () => {
    odoo = await getSharedOdooContainer();
  }, 300_000); // 5 minutes timeout

  // NOTE: no afterAll cleanup here — handled by the next describe block

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
    // Cleanup
    await odoo.client.unlink('res.partner', [partnerId]);
  });
});

/**
 * Tests that non-base modules can be installed and used.
 *
 * Shares the same container as above; installs hr/hr_attendance on it
 * so we don't need a second container start (~3min extra in CI).
 * Cleanup happens here since this block runs last.
 */
describe('OdooTestContainer with HR modules', () => {
  let odoo: StartedOdooContainer;

  beforeAll(async () => {
    // Re-use the shared container (already running)
    odoo = await getSharedOdooContainer();
    // Install hr modules on demand in the shared running container.
    if (!(await odoo.moduleManager.isModuleInstalled('hr'))) {
      console.log('📦 Installing hr module...');
      await odoo.moduleManager.installModule('hr');
    }
    if (!(await odoo.moduleManager.isModuleInstalled('hr_attendance'))) {
      console.log('📦 Installing hr_attendance module...');
      await odoo.moduleManager.installModule('hr_attendance');
    }
  }, 300_000);

  afterAll(async () => {
    // Cleanup shared container once both describe blocks have finished
    await cleanupSharedOdooContainer();
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
    // Cleanup
    await odoo.client.unlink('hr.employee', [employeeId]);
  });
});
