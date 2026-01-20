/**
 * Tests for state comparison module.
 * 
 * Tests cover:
 * - Basic field comparison (primitives, objects)
 * - Odoo-specific field types (many2one, one2many, many2many)
 * - Readonly/computed field filtering
 * - Custom comparators
 * - Multiple record comparison
 */

import { compareRecord, compareRecords, CompareOptions } from '../src/compare';
import { OdooField } from '@odoo-toolbox/client';

describe('State Comparison Module', () => {
  describe('compareRecord - Primitive Fields', () => {
    it('detects no changes when states are identical', () => {
      const changes = compareRecord(
        'project.project',
        1,
        { name: 'Q1 Planning', active: true },
        { name: 'Q1 Planning', active: true }
      );

      expect(changes).toHaveLength(0);
    });

    it('detects string field changes', () => {
      const changes = compareRecord(
        'project.project',
        1,
        { name: 'Q1 Planning' },
        { name: 'Q1' }
      );

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        path: 'name',
        operation: 'update',
        newValue: 'Q1 Planning',
        oldValue: 'Q1',
      });
    });

    it('detects numeric field changes', () => {
      const changes = compareRecord(
        'project.project',
        1,
        { sequence: 10 },
        { sequence: 5 }
      );

      expect(changes).toHaveLength(1);
      expect(changes[0].operation).toBe('update');
      expect(changes[0].newValue).toBe(10);
      expect(changes[0].oldValue).toBe(5);
    });

    it('detects boolean field changes', () => {
      const changes = compareRecord(
        'project.project',
        1,
        { active: true },
        { active: false }
      );

      expect(changes).toHaveLength(1);
      expect(changes[0].newValue).toBe(true);
      expect(changes[0].oldValue).toBe(false);
    });

    it('detects new fields (not in actual state)', () => {
      const changes = compareRecord(
        'project.project',
        1,
        { name: 'Q1 Planning' },
        {}
      );

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        path: 'name',
        operation: 'create',
        newValue: 'Q1 Planning',
        oldValue: null,
      });
    });

    it('ignores fields in actual state not in desired', () => {
      const changes = compareRecord(
        'project.project',
        1,
        { name: 'Q1 Planning' },
        { name: 'Q1 Planning', description: 'Old description' }
      );

      // Should not include 'description' in changes since it's not in desired state
      expect(changes).toHaveLength(0);
    });
  });

  describe('compareRecord - Many2One Fields', () => {
    it('normalizes many2one [id, name] tuple from Odoo', () => {
      // Odoo returns many2one as [id, display_name]
      const changes = compareRecord(
        'project.task',
        1,
        { project_id: 5 },
        { project_id: [5, 'Q1 Planning'] } // Odoo format
      );

      expect(changes).toHaveLength(0); // No change - same ID
    });

    it('detects many2one changes despite name differences', () => {
      const changes = compareRecord(
        'project.task',
        1,
        { project_id: 5 },
        { project_id: [3, 'Q2 Planning'] } // Different ID, so it's a change
      );

      expect(changes).toHaveLength(1);
      expect(changes[0].newValue).toBe(5);
      expect(changes[0].oldValue).toEqual([3, 'Q2 Planning']);
    });

    it('handles null many2one values', () => {
      const changes = compareRecord(
        'project.task',
        1,
        { manager_id: null },
        { manager_id: [1, 'John Doe'] }
      );

      expect(changes).toHaveLength(1);
      expect(changes[0].operation).toBe('update');
      expect(changes[0].newValue).toBe(null);
    });

    it('detects null to non-null many2one changes', () => {
      const changes = compareRecord(
        'project.task',
        1,
        { manager_id: 5 },
        { manager_id: null }
      );

      expect(changes).toHaveLength(1);
      expect(changes[0].operation).toBe('update');
      expect(changes[0].newValue).toBe(5);
      expect(changes[0].oldValue).toBe(null);
    });

    it('uses field metadata to identify many2one types', () => {
      const fieldMetadata = new Map([
        [
          'project.task',
          new Map<string, OdooField>([
            [
              'project_id',
              {
                name: 'project_id',
                field_description: 'Project',
                ttype: 'many2one',
                required: false,
                readonly: false,
                relation: 'project.project',
                id: 1,
                model: 'project.task',
              },
            ],
          ]),
        ],
      ]);

      const changes = compareRecord(
        'project.task',
        1,
        { project_id: 5 },
        { project_id: [5, 'Project Name'] },
        { fieldMetadata }
      );

      expect(changes).toHaveLength(0);
    });
  });

  describe('compareRecord - One2Many/Many2Many Fields', () => {
    it('compares one2many as ID arrays', () => {
      const changes = compareRecord(
        'project.project',
        1,
        { task_ids: [1, 2, 3] },
        { task_ids: [1, 2, 3] }
      );

      expect(changes).toHaveLength(0);
    });

    it('detects one2many changes regardless of order', () => {
      // Array comparison should handle order variations
      const changes = compareRecord(
        'project.project',
        1,
        { task_ids: [1, 2, 3] },
        { task_ids: [3, 2, 1] }
      );

      // Arrays with same elements but different order should be considered equal
      // (after normalization/sorting)
      expect(changes).toHaveLength(0);
    });

    it('detects one2many element additions', () => {
      const changes = compareRecord(
        'project.project',
        1,
        { task_ids: [1, 2, 3] },
        { task_ids: [1, 2] }
      );

      expect(changes).toHaveLength(1);
      expect(changes[0].newValue).toEqual([1, 2, 3]);
    });

    it('handles empty one2many arrays', () => {
      const changes = compareRecord(
        'project.project',
        1,
        { task_ids: [] },
        { task_ids: [1, 2] }
      );

      expect(changes).toHaveLength(1);
      expect(changes[0].newValue).toEqual([]);
    });
  });

  describe('compareRecord - Field Metadata and Computed Fields', () => {
    it('skips readonly fields', () => {
      const fieldMetadata = new Map([
        [
          'project.task',
          new Map<string, OdooField>([
            [
              'create_date',
              {
                name: 'create_date',
                field_description: 'Created on',
                ttype: 'datetime',
                required: false,
                readonly: true, // Readonly field
                id: 1,
                model: 'project.task',
              },
            ],
          ]),
        ],
      ]);

      const changes = compareRecord(
        'project.task',
        1,
        { create_date: '2024-01-01' },
        { create_date: '2024-01-02' },
        { fieldMetadata }
      );

      expect(changes).toHaveLength(0); // Readonly field ignored
    });

    it('skips computed fields', () => {
      const fieldMetadata = new Map([
        [
          'project.task',
          new Map<string, OdooField>([
            [
              'progress',
              {
                name: 'progress',
                field_description: 'Progress',
                ttype: 'float',
                required: false,
                readonly: false,
                compute: '_compute_progress', // Computed field
                id: 1,
                model: 'project.task',
              },
            ],
          ]),
        ],
      ]);

      const changes = compareRecord(
        'project.task',
        1,
        { progress: 50.0 },
        { progress: 25.0 },
        { fieldMetadata }
      );

      expect(changes).toHaveLength(0); // Computed field ignored
    });

    it('includes writable fields not marked as readonly/computed', () => {
      const fieldMetadata = new Map([
        [
          'project.task',
          new Map<string, OdooField>([
            [
              'name',
              {
                name: 'name',
                field_description: 'Task Name',
                ttype: 'char',
                required: true,
                readonly: false,
                id: 1,
                model: 'project.task',
              },
            ],
          ]),
        ],
      ]);

      const changes = compareRecord(
        'project.task',
        1,
        { name: 'New Name' },
        { name: 'Old Name' },
        { fieldMetadata }
      );

      expect(changes).toHaveLength(1);
    });
  });

  describe('compareRecord - Custom Comparators', () => {
    it('uses custom comparator when provided', () => {
      const customComparators = new Map<string, (d: any, a: any) => boolean>([
        [
          'tags',
          (desired, actual) => {
            // Custom comparator: compare tags by ignoring whitespace
            const normalize = (s: string) => s.trim().toLowerCase();
            return normalize(desired) === normalize(actual);
          },
        ],
      ]);

      const changes = compareRecord(
        'project.task',
        1,
        { tags: 'urgent, important' },
        { tags: 'URGENT, IMPORTANT' },
        { customComparators }
      );

      expect(changes).toHaveLength(0); // Custom comparator says they're equal
    });

    it('custom comparator detects actual changes', () => {
      const customComparators = new Map<string, (d: any, a: any) => boolean>([
        ['tags', (d, a) => d === a],
      ]);

      const changes = compareRecord(
        'project.task',
        1,
        { tags: 'urgent' },
        { tags: 'important' },
        { customComparators }
      );

      expect(changes).toHaveLength(1);
    });
  });

  describe('compareRecords - Multiple Records', () => {
    it('compares multiple records and returns diffs for changed ones', () => {
      const desiredStates = new Map([
        [1, { name: 'Task 1', priority: 'high' }],
        [2, { name: 'Task 2', priority: 'low' }],
      ]);

      const actualStates = new Map([
        [1, { name: 'Task 1', priority: 'medium' }],
        [2, { name: 'Task 2', priority: 'low' }],
      ]);

      const diffs = compareRecords('project.task', desiredStates, actualStates);

      expect(diffs).toHaveLength(1);
      expect(diffs[0].id).toBe(1);
      expect(diffs[0].changes).toHaveLength(1);
      expect(diffs[0].isNew).toBe(false);
    });

    it('marks new records as isNew: true', () => {
      const desiredStates = new Map([[3, { name: 'Task 3' }]]);
      const actualStates = new Map<number, any>();

      const diffs = compareRecords('project.task', desiredStates, actualStates);

      expect(diffs).toHaveLength(1);
      expect(diffs[0].isNew).toBe(true);
    });

    it('returns empty array when no changes detected', () => {
      const desiredStates = new Map([
        [1, { name: 'Task 1', priority: 'high' }],
      ]);

      const actualStates = new Map([
        [1, { name: 'Task 1', priority: 'high' }],
      ]);

      const diffs = compareRecords('project.task', desiredStates, actualStates);

      expect(diffs).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('handles null values correctly', () => {
      const changes = compareRecord('project.task', 1, { notes: null }, { notes: 'Some text' });

      expect(changes).toHaveLength(1);
      expect(changes[0].newValue).toBe(null);
    });

    it('handles undefined in actual state as null', () => {
      const changes = compareRecord('project.task', 1, { notes: 'Text' }, {});

      expect(changes).toHaveLength(1);
      expect(changes[0].oldValue).toBe(null);
    });

    it('detects changes in nested objects', () => {
      const changes = compareRecord(
        'project.task',
        1,
        { metadata: { status: 'active' } },
        { metadata: { status: 'inactive' } }
      );

      expect(changes).toHaveLength(1);
    });

    it('handles empty object comparison', () => {
      const changes = compareRecord('project.task', 1, {}, {});

      expect(changes).toHaveLength(0);
    });
  });
});
