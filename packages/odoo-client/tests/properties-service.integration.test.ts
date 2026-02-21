import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { OdooClient, ModuleManager } from '../src';

/**
 * Properties service integration tests using the project module.
 *
 * Tests the new `client.properties.*` service accessors for safe property updates.
 */
describe('Properties Service Integration', () => {
  const odooUrl = process.env.ODOO_URL || 'http://localhost:8069';
  const odooDb = process.env.ODOO_DB_NAME || 'odoo';
  const odooUser = process.env.ODOO_DB_USER || 'admin';
  const odooPassword = process.env.ODOO_DB_PASSWORD || 'admin';

  let client: OdooClient;
  let moduleManager: ModuleManager;
  let projectId: number;
  let taskId: number;
  let moduleWasInstalled = false;

  beforeAll(async () => {
    client = new OdooClient({
      url: odooUrl,
      database: odooDb,
      username: odooUser,
      password: odooPassword,
    });

    await client.authenticate();
    moduleManager = new ModuleManager(client);

    // Install project module if not already installed
    const isInstalled = await moduleManager.isModuleInstalled('project');
    if (!isInstalled) {
      await moduleManager.installModule('project');
      moduleWasInstalled = true;
    }

    // Create a test project with properties definition
    projectId = await client.create('project.project', {
      name: 'Test Project for Properties Service',
    });

    await client.write('project.project', projectId, {
      task_properties_definition: [
        {
          name: 'priority',
          string: 'Priority',
          type: 'selection',
          selection: [
            ['low', 'Low'],
            ['high', 'High'],
          ],
        },
        {
          name: 'score',
          string: 'Score',
          type: 'integer',
        },
        {
          name: 'active_flag',
          string: 'Active',
          type: 'boolean',
        },
      ],
    });

    // Create test task with initial properties
    taskId = await client.create('project.task', {
      name: 'Test Task',
      project_id: projectId,
      task_properties: {
        priority: 'low',
        score: 50,
        active_flag: true,
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    if (taskId) {
      try {
        await client.unlink('project.task', taskId);
      } catch {
        // Ignore cleanup errors
      }
    }
    if (projectId) {
      try {
        await client.unlink('project.project', projectId);
      } catch {
        // Ignore cleanup errors
      }
    }
    if (moduleWasInstalled) {
      try {
        await moduleManager.uninstallModule('project');
      } catch {
        // Ignore cleanup errors
      }
    }

    client.logout();
  });

  describe('client.properties.updateSafely', () => {
    it('should update single property and preserve others', async () => {
      // Update only priority
      await client.properties.updateSafely('project.task', taskId, 'task_properties', {
        priority: 'high',
      });

      // Read back and verify
      const [task] = await client.read('project.task', [taskId], ['task_properties']);
      const props = Object.fromEntries(task.task_properties.map((p: any) => [p.name, p.value]));

      expect(props.priority).toBe('high'); // Updated
      expect(props.score).toBe(50); // Preserved
      expect(props.active_flag).toBe(true); // Preserved
    });
  });

  describe('client.properties.getCurrentWriteFormat', () => {
    it('should return current properties in write format', async () => {
      const current = await client.properties.getCurrentWriteFormat(
        'project.task',
        taskId,
        'task_properties'
      );

      expect(current).toEqual({
        priority: 'high', // From previous test
        score: 50,
        active_flag: true,
      });
    });
  });

  describe('client.properties.updateSafelyBatch', () => {
    it('should handle empty array gracefully', async () => {
      await expect(
        client.properties.updateSafelyBatch('project.task', [], 'task_properties', {
          priority: 'high',
        })
      ).resolves.toBeUndefined();
    });
  });
});
