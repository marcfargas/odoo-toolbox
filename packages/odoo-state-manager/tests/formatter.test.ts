/**
 * Tests for plan formatting module.
 *
 * Tests cover:
 * - Terraform-style plan output
 * - Color formatting
 * - Summary line generation
 * - Empty plans
 * - Error reporting
 */

import { formatPlanForConsole } from '../src/plan/formatter';
import { ExecutionPlan } from '../src/plan';

describe('Plan Formatter', () => {
  describe('formatPlanForConsole - Empty Plans', () => {
    it('shows message for empty plan', () => {
      const plan: ExecutionPlan = {
        operations: [],
        metadata: {
          timestamp: new Date(),
          affectedModels: new Map(),
          totalChanges: 0,
        },
        summary: {
          totalOperations: 0,
          creates: 0,
          updates: 0,
          deletes: 0,
          isEmpty: true,
          hasErrors: false,
        },
      };

      const output = formatPlanForConsole(plan, false);

      expect(output).toContain('No changes');
      expect(output).toContain('infrastructure matches');
    });
  });

  describe('formatPlanForConsole - Single Operations', () => {
    it('formats create operation', () => {
      const plan: ExecutionPlan = {
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

      const output = formatPlanForConsole(plan, false);

      expect(output).toContain('project.task');
      expect(output).toContain('new:1');
      expect(output).toContain('name');
      expect(output).toContain('New Task');
      expect(output).toContain('1 to add');
    });

    it('formats update operation', () => {
      const plan: ExecutionPlan = {
        operations: [
          {
            type: 'update',
            model: 'project.task',
            id: 'project.task:1',
            values: { name: 'Updated Task', priority: 'low' },
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

      const output = formatPlanForConsole(plan, false);

      expect(output).toContain('project.task[1]');
      expect(output).toContain('Updated Task');
      expect(output).toContain('1 to change');
    });

    it('formats delete operation', () => {
      const plan: ExecutionPlan = {
        operations: [
          {
            type: 'delete',
            model: 'project.task',
            id: 'project.task:1',
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

      const output = formatPlanForConsole(plan, false);

      expect(output).toContain('project.task[1]');
      expect(output).toContain('1 to destroy');
    });
  });

  describe('formatPlanForConsole - Multiple Operations', () => {
    it('formats mixed operations correctly', () => {
      const plan: ExecutionPlan = {
        operations: [
          {
            type: 'create',
            model: 'project.project',
            id: 'project.project:temp_1',
            values: { name: 'Q1 Planning' },
          },
          {
            type: 'create',
            model: 'project.task',
            id: 'project.task:temp_1',
            values: { name: 'Research', project_id: 1 },
          },
          {
            type: 'update',
            model: 'res.partner',
            id: 'res.partner:5',
            values: { email: 'new@example.com' },
          },
        ],
        metadata: {
          timestamp: new Date(),
          affectedModels: new Map([
            ['project.project', { creates: 1, updates: 0, deletes: 0 }],
            ['project.task', { creates: 1, updates: 0, deletes: 0 }],
            ['res.partner', { creates: 0, updates: 1, deletes: 0 }],
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

      const output = formatPlanForConsole(plan, false);

      expect(output).toContain('project.project');
      expect(output).toContain('project.task');
      expect(output).toContain('res.partner');
      expect(output).toContain('2 to add');
      expect(output).toContain('1 to change');
    });
  });

  describe('formatPlanForConsole - Error Handling', () => {
    it('shows errors in plan', () => {
      const plan: ExecutionPlan = {
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
          hasErrors: true,
          errors: [
            'Operation project.task:temp_1 depends on missing operation project.project:temp_1',
            'Circular dependency detected in operations',
          ],
        },
      };

      const output = formatPlanForConsole(plan, false);

      expect(output).toContain('Errors in plan');
      expect(output).toContain('depends on missing operation');
      expect(output).toContain('Circular dependency');
    });
  });

  describe('formatPlanForConsole - Value Formatting', () => {
    it('formats different value types correctly', () => {
      const plan: ExecutionPlan = {
        operations: [
          {
            type: 'create',
            model: 'project.task',
            id: 'project.task:temp_1',
            values: {
              name: 'Task',
              priority: 'high',
              completed: false,
              task_ids: [1, 2, 3],
              tags: [],
              metadata: { status: 'active' },
              notes: null,
            },
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

      const output = formatPlanForConsole(plan, false);

      expect(output).toContain('"Task"'); // String
      expect(output).toContain('false'); // Boolean
      expect(output).toContain('[1, 2, 3]'); // Array
      expect(output).toContain('[]'); // Empty array
      expect(output).toContain('(null)'); // Null value
    });

    it('truncates long arrays in display', () => {
      const longArray = Array.from({ length: 100 }, (_, i) => i);

      const plan: ExecutionPlan = {
        operations: [
          {
            type: 'create',
            model: 'project.project',
            id: 'project.project:temp_1',
            values: { task_ids: longArray },
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

      const output = formatPlanForConsole(plan, false);

      expect(output).toContain('100 total');
      expect(output).toContain('...');
    });
  });

  describe('formatPlanForConsole - Color Support', () => {
    it('includes ANSI codes when colorize is true', () => {
      const plan: ExecutionPlan = {
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

      const output = formatPlanForConsole(plan, true);

      // ANSI color code for green (creates)
      expect(output).toContain('\x1b[32m');
      // ANSI reset code
      expect(output).toContain('\x1b[0m');
    });

    it('excludes ANSI codes when colorize is false', () => {
      const plan: ExecutionPlan = {
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

      const output = formatPlanForConsole(plan, false);

      expect(output).not.toContain('\x1b[');
    });
  });

  describe('formatPlanForConsole - Summary Line', () => {
    it('shows correct summary for create operations', () => {
      const summary = {
        totalOperations: 5,
        creates: 5,
        updates: 0,
        deletes: 0,
        isEmpty: false,
        hasErrors: false,
      };

      const plan: ExecutionPlan = {
        operations: Array.from({ length: 5 }, (_, i) => ({
          type: 'create' as const,
          model: 'model',
          id: `id${i}`,
          values: {},
        })),
        metadata: {
          timestamp: new Date(),
          affectedModels: new Map(),
          totalChanges: 5,
        },
        summary,
      };

      const output = formatPlanForConsole(plan, false);

      expect(output).toContain('5 to add');
      expect(output).not.toContain('to change');
      expect(output).not.toContain('to destroy');
    });

    it('shows correct summary for mixed operations', () => {
      const plan: ExecutionPlan = {
        operations: [
          { type: 'create', model: 'm', id: 'i1', values: {} },
          { type: 'create', model: 'm', id: 'i2', values: {} },
          { type: 'update', model: 'm', id: 'i3', values: {} },
          { type: 'update', model: 'm', id: 'i4', values: {} },
          { type: 'delete', model: 'm', id: 'i5' },
        ],
        metadata: {
          timestamp: new Date(),
          affectedModels: new Map(),
          totalChanges: 5,
        },
        summary: {
          totalOperations: 5,
          creates: 2,
          updates: 2,
          deletes: 1,
          isEmpty: false,
          hasErrors: false,
        },
      };

      const output = formatPlanForConsole(plan, false);

      expect(output).toContain('2 to add');
      expect(output).toContain('2 to change');
      expect(output).toContain('1 to destroy');
    });
  });
});
