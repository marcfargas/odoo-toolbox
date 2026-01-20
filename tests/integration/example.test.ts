/**
 * Example integration test for Odoo client
 * 
 * This test demonstrates how to write integration tests against a live Odoo instance.
 * The Docker Compose environment is automatically started by Jest globalSetup.
 */

import { getTestConfig, waitForOdoo, uniqueTestName } from '../helpers/odoo-instance';

describe('OdooClient Integration Tests (Example)', () => {
  beforeAll(async () => {
    // Wait for Odoo to be ready (in case globalSetup is still initializing)
    const config = getTestConfig();
    await waitForOdoo(config.url);
  });

  it('should connect to Odoo test instance', async () => {
    const config = getTestConfig();
    
    // Basic validation
    expect(config.url).toBeTruthy();
    expect(config.database).toBeTruthy();
    expect(config.username).toBeTruthy();
  });

  it('should demonstrate test naming pattern', () => {
    const testName = uniqueTestName('project');
    
    // Test names should be unique and timestamped
    expect(testName).toMatch(/^project_\d+_[a-z0-9]+$/);
  });

  // TODO: Add real RPC tests once OdooClient is implemented
  // Example test structure:
  /*
  it('should search for projects', async () => {
    const client = new OdooClient(getTestConfig());
    await client.authenticate();
    
    const projectIds = await client.search('project.project', []);
    expect(Array.isArray(projectIds)).toBe(true);
    
    await client.logout();
  });

  it('should create and cleanup test records', async () => {
    const client = new OdooClient(getTestConfig());
    await client.authenticate();
    
    const projectName = uniqueTestName('test_project');
    const projectId = await client.create('project.project', {
      name: projectName,
    });
    
    expect(projectId).toBeGreaterThan(0);
    
    // Cleanup
    await client.unlink('project.project', [projectId]);
  });
  */
});
