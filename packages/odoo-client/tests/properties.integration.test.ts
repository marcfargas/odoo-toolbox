import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { OdooClient, ModuleManager } from '../src';
import {
  PropertiesDefinition,
  PropertiesWriteFormat,
  getPropertyValue,
  propertiesToWriteFormat,
  getPropertyDefinition,
} from '../src/types/properties';

/**
 * Properties field integration tests using the project module.
 *
 * Properties fields require a parent model with *_properties_definition
 * and a child model with the corresponding *_properties field.
 *
 * In Odoo 17+, project module provides:
 * - project.project: task_properties_definition
 * - project.task: task_properties
 */
describe('Properties Fields Integration', () => {
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

    // Create a test project
    projectId = await client.create('project.project', {
      name: 'Test Project for Properties',
    });
  });

  afterAll(async () => {
    // Clean up test task if created
    if (taskId) {
      try {
        await client.unlink('project.task', taskId);
      } catch {
        // Ignore cleanup errors
      }
    }

    // Clean up test project
    if (projectId) {
      try {
        await client.unlink('project.project', projectId);
      } catch {
        // Ignore cleanup errors
      }
    }

    // Uninstall project module if we installed it
    if (moduleWasInstalled) {
      try {
        await moduleManager.uninstallModule('project');
      } catch {
        // Ignore cleanup errors
      }
    }

    client.logout();
  });

  describe('PropertiesDefinition', () => {
    it('should create and read property definitions', async () => {
      const propertiesDefinition: PropertiesDefinition = [
        {
          name: 'test_char',
          string: 'Test Character Field',
          type: 'char',
        },
        {
          name: 'test_integer',
          string: 'Test Integer',
          type: 'integer',
        },
        {
          name: 'test_boolean',
          string: 'Test Boolean',
          type: 'boolean',
        },
        {
          name: 'test_selection',
          string: 'Test Selection',
          type: 'selection',
          selection: [
            ['opt1', 'Option 1'],
            ['opt2', 'Option 2'],
          ],
        },
      ];

      // Write definitions to project
      await client.write('project.project', projectId, {
        task_properties_definition: propertiesDefinition,
      });

      // Read back
      const project = await client.read('project.project', projectId, [
        'task_properties_definition',
      ]);

      expect(project[0].task_properties_definition).toBeDefined();
      expect(Array.isArray(project[0].task_properties_definition)).toBe(true);
      expect(project[0].task_properties_definition.length).toBe(4);

      const charDef = project[0].task_properties_definition.find(
        (d: any) => d.name === 'test_char'
      );
      expect(charDef).toBeDefined();
      expect(charDef.type).toBe('char');
      expect(charDef.string).toBe('Test Character Field');
    });
  });

  describe('Properties values', () => {
    it('should create a record with properties', async () => {
      const taskProperties: PropertiesWriteFormat = {
        test_char: 'Hello Properties',
        test_integer: 42,
        test_boolean: true,
        test_selection: 'opt1',
      };

      taskId = await client.create('project.task', {
        name: 'Test Task for Properties',
        project_id: projectId,
        task_properties: taskProperties,
      });

      expect(taskId).toBeGreaterThan(0);

      // Read back
      const task = await client.read('project.task', taskId, ['task_properties']);

      expect(task[0].task_properties).toBeDefined();
      expect(Array.isArray(task[0].task_properties)).toBe(true);
      expect(task[0].task_properties.length).toBe(4);
    });

    it('should update properties', async () => {
      const updatedProperties: PropertiesWriteFormat = {
        test_char: 'Updated Text',
        test_integer: 100,
        test_boolean: false,
        test_selection: 'opt2',
      };

      await client.write('project.task', taskId, {
        task_properties: updatedProperties,
      });

      const task = await client.read('project.task', taskId, ['task_properties']);

      const charValue = getPropertyValue(task[0].task_properties, 'test_char');
      const intValue = getPropertyValue(task[0].task_properties, 'test_integer');
      const boolValue = getPropertyValue(task[0].task_properties, 'test_boolean');
      const selValue = getPropertyValue(task[0].task_properties, 'test_selection');

      expect(charValue).toBe('Updated Text');
      expect(intValue).toBe(100);
      expect(boolValue).toBe(false);
      expect(selValue).toBe('opt2');
    });

    it('should handle partial updates (replaces unspecified with false)', async () => {
      // IMPORTANT: Odoo's behavior is to replace unspecified properties with false
      // To update only some properties, you must read first, modify, then write all
      const task = await client.read('project.task', taskId, ['task_properties']);
      const currentProps = propertiesToWriteFormat(task[0].task_properties);

      // Modify only what we want to change
      currentProps.test_integer = 999;

      await client.write('project.task', taskId, {
        task_properties: currentProps,
      });

      const updatedTask = await client.read('project.task', taskId, ['task_properties']);

      const intValue = getPropertyValue(updatedTask[0].task_properties, 'test_integer');
      const charValue = getPropertyValue(updatedTask[0].task_properties, 'test_char');

      expect(intValue).toBe(999);
      expect(charValue).toBe('Updated Text'); // Preserved because we wrote all properties
    });
  });

  describe('Helper functions', () => {
    it('should extract property value by name', async () => {
      // First ensure we have known properties
      const knownProps: PropertiesWriteFormat = {
        test_char: 'Known Value',
        test_integer: 123,
        test_boolean: true,
        test_selection: 'opt1',
      };

      await client.write('project.task', taskId, {
        task_properties: knownProps,
      });

      const task = await client.read('project.task', taskId, ['task_properties']);

      const value = getPropertyValue(task[0].task_properties, 'test_char');
      expect(value).toBe('Known Value');

      const nonExistent = getPropertyValue(task[0].task_properties, 'non_existent');
      expect(nonExistent).toBeUndefined();
    });

    it('should convert properties to write format', async () => {
      const task = await client.read('project.task', taskId, ['task_properties']);

      const writeFormat = propertiesToWriteFormat(task[0].task_properties);

      expect(writeFormat).toEqual({
        test_char: 'Known Value',
        test_integer: 123,
        test_boolean: true,
        test_selection: 'opt1',
      });
    });

    it('should get property definition by name', async () => {
      const project = await client.read('project.project', projectId, [
        'task_properties_definition',
      ]);

      const charDef = getPropertyDefinition(project[0].task_properties_definition, 'test_char');
      expect(charDef).toBeDefined();
      expect(charDef?.type).toBe('char');
      expect(charDef?.string).toBe('Test Character Field');

      const nonExistent = getPropertyDefinition(
        project[0].task_properties_definition,
        'non_existent'
      );
      expect(nonExistent).toBeUndefined();
    });
  });

  describe('Property type support', () => {
    it('should support float properties', async () => {
      const definitions: PropertiesDefinition = [
        {
          name: 'test_float',
          string: 'Test Float',
          type: 'float',
        },
      ];

      await client.write('project.project', projectId, {
        task_properties_definition: definitions,
      });

      await client.write('project.task', taskId, {
        task_properties: { test_float: 3.14159 },
      });

      const task = await client.read('project.task', taskId, ['task_properties']);
      const floatValue = getPropertyValue(task[0].task_properties, 'test_float');

      expect(floatValue).toBeCloseTo(3.14159, 5);
    });

    it('should support date properties', async () => {
      const definitions: PropertiesDefinition = [
        {
          name: 'test_date',
          string: 'Test Date',
          type: 'date',
        },
      ];

      await client.write('project.project', projectId, {
        task_properties_definition: definitions,
      });

      await client.write('project.task', taskId, {
        task_properties: { test_date: '2024-01-15' },
      });

      const task = await client.read('project.task', taskId, ['task_properties']);
      const dateValue = getPropertyValue(task[0].task_properties, 'test_date');

      expect(dateValue).toBe('2024-01-15');
    });

    it('should support datetime properties', async () => {
      const definitions: PropertiesDefinition = [
        {
          name: 'test_datetime',
          string: 'Test DateTime',
          type: 'datetime',
        },
      ];

      await client.write('project.project', projectId, {
        task_properties_definition: definitions,
      });

      const testDateTime = '2024-01-15 10:30:00';
      await client.write('project.task', taskId, {
        task_properties: { test_datetime: testDateTime },
      });

      const task = await client.read('project.task', taskId, ['task_properties']);
      const datetimeValue = getPropertyValue(task[0].task_properties, 'test_datetime');

      expect(datetimeValue).toBe(testDateTime);
    });
  });
});
