/**
 * Integration tests for custom addons mounting in Odoo testcontainer.
 *
 * Tests various ways to mount custom addons from local directories.
 */

import path from 'path';
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
        addonsPath: path.resolve('./test-addons'), // absolute path required for Docker on CI
        startupTimeout: 300_000,
      });
    }, 600_000);

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
            source: path.resolve('./oca-addons'), // absolute path required for Docker on CI
            target: '/mnt/oca-addons',
            mode: 'ro',
          },
          {
            source: path.resolve('./custom-addons'), // absolute path required for Docker on CI
            target: '/mnt/custom-addons',
            mode: 'ro',
          },
        ],
        startupTimeout: 300_000,
      });
    }, 600_000);

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
        addonsPath: path.resolve('./oca-server-tools'), // absolute path required for Docker on CI
        startupTimeout: 300_000,
      });
    }, 600_000);

    afterAll(async () => {
      await odoo?.cleanup();
    });

    it('should work with OCA addons', () => {
      expect(odoo.url).toMatch(/^http:\/\/.*:\d+$/);
    });
  });
});
