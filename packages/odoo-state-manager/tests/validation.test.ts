/**
 * Tests for plan validation utilities.
 * 
 * Tests relational record validation, error suggestion, and fix recommendations.
 */

import {
  validatePlanReferences,
  formatValidationErrors,
  suggestErrorFixes,
  ValidationResult,
} from '../src/plan/validation';
import { ExecutionPlan, Operation } from '../src/plan/types';

describe('Plan Validation', () => {
  describe('validatePlanReferences', () => {
    it('should pass validation for empty plan', async () => {
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

      const result = await validatePlanReferences(plan);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass validation for direct ID references in create', async () => {
      const plan: ExecutionPlan = {
        operations: [
          {
            type: 'create',
            model: 'project.task',
            id: 'project.task:temp_1',
            values: {
              name: 'Task 1',
              project_id: 1, // Direct ID reference
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

      const result = await validatePlanReferences(plan);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.recordsToVerify).toContainEqual({
        model: 'project.task',
        id: 1,
      });
    });

    it('should validate temporary ID references correctly', async () => {
      const plan: ExecutionPlan = {
        operations: [
          {
            type: 'create',
            model: 'project.project',
            id: 'project.project:temp_1',
            values: { name: 'Project 1' },
          },
          {
            type: 'create',
            model: 'project.task',
            id: 'project.task:temp_2',
            values: {
              name: 'Task 1',
              project_id: 'project.project:temp_1', // Reference to temp record
            },
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

      const result = await validatePlanReferences(plan);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect reference to non-existent temporary record', async () => {
      const plan: ExecutionPlan = {
        operations: [
          {
            type: 'create',
            model: 'project.task',
            id: 'project.task:temp_1',
            values: {
              name: 'Task 1',
              project_id: 'project.project:temp_999', // Non-existent temp record
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

      const result = await validatePlanReferences(plan);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toMatch(/non-existent temporary record/);
      expect(result.errors[0].severity).toBe('error');
      expect(result.errors[0].suggestedFixes.length).toBeGreaterThan(0);
    });

    it('should detect circular dependency in references', async () => {
      const plan: ExecutionPlan = {
        operations: [
          {
            type: 'create',
            model: 'project.task',
            id: 'project.task:temp_2',
            values: {
              name: 'Task 2',
              project_id: 'project.project:temp_1', // References temp_1
            },
          },
          {
            type: 'create',
            model: 'project.project',
            id: 'project.project:temp_1',
            values: { name: 'Project 1' },
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

      const result = await validatePlanReferences(plan);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toMatch(/Circular dependency|created later/);
    });

    it('should handle many2many field references', async () => {
      const plan: ExecutionPlan = {
        operations: [
          {
            type: 'create',
            model: 'project.task',
            id: 'project.task:temp_1',
            values: {
              name: 'Task 1',
              tags_ids: [1, 2, 3], // Array of IDs
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

      const result = await validatePlanReferences(plan);
      expect(result.isValid).toBe(true);
      expect(result.recordsToVerify).toContainEqual({
        model: 'project.task',
        id: 1,
      });
    });

    it('should handle many2many field with temp references', async () => {
      const plan: ExecutionPlan = {
        operations: [
          {
            type: 'create',
            model: 'project.tag',
            id: 'project.tag:temp_1',
            values: { name: 'Tag 1' },
          },
          {
            type: 'create',
            model: 'project.task',
            id: 'project.task:temp_2',
            values: {
              name: 'Task 1',
              tags_ids: ['project.tag:temp_1'], // Temp reference in array
            },
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

      const result = await validatePlanReferences(plan);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('formatValidationErrors', () => {
    it('should format passed validation', () => {
      const result: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        recordsToVerify: [],
      };

      const output = formatValidationErrors(result);
      expect(output).toContain('✓ Plan validation passed');
    });

    it('should format validation errors with fixes', () => {
      const result: ValidationResult = {
        isValid: false,
        errors: [
          {
            message: 'Operation references non-existent temporary record: project.project:temp_999',
            operationId: 'project.task:temp_1',
            fieldName: 'project_id',
            severity: 'error',
            suggestedFixes: [
              'Ensure record project.project:temp_999 is created before this operation',
              'Verify the referenced model name is correct: project.project',
            ],
          },
        ],
        warnings: [],
        recordsToVerify: [],
      };

      const output = formatValidationErrors(result);
      expect(output).toContain('✗');
      expect(output).toContain('Operation references non-existent temporary record');
      expect(output).toContain('Field: project_id');
      expect(output).toContain('Operation: project.task:temp_1');
      expect(output).toContain('Suggested fixes:');
      expect(output).toContain('Ensure record');
    });

    it('should format warnings', () => {
      const result: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [
          {
            message: 'Failed to verify records in project.task',
            severity: 'warning',
            suggestedFixes: ['Check that you have read permissions'],
          },
        ],
        recordsToVerify: [],
      };

      const output = formatValidationErrors(result);
      expect(output).toContain('⚠');
      expect(output).toContain('Failed to verify records');
    });
  });

  describe('suggestErrorFixes', () => {
    it('should suggest fixes for access denied errors', () => {
      const error = new Error('Access denied');
      const fixes = suggestErrorFixes(error);

      expect(fixes.some(f => f.match(/permission|security|group/i))).toBe(true);
    });

    it('should suggest fixes for does not exist errors', () => {
      const error = new Error('Record does not exist');
      const fixes = suggestErrorFixes(error, { model: 'res.partner' });

      expect(fixes.some(f => f.match(/record ID|deleted|Search/i))).toBe(true);
    });

    it('should suggest fixes for required field errors', () => {
      const error = new Error('Missing required field: name');
      const fixes = suggestErrorFixes(error);

      expect(fixes.some(f => f.match(/required field/i))).toBe(true);
    });

    it('should suggest fixes for validation errors', () => {
      const error = new Error('ValidationError: Field constraint violated');
      const fixes = suggestErrorFixes(error);

      expect(fixes.some(f => f.match(/constraint|field value/i))).toBe(true);
    });

    it('should suggest fixes for many2one errors', () => {
      const error = new Error('Invalid many2one reference');
      const fixes = suggestErrorFixes(error);

      expect(fixes.some(f => f.match(/relational field|record ID|valid record/i))).toBe(true);
    });

    it('should provide generic suggestions for unknown errors', () => {
      const error = new Error('Some unknown error');
      const fixes = suggestErrorFixes(error);

      expect(fixes.length).toBeGreaterThan(0);
      expect(fixes.some(f => f.match(/error message|values|permissions/))).toBe(true);
    });

    it('should accept string errors', () => {
      const fixes = suggestErrorFixes('Access denied');
      expect(fixes.length).toBeGreaterThan(0);
    });

    it('should use context when available', () => {
      const error = new Error('Missing required field');
      const fixes = suggestErrorFixes(error, {
        operation: {
          model: 'project.task',
          type: 'create',
        },
      });

      expect(fixes.some(f => f.includes('project.task'))).toBe(true);
    });
  });
});
