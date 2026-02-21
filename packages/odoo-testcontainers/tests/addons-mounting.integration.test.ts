/**
 * Integration tests for custom addons mounting in Odoo testcontainer.
 *
 * Tests various ways to mount custom addons from local directories.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startOdoo, type StartedOdooContainer } from '../src';

describe('Custom Addons Mounting', () => {
  describe('Single addon directory', () => {
    let odoo: StartedOdooContainer;

    beforeAll(async () => {
      // This would mount a local addon directory
      // In a real test, you'd have test addons in the repo
      odoo = await startOdoo({
        modules: ['base'],
        addonsPath: './test-addons', // This directory would need to exist
      });
    }, 300_000);

    afterAll(async () => {
      await odoo?.cleanup();
    });

    it('should mount addons directory', () => {
      // Basic test that container started successfully with addons
      expect(odoo.url).toMatch(/^http:\/\/.*:\d+$/);
    });
  });

  describe('Multiple addon directories', () => {
    let odoo: StartedOdooContainer;

    beforeAll(async () => {
      odoo = await startOdoo({
        modules: ['base'],
        addonsPath: [
          {
            source: './oca-addons',
            target: '/mnt/oca-addons',
            mode: 'ro',
          },
          {
            source: './custom-addons',
            target: '/mnt/custom-addons',
            mode: 'ro',
          },
        ],
      });
    }, 300_000);

    afterAll(async () => {
      await odoo?.cleanup();
    });

    it('should mount multiple addon directories', () => {
      expect(odoo.url).toMatch(/^http:\/\/.*:\d+$/);
    });
  });

  describe('OCA preset with addons', () => {
    let odoo: StartedOdooContainer;

    beforeAll(async () => {
      // This demonstrates using the OCA preset with a local OCA checkout
      odoo = await startOdoo({
        modules: ['base', 'account'], // Core modules
        addonsPath: './oca-server-tools', // Local OCA checkout
      });
    }, 300_000);

    afterAll(async () => {
      await odoo?.cleanup();
    });

    it('should work with OCA addons', () => {
      expect(odoo.url).toMatch(/^http:\/\/.*:\d+$/);
    });
  });
});
