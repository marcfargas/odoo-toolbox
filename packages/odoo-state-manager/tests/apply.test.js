"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const apply_1 = require("../src/apply");
// Mock OdooClient
class MockOdooClient {
    operations = [];
    idCounter = 100;
    failOn;
    delay = 0;
    async create(model, values, _context = {}) {
        this.recordOperation('create', model, values);
        if (this.failOn?.type === 'create' && this.failOn.model === model) {
            throw new Error(`Mock: create failed for ${model}`);
        }
        await this.sleep();
        return this.idCounter++;
    }
    async write(model, id, values, _context = {}) {
        this.recordOperation('write', model, values);
        if (this.failOn?.type === 'update' && this.failOn.model === model) {
            throw new Error(`Mock: write failed for ${model}`);
        }
        await this.sleep();
        return true;
    }
    async unlink(model, _id) {
        this.recordOperation('unlink', model, {});
        if (this.failOn?.type === 'delete' && this.failOn.model === model) {
            throw new Error(`Mock: unlink failed for ${model}`);
        }
        await this.sleep();
        return true;
    }
    recordOperation(type, model, values) {
        this.operations.push({ type, model, values });
    }
    getOperations() {
        return this.operations;
    }
    setDelay(ms) {
        this.delay = ms;
    }
    async sleep() {
        if (this.delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, this.delay));
        }
    }
}
describe('Apply Module', () => {
    let mockClient;
    beforeEach(() => {
        mockClient = new MockOdooClient();
    });
    describe('applyPlan', () => {
        test('applies a simple create operation', async () => {
            const plan = {
                operations: [
                    {
                        type: 'create',
                        model: 'project.task',
                        id: 'project.task:temp_1',
                        values: { name: 'New Task', priority: 'high' },
                    },
                ],
                metadata: {
                    timestamp: new Date(),
                    affectedModels: new Map([['project.task', { creates: 1, updates: 0, deletes: 0 }]]),
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
            const result = await (0, apply_1.applyPlan)(plan, mockClient);
            expect(result.success).toBe(true);
            expect(result.applied).toBe(1);
            expect(result.failed).toBe(0);
            expect(result.total).toBe(1);
            expect(result.idMapping.has('project.task:temp_1')).toBe(true);
            expect(result.idMapping.get('project.task:temp_1')).toBe(100);
        });
        test('applies multiple operations in order', async () => {
            const plan = {
                operations: [
                    {
                        type: 'create',
                        model: 'project.project',
                        id: 'project.project:temp_1',
                        values: { name: 'New Project' },
                    },
                    {
                        type: 'create',
                        model: 'project.task',
                        id: 'project.task:temp_1',
                        values: { name: 'New Task', project_id: 100 },
                    },
                    {
                        type: 'update',
                        model: 'project.project',
                        id: 'project.project:5',
                        values: { description: 'Updated' },
                    },
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
            const result = await (0, apply_1.applyPlan)(plan, mockClient);
            expect(result.success).toBe(true);
            expect(result.applied).toBe(3);
            expect(result.failed).toBe(0);
            expect(result.operations).toHaveLength(3);
            expect(mockClient.getOperations()).toHaveLength(3);
        });
        test('handles update operations', async () => {
            const plan = {
                operations: [
                    {
                        type: 'update',
                        model: 'project.task',
                        id: 'project.task:5',
                        values: { priority: 'urgent', done: true },
                    },
                ],
                metadata: {
                    timestamp: new Date(),
                    affectedModels: new Map([['project.task', { creates: 0, updates: 1, deletes: 0 }]]),
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
            const result = await (0, apply_1.applyPlan)(plan, mockClient);
            expect(result.success).toBe(true);
            expect(result.applied).toBe(1);
        });
        test('handles delete operations', async () => {
            const plan = {
                operations: [
                    {
                        type: 'delete',
                        model: 'project.task',
                        id: 'project.task:5',
                    },
                ],
                metadata: {
                    timestamp: new Date(),
                    affectedModels: new Map([['project.task', { creates: 0, updates: 0, deletes: 1 }]]),
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
            const result = await (0, apply_1.applyPlan)(plan, mockClient);
            expect(result.success).toBe(true);
            expect(result.applied).toBe(1);
        });
        test('stops on first error when stopOnError=true', async () => {
            mockClient.failOn = { type: 'update', model: 'project.task' };
            const plan = {
                operations: [
                    {
                        type: 'create',
                        model: 'project.project',
                        id: 'project.project:temp_1',
                        values: { name: 'New Project' },
                    },
                    {
                        type: 'update',
                        model: 'project.task',
                        id: 'project.task:5',
                        values: { priority: 'urgent' },
                    },
                    {
                        type: 'delete',
                        model: 'project.task',
                        id: 'project.task:10',
                    },
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
            const result = await (0, apply_1.applyPlan)(plan, mockClient, { stopOnError: true });
            expect(result.success).toBe(false);
            expect(result.applied).toBe(1); // Only first operation succeeded
            expect(result.failed).toBe(1);
            expect(result.operations).toHaveLength(2); // Stopped after error
            expect(result.errors).toBeDefined();
        });
        test('continues on error when stopOnError=false', async () => {
            mockClient.failOn = { type: 'update', model: 'project.task' };
            const plan = {
                operations: [
                    {
                        type: 'create',
                        model: 'project.project',
                        id: 'project.project:temp_1',
                        values: { name: 'New Project' },
                    },
                    {
                        type: 'update',
                        model: 'project.task',
                        id: 'project.task:5',
                        values: { priority: 'urgent' },
                    },
                    {
                        type: 'delete',
                        model: 'project.task',
                        id: 'project.task:10',
                    },
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
            const result = await (0, apply_1.applyPlan)(plan, mockClient, { stopOnError: false });
            expect(result.applied).toBe(2); // Create and delete succeeded
            expect(result.failed).toBe(1); // Update failed
            expect(result.operations).toHaveLength(3); // All operations attempted
        });
        test('calls onProgress callback', async () => {
            const progressCalls = [];
            const plan = {
                operations: [
                    {
                        type: 'create',
                        model: 'project.task',
                        id: 'project.task:temp_1',
                        values: { name: 'Task 1' },
                    },
                    {
                        type: 'create',
                        model: 'project.task',
                        id: 'project.task:temp_2',
                        values: { name: 'Task 2' },
                    },
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
            await (0, apply_1.applyPlan)(plan, mockClient, {
                onProgress: (current, total, opId) => {
                    progressCalls.push([current, total, opId]);
                },
            });
            expect(progressCalls).toHaveLength(2);
            expect(progressCalls[0]).toEqual([1, 2, 'project.task:temp_1']);
            expect(progressCalls[1]).toEqual([2, 2, 'project.task:temp_2']);
        });
        test('calls onOperationComplete callback', async () => {
            const completedOps = [];
            const plan = {
                operations: [
                    {
                        type: 'create',
                        model: 'project.task',
                        id: 'project.task:temp_1',
                        values: { name: 'Task 1' },
                    },
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
            await (0, apply_1.applyPlan)(plan, mockClient, {
                onOperationComplete: (result) => {
                    completedOps.push(result);
                },
            });
            expect(completedOps).toHaveLength(1);
            expect(completedOps[0].success).toBe(true);
            expect(completedOps[0].operation.type).toBe('create');
        });
        test('tracks execution timing', async () => {
            mockClient.setDelay(10);
            const plan = {
                operations: [
                    {
                        type: 'create',
                        model: 'project.task',
                        id: 'project.task:temp_1',
                        values: { name: 'Task' },
                    },
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
            const result = await (0, apply_1.applyPlan)(plan, mockClient);
            // Use lenient threshold due to timing variability in CI
            expect(result.duration).toBeGreaterThanOrEqual(5);
            expect(result.operations[0].duration).toBeGreaterThanOrEqual(5);
        });
        test('respects maxOperations limit', async () => {
            const operations = Array.from({ length: 5 }, (_, i) => ({
                type: 'create',
                model: 'project.task',
                id: `project.task:temp_${i + 1}`,
                values: { name: `Task ${i + 1}` },
            }));
            const plan = {
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
            const result = await (0, apply_1.applyPlan)(plan, mockClient, { maxOperations: 3 });
            expect(result.success).toBe(false);
            expect(result.failed).toBe(5);
            expect(result.applied).toBe(0);
            expect(result.errors).toBeDefined();
            expect(result.errors[0]).toContain('maxOperations limit');
        });
        test('validates operations before execution', async () => {
            const plan = {
                operations: [
                    {
                        type: 'update',
                        model: 'project.task',
                        id: 'project.task:temp_999', // Temp ID for non-create operation
                        values: { name: 'Invalid' },
                    },
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
            const result = await (0, apply_1.applyPlan)(plan, mockClient, { validate: true });
            expect(result.success).toBe(false);
            expect(result.failed).toBe(1);
            expect(result.errors).toBeDefined();
        });
        test('resolves ID references in values', async () => {
            const plan = {
                operations: [
                    {
                        type: 'create',
                        model: 'project.project',
                        id: 'project.project:temp_1',
                        values: { name: 'New Project' },
                    },
                    {
                        type: 'create',
                        model: 'project.task',
                        id: 'project.task:temp_1',
                        values: { name: 'New Task', project_id: 'project.project:temp_1' },
                    },
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
            const result = await (0, apply_1.applyPlan)(plan, mockClient);
            expect(result.success).toBe(true);
            // Second operation should have resolved the reference to actual ID
            const ops = mockClient.getOperations();
            expect(ops[1].values.project_id).toBe(100);
        });
        test('merges base context with operation context', async () => {
            const plan = {
                operations: [
                    {
                        type: 'create',
                        model: 'project.task',
                        id: 'project.task:temp_1',
                        values: { name: 'Task', tracking_disable: true },
                    },
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
            const result = await (0, apply_1.applyPlan)(plan, mockClient, {
                context: { lang: 'en_US' },
            });
            expect(result.success).toBe(true);
        });
    });
    describe('dryRunPlan', () => {
        test('validates plan without making changes', async () => {
            const plan = {
                operations: [
                    {
                        type: 'create',
                        model: 'project.task',
                        id: 'project.task:temp_1',
                        values: { name: 'New Task' },
                    },
                    {
                        type: 'update',
                        model: 'project.task',
                        id: 'project.task:5',
                        values: { priority: 'urgent' },
                    },
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
            const result = await (0, apply_1.dryRunPlan)(plan, mockClient);
            expect(result.success).toBe(true);
            expect(result.applied).toBe(2);
            // No actual operations should have been recorded
            expect(mockClient.getOperations()).toHaveLength(0);
        });
        test('detects validation errors in dry-run', async () => {
            const plan = {
                operations: [
                    {
                        type: 'update',
                        model: 'project.task',
                        id: 'project.task:temp_999', // Invalid temp ID
                        values: { name: 'Invalid' },
                    },
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
            const result = await (0, apply_1.dryRunPlan)(plan, mockClient);
            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
        });
    });
    describe('Operation result details', () => {
        test('includes operation duration in result', async () => {
            mockClient.setDelay(5);
            const plan = {
                operations: [
                    {
                        type: 'create',
                        model: 'project.task',
                        id: 'project.task:temp_1',
                        values: { name: 'Task' },
                    },
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
            const result = await (0, apply_1.applyPlan)(plan, mockClient);
            expect(result.operations[0].duration).toBeGreaterThanOrEqual(5);
        });
        test('includes actual ID in result for created records', async () => {
            const plan = {
                operations: [
                    {
                        type: 'create',
                        model: 'project.task',
                        id: 'project.task:temp_1',
                        values: { name: 'Task' },
                    },
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
            const result = await (0, apply_1.applyPlan)(plan, mockClient);
            expect(result.operations[0].actualId).toBe(100);
        });
        test('includes actual ID for updates and deletes', async () => {
            const plan = {
                operations: [
                    {
                        type: 'update',
                        model: 'project.task',
                        id: 'project.task:5',
                        values: { priority: 'high' },
                    },
                    {
                        type: 'delete',
                        model: 'project.task',
                        id: 'project.task:10',
                    },
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
            const result = await (0, apply_1.applyPlan)(plan, mockClient);
            expect(result.operations[0].actualId).toBe(5);
            expect(result.operations[1].actualId).toBe(10);
        });
    });
});
//# sourceMappingURL=apply.test.js.map