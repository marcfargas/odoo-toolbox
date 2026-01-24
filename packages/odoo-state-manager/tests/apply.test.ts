/**
 * Tests for the Apply module.
 * 
 * Tests cover:
 * - Basic operation execution (create, update, delete)
 * - ID mapping for created records
 * - Error handling and validation
 * - Dry-run mode
 * - Progress callbacks
 * - Reference resolution
 */

import { ExecutionPlan, Operation } from '../src/plan/types';
import { applyPlan, dryRunPlan } from '../src/apply';

// Mock OdooClient
class MockOdooClient {
  private operations: any[] = [];
  private idCounter = 100;
  failOn?: { type: string; model: string };
  delay = 0;

  async create(
    model: string,
    values: Record<string, any>,
    _context: Record<string, any> = {}
  ): Promise<number> {
    this.recordOperation('create', model, values);
    if (this.failOn?.type === 'create' && this.failOn.model === model) {
      throw new Error(`Mock: create failed for ${model}`);
    }
    await this.sleep();
    return this.idCounter++;
  }

  async write(
    model: string,
    id: number | number[],
    values: Record<string, any>,
    _context: Record<string, any> = {}
  ): Promise<boolean> {
    this.recordOperation('write', model, values);
    if (this.failOn?.type === 'update' && this.failOn.model === model) {
      throw new Error(`Mock: write failed for ${model}`);
    }
    await this.sleep();
    return true;
  }

  async unlink(model: string, _id: number | number[]): Promise<boolean> {
    this.recordOperation('unlink', model, {});
    if (this.failOn?.type === 'delete' && this.failOn.model === model) {
      throw new Error(`Mock: unlink failed for ${model}`);
    }
    await this.sleep();
    return true;
  }

  private recordOperation(type: string, model: string, values: any) {
    this.operations.push({ type, model, values });
  }

  getOperations() {
    return this.operations;
  }

  setDelay(ms: number) {
    this.delay = ms;
  }

  private async sleep() {
    if (this.delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delay));
    }
  }
}

describe('Apply Module', () => {
  let mockClient: MockOdooClient;

  beforeEach(() => {
    mockClient = new MockOdooClient();
  });

  describe('applyPlan', () => {
    test('applies a simple create operation', async () => {
      const plan: ExecutionPlan = {
        operations: [
          {
            type: 'create',
            model: 'project.task',
            id: 'project.task:temp_1',
            values: { name: 'New Task', priority: 'high' },
          } as Operation,
        ],
        metadata: {
          timestamp: new Date(),
          affectedModels: new Map([
            ['project.task', { creates: 1, updates: 0, deletes: 0 }],
          ]),
          totalChanges: 1,
        },
        summary: {
          totalOperations: 1,
          creates: 1,
          updates: 0,
          deletes: 0,
          isEmpty: false,
          hasErrors: false,
        },
      };

      const result = await applyPlan(plan, mockClient as any);

      expect(result.success).toBe(true);
      expect(result.applied).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.total).toBe(1);
      expect(result.idMapping.has('project.task:temp_1')).toBe(true);
      expect(result.idMapping.get('project.task:temp_1')).toBe(100);
    });

    test('applies multiple operations in order', async () => {
      const plan: ExecutionPlan = {
        operations: [
          {
            type: 'create',
            model: 'project.project',
            id: 'project.project:temp_1',
            values: { name: 'New Project' },
          } as Operation,
          {
            type: 'create',
            model: 'project.task',
            id: 'project.task:temp_1',
            values: { name: 'New Task', project_id: 100 },
          } as Operation,
          {
            type: 'update',
            model: 'project.project',
            id: 'project.project:5',
            values: { description: 'Updated' },
          } as Operation,
        ],
        metadata: {
          timestamp: new Date(),
          affectedModels: new Map([
            ['project.project', { creates: 1, updates: 1, deletes: 0 }],
            ['project.task', { creates: 1, updates: 0, deletes: 0 }],
          ]),
          totalChanges: 3,
        },
        summary: {
          totalOperations: 3,
          creates: 2,
          updates: 1,
          deletes: 0,
          isEmpty: false,
          hasErrors: false,
        },
      };

      const result = await applyPlan(plan, mockClient as any);

      expect(result.success).toBe(true);
      expect(result.applied).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.operations).toHaveLength(3);
      expect(mockClient.getOperations()).toHaveLength(3);
    });

    test('handles update operations', async () => {
      const plan: ExecutionPlan = {
        operations: [
          {
            type: 'update',
            model: 'project.task',
            id: 'project.task:5',
            values: { priority: 'urgent', done: true },
          } as Operation,
        ],
        metadata: {
          timestamp: new Date(),
          affectedModels: new Map([
            ['project.task', { creates: 0, updates: 1, deletes: 0 }],
          ]),
          totalChanges: 1,
        },
        summary: {
          totalOperations: 1,
          creates: 0,
          updates: 1,
          deletes: 0,
          isEmpty: false,
          hasErrors: false,
        },
      };

      const result = await applyPlan(plan, mockClient as any);

      expect(result.success).toBe(true);
      expect(result.applied).toBe(1);
    });

    test('handles delete operations', async () => {
      const plan: ExecutionPlan = {
        operations: [
          {
            type: 'delete',
            model: 'project.task',
            id: 'project.task:5',
          } as Operation,
        ],
        metadata: {
          timestamp: new Date(),
          affectedModels: new Map([
            ['project.task', { creates: 0, updates: 0, deletes: 1 }],
          ]),
          totalChanges: 1,
        },
        summary: {
          totalOperations: 1,
          creates: 0,
          updates: 0,
          deletes: 1,
          isEmpty: false,
          hasErrors: false,
        },
      };

      const result = await applyPlan(plan, mockClient as any);

      expect(result.success).toBe(true);
      expect(result.applied).toBe(1);
    });

    test('stops on first error when stopOnError=true', async () => {
      mockClient.failOn = { type: 'update', model: 'project.task' };

      const plan: ExecutionPlan = {
        operations: [
          {
            type: 'create',
            model: 'project.project',
            id: 'project.project:temp_1',
            values: { name: 'New Project' },
          } as Operation,
          {
            type: 'update',
            model: 'project.task',
            id: 'project.task:5',
            values: { priority: 'urgent' },
          } as Operation,
          {
            type: 'delete',
            model: 'project.task',
            id: 'project.task:10',
          } as Operation,
        ],
        metadata: {
          timestamp: new Date(),
          affectedModels: new Map(),
          totalChanges: 3,
        },
        summary: {
          totalOperations: 3,
          creates: 1,
          updates: 1,
          deletes: 1,
          isEmpty: false,
          hasErrors: false,
        },
      };

      const result = await applyPlan(plan, mockClient as any, { stopOnError: true });

      expect(result.success).toBe(false);
      expect(result.applied).toBe(1); // Only first operation succeeded
      expect(result.failed).toBe(1);
      expect(result.operations).toHaveLength(2); // Stopped after error
      expect(result.errors).toBeDefined();
    });

    test('continues on error when stopOnError=false', async () => {
      mockClient.failOn = { type: 'update', model: 'project.task' };

      const plan: ExecutionPlan = {
        operations: [
          {
            type: 'create',
            model: 'project.project',
            id: 'project.project:temp_1',
            values: { name: 'New Project' },
          } as Operation,
          {
            type: 'update',
            model: 'project.task',
            id: 'project.task:5',
            values: { priority: 'urgent' },
          } as Operation,
          {
            type: 'delete',
            model: 'project.task',
            id: 'project.task:10',
          } as Operation,
        ],
        metadata: {
          timestamp: new Date(),
          affectedModels: new Map(),
          totalChanges: 3,
        },
        summary: {
          totalOperations: 3,
          creates: 1,
          updates: 1,
          deletes: 1,
          isEmpty: false,
          hasErrors: false,
        },
      };

      const result = await applyPlan(plan, mockClient as any, { stopOnError: false });

      expect(result.applied).toBe(2); // Create and delete succeeded
      expect(result.failed).toBe(1); // Update failed
      expect(result.operations).toHaveLength(3); // All operations attempted
    });

    test('calls onProgress callback', async () => {
      const progressCalls: Array<[number, number, string]> = [];
      const plan: ExecutionPlan = {
        operations: [
          {
            type: 'create',
            model: 'project.task',
            id: 'project.task:temp_1',
            values: { name: 'Task 1' },
          } as Operation,
          {
            type: 'create',
            model: 'project.task',
            id: 'project.task:temp_2',
            values: { name: 'Task 2' },
          } as Operation,
        ],
        metadata: {
          timestamp: new Date(),
          affectedModels: new Map(),
          totalChanges: 2,
        },
        summary: {
          totalOperations: 2,
          creates: 2,
          updates: 0,
          deletes: 0,
          isEmpty: false,
          hasErrors: false,
        },
      };

      await applyPlan(plan, mockClient as any, {
        onProgress: (current: number, total: number, opId: string) => {
          progressCalls.push([current, total, opId]);
        },
      });

      expect(progressCalls).toHaveLength(2);
      expect(progressCalls[0]).toEqual([1, 2, 'project.task:temp_1']);
      expect(progressCalls[1]).toEqual([2, 2, 'project.task:temp_2']);
    });

    test('calls onOperationComplete callback', async () => {
      const completedOps: any[] = [];
      const plan: ExecutionPlan = {
        operations: [
          {
            type: 'create',
            model: 'project.task',
            id: 'project.task:temp_1',
            values: { name: 'Task 1' },
          } as Operation,
        ],
        metadata: {
          timestamp: new Date(),
          affectedModels: new Map(),
          totalChanges: 1,
        },
        summary: {
          totalOperations: 1,
          creates: 1,
          updates: 0,
          deletes: 0,
          isEmpty: false,
          hasErrors: false,
        },
      };

      await applyPlan(plan, mockClient as any, {
        onOperationComplete: (result: any) => {
          completedOps.push(result);
        },
      });

      expect(completedOps).toHaveLength(1);
      expect(completedOps[0].success).toBe(true);
      expect(completedOps[0].operation.type).toBe('create');
    });

    test('tracks execution timing', async () => {
      mockClient.setDelay(10);

      const plan: ExecutionPlan = {
        operations: [
          {
            type: 'create',
            model: 'project.task',
            id: 'project.task:temp_1',
            values: { name: 'Task' },
          } as Operation,
        ],
        metadata: {
          timestamp: new Date(),
          affectedModels: new Map(),
          totalChanges: 1,
        },
        summary: {
          totalOperations: 1,
          creates: 1,
          updates: 0,
          deletes: 0,
          isEmpty: false,
          hasErrors: false,
        },
      };

      const result = await applyPlan(plan, mockClient as any);

      // Allow some timing variance in CI environments
      expect(result.duration).toBeGreaterThanOrEqual(8);
      expect(result.operations[0].duration).toBeGreaterThanOrEqual(8);
    });

    test('respects maxOperations limit', async () => {
      const operations = Array.from({ length: 5 }, (_, i) => ({
        type: 'create' as const,
        model: 'project.task',
        id: `project.task:temp_${i + 1}`,
        values: { name: `Task ${i + 1}` },
      }));

      const plan: ExecutionPlan = {
        operations,
        metadata: {
          timestamp: new Date(),
          affectedModels: new Map(),
          totalChanges: 5,
        },
        summary: {
          totalOperations: 5,
          creates: 5,
          updates: 0,
          deletes: 0,
          isEmpty: false,
          hasErrors: false,
        },
      };

      const result = await applyPlan(plan, mockClient as any, { maxOperations: 3 });

      expect(result.success).toBe(false);
      expect(result.failed).toBe(5);
      expect(result.applied).toBe(0);
      expect(result.errors).toBeDefined();
      expect(result.errors![0]).toContain('maxOperations limit');
    });

    test('validates operations before execution', async () => {
      const plan: ExecutionPlan = {
        operations: [
          {
            type: 'update',
            model: 'project.task',
            id: 'project.task:temp_999', // Temp ID for non-create operation
            values: { name: 'Invalid' },
          } as Operation,
        ],
        metadata: {
          timestamp: new Date(),
          affectedModels: new Map(),
          totalChanges: 1,
        },
        summary: {
          totalOperations: 1,
          creates: 0,
          updates: 1,
          deletes: 0,
          isEmpty: false,
          hasErrors: false,
        },
      };

      const result = await applyPlan(plan, mockClient as any, { validate: true });

      expect(result.success).toBe(false);
      expect(result.failed).toBe(1);
      expect(result.errors).toBeDefined();
    });

    test('resolves ID references in values', async () => {
      const plan: ExecutionPlan = {
        operations: [
          {
            type: 'create',
            model: 'project.project',
            id: 'project.project:temp_1',
            values: { name: 'New Project' },
          } as Operation,
          {
            type: 'create',
            model: 'project.task',
            id: 'project.task:temp_1',
            values: { name: 'New Task', project_id: 'project.project:temp_1' },
          } as Operation,
        ],
        metadata: {
          timestamp: new Date(),
          affectedModels: new Map(),
          totalChanges: 2,
        },
        summary: {
          totalOperations: 2,
          creates: 2,
          updates: 0,
          deletes: 0,
          isEmpty: false,
          hasErrors: false,
        },
      };

      const result = await applyPlan(plan, mockClient as any);

      expect(result.success).toBe(true);
      // Second operation should have resolved the reference to actual ID
      const ops = mockClient.getOperations();
      expect(ops[1].values.project_id).toBe(100);
    });

    test('merges base context with operation context', async () => {
      const plan: ExecutionPlan = {
        operations: [
          {
            type: 'create',
            model: 'project.task',
            id: 'project.task:temp_1',
            values: { name: 'Task', tracking_disable: true },
          } as Operation,
        ],
        metadata: {
          timestamp: new Date(),
          affectedModels: new Map(),
          totalChanges: 1,
        },
        summary: {
          totalOperations: 1,
          creates: 1,
          updates: 0,
          deletes: 0,
          isEmpty: false,
          hasErrors: false,
        },
      };

      // Context should be passed to client.create()
      // This test mainly validates that no errors occur
      const result = await applyPlan(plan, mockClient as any, {
        context: { lang: 'en_US' },
      });

      expect(result.success).toBe(true);
    });
  });

  describe('dryRunPlan', () => {
    test('validates plan without making changes', async () => {
      const plan: ExecutionPlan = {
        operations: [
          {
            type: 'create',
            model: 'project.task',
            id: 'project.task:temp_1',
            values: { name: 'New Task' },
          } as Operation,
          {
            type: 'update',
            model: 'project.task',
            id: 'project.task:5',
            values: { priority: 'urgent' },
          } as Operation,
        ],
        metadata: {
          timestamp: new Date(),
          affectedModels: new Map(),
          totalChanges: 2,
        },
        summary: {
          totalOperations: 2,
          creates: 1,
          updates: 1,
          deletes: 0,
          isEmpty: false,
          hasErrors: false,
        },
      };

      const result = await dryRunPlan(plan, mockClient as any);

      expect(result.success).toBe(true);
      expect(result.applied).toBe(2);
      // No actual operations should have been recorded
      expect(mockClient.getOperations()).toHaveLength(0);
    });

    test('detects validation errors in dry-run', async () => {
      const plan: ExecutionPlan = {
        operations: [
          {
            type: 'update',
            model: 'project.task',
            id: 'project.task:temp_999', // Invalid temp ID
            values: { name: 'Invalid' },
          } as Operation,
        ],
        metadata: {
          timestamp: new Date(),
          affectedModels: new Map(),
          totalChanges: 1,
        },
        summary: {
          totalOperations: 1,
          creates: 0,
          updates: 1,
          deletes: 0,
          isEmpty: false,
          hasErrors: false,
        },
      };

      const result = await dryRunPlan(plan, mockClient as any);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('Operation result details', () => {
    test('includes operation duration in result', async () => {
      mockClient.setDelay(5);

      const plan: ExecutionPlan = {
        operations: [
          {
            type: 'create',
            model: 'project.task',
            id: 'project.task:temp_1',
            values: { name: 'Task' },
          } as Operation,
        ],
        metadata: {
          timestamp: new Date(),
          affectedModels: new Map(),
          totalChanges: 1,
        },
        summary: {
          totalOperations: 1,
          creates: 1,
          updates: 0,
          deletes: 0,
          isEmpty: false,
          hasErrors: false,
        },
      };

      const result = await applyPlan(plan, mockClient as any);

      expect(result.operations[0].duration).toBeGreaterThanOrEqual(5);
    });

    test('includes actual ID in result for created records', async () => {
      const plan: ExecutionPlan = {
        operations: [
          {
            type: 'create',
            model: 'project.task',
            id: 'project.task:temp_1',
            values: { name: 'Task' },
          } as Operation,
        ],
        metadata: {
          timestamp: new Date(),
          affectedModels: new Map(),
          totalChanges: 1,
        },
        summary: {
          totalOperations: 1,
          creates: 1,
          updates: 0,
          deletes: 0,
          isEmpty: false,
          hasErrors: false,
        },
      };

      const result = await applyPlan(plan, mockClient as any);

      expect(result.operations[0].actualId).toBe(100);
    });

    test('includes actual ID for updates and deletes', async () => {
      const plan: ExecutionPlan = {
        operations: [
          {
            type: 'update',
            model: 'project.task',
            id: 'project.task:5',
            values: { priority: 'high' },
          } as Operation,
          {
            type: 'delete',
            model: 'project.task',
            id: 'project.task:10',
          } as Operation,
        ],
        metadata: {
          timestamp: new Date(),
          affectedModels: new Map(),
          totalChanges: 2,
        },
        summary: {
          totalOperations: 2,
          creates: 0,
          updates: 1,
          deletes: 1,
          isEmpty: false,
          hasErrors: false,
        },
      };

      const result = await applyPlan(plan, mockClient as any);

      expect(result.operations[0].actualId).toBe(5);
      expect(result.operations[1].actualId).toBe(10);
    });
  });
});
