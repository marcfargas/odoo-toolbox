import { describe, it, expect } from 'vitest';
import { children, isChildrenRef } from '../../src/dsl/children';
import { resource } from '../../src/dsl/resource';

describe('children()', () => {
  it('creates a ChildrenRef with model and resources', () => {
    const child1 = resource('project.task.type', 'nuevo', { name: 'Nuevo' });
    const child2 = resource('project.task.type', 'done', { name: 'Done' });
    const ref = children('project.task.type', [child1, child2]);

    expect(ref.__type).toBe('children');
    expect(ref.model).toBe('project.task.type');
    expect(ref.resources).toHaveLength(2);
  });

  it('is frozen', () => {
    const ref = children('project.task.type', []);
    expect(Object.isFrozen(ref)).toBe(true);
  });
});

describe('isChildrenRef()', () => {
  it('returns true for ChildrenRef', () => {
    const ref = children('project.task.type', []);
    expect(isChildrenRef(ref)).toBe(true);
  });

  it('returns false for other objects', () => {
    expect(isChildrenRef({ __type: 'resource' })).toBe(false);
    expect(isChildrenRef(null)).toBe(false);
    expect(isChildrenRef(42)).toBe(false);
  });
});
