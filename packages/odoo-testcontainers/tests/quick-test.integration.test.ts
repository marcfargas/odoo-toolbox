/**
 * Quick test to verify testcontainers work at all.
 * This is a minimal test to check if the approach is viable.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startOdoo } from '../src';

describe('Quick Testcontainer Smoke Test', () => {
  it.skip('should demonstrate the API (no actual containers)', () => {
    // This just shows what the API would look like
    expect(startOdoo).toBeDefined();
  });
});

describe('Actual Container Test', () => {
  let odoo: any;

  beforeAll(async () => {
    console.log('🚀 Starting testcontainer...');
    odoo = await startOdoo({
      modules: ['base'], // Minimal modules
    });
    console.log('✅ Testcontainer ready');
  }, 300_000); // 5 minutes

  afterAll(async () => {
    console.log('🧹 Cleaning up...');
    await odoo?.cleanup();
    console.log('✅ Cleanup complete');
  });

  it('should start successfully', () => {
    expect(odoo.url).toMatch(/^http:\/\/.*:\d+$/);
    expect(odoo.client).toBeDefined();
  });

  it('should create a basic record', async () => {
    const partnerId = await odoo.client.create('res.partner', {
      name: 'Test Partner',
    });
    expect(partnerId).toBeGreaterThan(0);
  });
});
