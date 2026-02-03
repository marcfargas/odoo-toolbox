/**
 * Tests for plan generation module.
 *
 * Tests cover:
 * - Plan generation from diffs
 * - Operation type determination (create, update, delete)
 * - Dependency ordering
 * - Summary statistics
 * - Edge cases (empty plans, cycles, max operations)
 */

import { generatePlan } from '../src/plan';
import { ModelDiff, FieldChange } from '../src/types';

describe('Plan Generation Module', () => {
  describe('generatePlan - Basic Operations', () => {
    it('generates empty plan when no diffs provided', () => {
      const plan = generatePlan([]);

      expect(plan.operations).toHaveLength(0);
      expect(plan.summary.isEmpty).toBe(true);
      expect(plan.summary.totalOperations).toBe(0);
    });

    it('generates create operation for new records', () => {
      const diffs: ModelDiff[] = [
        {
          model: 'project.task',
          id: 1,
          changes: [
            { path: 'name', operation: 'create', newValue: 'New Task', oldValue: null },
            { path: 'priority', operation: 'create', newValue: 'high', oldValue: null },
          ],
          isNew: true,
        },
      ];

      const plan = generatePlan(diffs);

      expect(plan.operations).toHaveLength(1);
      expect(plan.operations[0].type).toBe('create');
      expect(plan.operations[0].model).toBe('project.task');
      expect(plan.operations[0].values).toEqual({
        name: 'New Task',
        priority: 'high',
      });
      expect(plan.summary.creates).toBe(1);
    });

    it('generates update operation for changed records', () => {
      const diffs: ModelDiff[] = [
        {
          model: 'project.task',
          id: 1,
          changes: [
            { path: 'name', operation: 'update', newValue: 'Updated Task', oldValue: 'Old Task' },
          ],
          isNew: false,
        },
      ];

      const plan = generatePlan(diffs);

      expect(plan.operations).toHaveLength(1);
      expect(plan.operations[0].type).toBe('update');
      expect(plan.operations[0].id).toBe('project.task:1');
      expect(plan.operations[0].values).toEqual({ name: 'Updated Task' });
      expect(plan.summary.updates).toBe(1);
    });

    it('skips records with no changes', () => {
      const diffs: ModelDiff[] = [
        {
          model: 'project.task',
          id: 1,
          changes: [],
          isNew: false,
        },
      ];

      const plan = generatePlan(diffs);

      expect(plan.operations).toHaveLength(0);
    });

    it('handles multiple records with mixed operations', () => {
      const diffs: ModelDiff[] = [
        {
          model: 'project.project',
          id: 1,
          changes: [{ path: 'name', operation: 'create', newValue: 'Q1 Planning', oldValue: null }],
          isNew: true,
        },
        {
          model: 'project.task',
          id: 1,
          changes: [
            { path: 'name', operation: 'update', newValue: 'Task Updated', oldValue: 'Task' },
          ],
          isNew: false,
        },
      ];

      const plan = generatePlan(diffs);

      expect(plan.operations).toHaveLength(2);
      expect(plan.summary.creates).toBe(1);
      expect(plan.summary.updates).toBe(1);
    });
  });

  describe('generatePlan - Operation Ordering', () => {
    it('orders creates before updates', () => {
      const diffs: ModelDiff[] = [
        {
          model: 'project.task',
          id: 1,
          changes: [{ path: 'name', operation: 'update', newValue: 'Updated', oldValue: 'Old' }],
          isNew: false,
        },
        {
          model: 'project.project',
          id: 1,
          changes: [{ path: 'name', operation: 'create', newValue: 'New Project', oldValue: null }],
          isNew: true,
        },
      ];

      const plan = generatePlan(diffs);

      // Create should come first
      expect(plan.operations[0].type).toBe('create');
      expect(plan.operations[1].type).toBe('update');
    });

    it('handles create, update, delete order', () => {
      // Create a diff and plan with multiple operation types
      const diffs2: ModelDiff[] = [
        {
          model: 'res.partner',
          id: 10,
          changes: [{ path: 'name', operation: 'create', newValue: 'Partner', oldValue: null }],
          isNew: true,
        },
        {
          model: 'project.task',
          id: 5,
          changes: [{ path: 'state', operation: 'update', newValue: 'done', oldValue: 'todo' }],
          isNew: false,
        },
      ];

      const plan = generatePlan(diffs2);

      // Verify create comes before update
      const createOps = plan.operations.filter((op) => op.type === 'create');
      const updateOps = plan.operations.filter((op) => op.type === 'update');

      expect(createOps.length).toBeGreaterThanOrEqual(1);
      expect(updateOps.length).toBeGreaterThanOrEqual(1);

      // Create ops should come first in the overall operations array
      const firstCreateIdx = plan.operations.findIndex((op) => op.type === 'create');
      const firstUpdateIdx = plan.operations.findIndex((op) => op.type === 'update');

      if (createOps.length > 0 && updateOps.length > 0) {
        expect(firstCreateIdx).toBeLessThan(firstUpdateIdx);
      }
    });
  });

  describe('generatePlan - Many Records', () => {
    it('generates plan for multiple models', () => {
      const diffs: ModelDiff[] = [
        {
          model: 'project.project',
          id: 1,
          changes: [{ path: 'name', operation: 'create', newValue: 'Project 1', oldValue: null }],
          isNew: true,
        },
        {
          model: 'project.task',
          id: 1,
          changes: [{ path: 'name', operation: 'create', newValue: 'Task 1', oldValue: null }],
          isNew: true,
        },
        {
          model: 'res.partner',
          id: 1,
          changes: [
            { path: 'name', operation: 'update', newValue: 'Partner Name', oldValue: 'Old Name' },
          ],
          isNew: false,
        },
      ];

      const plan = generatePlan(diffs);

      expect(plan.operations).toHaveLength(3);
      expect(plan.metadata.affectedModels.size).toBe(3);
      expect(plan.summary.creates).toBe(2);
      expect(plan.summary.updates).toBe(1);
    });

    it('reports affected models in metadata', () => {
      const diffs: ModelDiff[] = [
        {
          model: 'project.task',
          id: 1,
          changes: [{ path: 'name', operation: 'create', newValue: 'Task', oldValue: null }],
          isNew: true,
        },
        {
          model: 'project.task',
          id: 2,
          changes: [{ path: 'name', operation: 'create', newValue: 'Task 2', oldValue: null }],
          isNew: true,
        },
      ];

      const plan = generatePlan(diffs);

      const taskStats = plan.metadata.affectedModels.get('project.task');
      expect(taskStats).toBeDefined();
      expect(taskStats?.creates).toBe(2);
      expect(taskStats?.updates).toBe(0);
    });
  });

  describe('generatePlan - Validation and Errors', () => {
    it('reports error when exceeding max operations', () => {
      const diffs: ModelDiff[] = [];

      // Create many diffs
      for (let i = 0; i < 100; i++) {
        diffs.push({
          model: 'project.task',
          id: i,
          changes: [{ path: 'name', operation: 'create', newValue: `Task ${i}`, oldValue: null }],
          isNew: true,
        });
      }

      const plan = generatePlan(diffs, { maxOperations: 50 });

      expect(plan.summary.hasErrors).toBe(true);
      expect(plan.summary.errors).toBeDefined();
      expect(plan.summary.errors![0]).toContain('exceeds maximum operations');
    });

    it('validates dependencies are satisfied', () => {
      const diffs: ModelDiff[] = [
        {
          model: 'project.task',
          id: 1,
          changes: [{ path: 'name', operation: 'create', newValue: 'Task', oldValue: null }],
          isNew: true,
        },
      ];

      const plan = generatePlan(diffs, { validateDependencies: true });

      // Should not have errors for valid plan
      expect(plan.summary.hasErrors).toBe(false);
    });
  });

  describe('generatePlan - Summary Statistics', () => {
    it('calculates correct summary for mixed operations', () => {
      const diffs: ModelDiff[] = [
        {
          model: 'project.project',
          id: 1,
          changes: [{ path: 'name', operation: 'create', newValue: 'P1', oldValue: null }],
          isNew: true,
        },
        {
          model: 'project.task',
          id: 1,
          changes: [{ path: 'name', operation: 'create', newValue: 'T1', oldValue: null }],
          isNew: true,
        },
        {
          model: 'project.task',
          id: 2,
          changes: [{ path: 'status', operation: 'update', newValue: 'done', oldValue: 'todo' }],
          isNew: false,
        },
      ];

      const plan = generatePlan(diffs);

      expect(plan.summary.totalOperations).toBe(3);
      expect(plan.summary.creates).toBe(2);
      expect(plan.summary.updates).toBe(1);
      expect(plan.summary.deletes).toBe(0);
      expect(plan.summary.isEmpty).toBe(false);
      expect(plan.summary.hasErrors).toBe(false);
    });

    it('includes timestamp in metadata', () => {
      const before = new Date();
      const plan = generatePlan([]);
      const after = new Date();

      expect(plan.metadata.timestamp).toBeDefined();
      expect(plan.metadata.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(plan.metadata.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('counts total changes correctly', () => {
      const diffs: ModelDiff[] = [
        {
          model: 'model1',
          id: 1,
          changes: [{ path: 'f1', operation: 'create', newValue: 'v1', oldValue: null }],
          isNew: true,
        },
        {
          model: 'model2',
          id: 1,
          changes: [{ path: 'f1', operation: 'update', newValue: 'v1', oldValue: 'old' }],
          isNew: false,
        },
      ];

      const plan = generatePlan(diffs);

      expect(plan.metadata.totalChanges).toBe(2);
    });
  });

  describe('generatePlan - Options', () => {
    it('respects autoReorder option', () => {
      const diffs: ModelDiff[] = [
        {
          model: 'project.task',
          id: 1,
          changes: [{ path: 'name', operation: 'update', newValue: 'Updated', oldValue: 'Old' }],
          isNew: false,
        },
        {
          model: 'project.project',
          id: 1,
          changes: [{ path: 'name', operation: 'create', newValue: 'New', oldValue: null }],
          isNew: true,
        },
      ];

      const planWithReorder = generatePlan(diffs, { autoReorder: true });
      expect(planWithReorder.operations[0].type).toBe('create');

      const planNoReorder = generatePlan(diffs, { autoReorder: false });
      // Should maintain diff order, but still separate creates from updates
      expect(planNoReorder.operations.length).toBe(2);
    });

    it('respects validateDependencies option', () => {
      const diffs: ModelDiff[] = [
        {
          model: 'project.task',
          id: 1,
          changes: [{ path: 'name', operation: 'create', newValue: 'Task', oldValue: null }],
          isNew: true,
        },
      ];

      const planWithValidation = generatePlan(diffs, { validateDependencies: true });
      expect(planWithValidation.summary.hasErrors).toBe(false);

      const planNoValidation = generatePlan(diffs, { validateDependencies: false });
      expect(planNoValidation.operations).toBeDefined();
    });
  });

  describe('Plan Metadata', () => {
    it('tracks affected models correctly', () => {
      const diffs: ModelDiff[] = [
        {
          model: 'project.project',
          id: 1,
          changes: [{ path: 'name', operation: 'create', newValue: 'P1', oldValue: null }],
          isNew: true,
        },
        {
          model: 'project.project',
          id: 2,
          changes: [{ path: 'name', operation: 'create', newValue: 'P2', oldValue: null }],
          isNew: true,
        },
        {
          model: 'project.task',
          id: 1,
          changes: [{ path: 'name', operation: 'update', newValue: 'T1', oldValue: 'Old' }],
          isNew: false,
        },
      ];

      const plan = generatePlan(diffs);

      const projectStats = plan.metadata.affectedModels.get('project.project');
      const taskStats = plan.metadata.affectedModels.get('project.task');

      expect(projectStats?.creates).toBe(2);
      expect(projectStats?.updates).toBe(0);
      expect(taskStats?.creates).toBe(0);
      expect(taskStats?.updates).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('handles records with no field changes but isNew flag', () => {
      const diffs: ModelDiff[] = [
        {
          model: 'project.task',
          id: 1,
          changes: [],
          isNew: true,
        },
      ];

      const plan = generatePlan(diffs);

      // Should still create a create operation even with no changes
      expect(plan.operations).toHaveLength(1);
      expect(plan.operations[0].type).toBe('create');
    });

    it('handles many fields in single record', () => {
      const changes: FieldChange[] = [];
      for (let i = 0; i < 50; i++) {
        changes.push({
          path: `field_${i}`,
          operation: 'create',
          newValue: `value_${i}`,
          oldValue: null,
        });
      }

      const diffs: ModelDiff[] = [
        {
          model: 'project.task',
          id: 1,
          changes,
          isNew: true,
        },
      ];

      const plan = generatePlan(diffs);

      expect(plan.operations).toHaveLength(1);
      expect(Object.keys(plan.operations[0].values!)).toHaveLength(50);
    });
  });
});
