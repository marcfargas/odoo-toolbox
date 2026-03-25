import { describe, it, expect } from 'vitest';
import { resource } from '../../src/dsl/resource';
import { children } from '../../src/dsl/children';
import { flattenChildren } from '../../src/engine/flatten';

describe('flattenChildren()', () => {
  it('promotes child resources to top-level', () => {
    const parent = resource('project.project', 'bgbl.fiscal', {
      name: 'Fiscal',
      type_ids: children('project.task.type', [
        resource('project.task.type', 'nuevo', { name: 'Nuevo' }),
        resource('project.task.type', 'done', { name: 'Done' }),
      ]),
    });

    const result = flattenChildren([parent]);

    // Parent + 2 children = 3 resources
    expect(result).toHaveLength(3);
  });

  it('auto-prefixes child externalIds with parent externalId', () => {
    const parent = resource('project.project', 'bgbl.fiscal', {
      name: 'Fiscal',
      type_ids: children('project.task.type', [
        resource('project.task.type', 'nuevo', { name: 'Nuevo' }),
        resource('project.task.type', 'done', { name: 'Done' }),
      ]),
    });

    const result = flattenChildren([parent]);

    const childIds = result.slice(1).map((r) => r.externalId);
    expect(childIds).toEqual(['bgbl.fiscal.nuevo', 'bgbl.fiscal.done']);
  });

  it('removes ChildrenRef from parent values', () => {
    const parent = resource('project.project', 'bgbl.fiscal', {
      name: 'Fiscal',
      type_ids: children('project.task.type', [
        resource('project.task.type', 'nuevo', { name: 'Nuevo' }),
      ]),
    });

    const result = flattenChildren([parent]);

    // Parent should no longer have type_ids in values
    expect(result[0].values).toEqual({ name: 'Fiscal' });
    expect(result[0].values).not.toHaveProperty('type_ids');
  });

  it('preserves parent externalId and other metadata', () => {
    const parent = resource('project.project', 'bgbl.fiscal', {
      name: 'Fiscal',
      type_ids: children('project.task.type', [
        resource('project.task.type', 'nuevo', { name: 'Nuevo' }),
      ]),
    });

    const result = flattenChildren([parent]);

    expect(result[0].externalId).toBe('bgbl.fiscal');
    expect(result[0].model).toBe('project.project');
  });

  it('leaves fully qualified child externalIds unchanged', () => {
    const parent = resource('project.project', 'bgbl.fiscal', {
      name: 'Fiscal',
      type_ids: children('project.task.type', [
        resource('project.task.type', 'other.already_qualified', { name: 'Qualified' }),
      ]),
    });

    const result = flattenChildren([parent]);

    expect(result[1].externalId).toBe('other.already_qualified');
  });

  it('passes through resources without children unchanged', () => {
    const simple = resource('res.partner', 'bgbl.partner', { name: 'Test' });
    const result = flattenChildren([simple]);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(simple);
  });

  it('handles children without externalIds', () => {
    const parent = resource('project.project', 'bgbl.fiscal', {
      name: 'Fiscal',
      type_ids: children('project.task.type', [
        resource('project.task.type', { name: 'No ExtID' }),
      ]),
    });

    const result = flattenChildren([parent]);

    expect(result).toHaveLength(2);
    expect(result[1].externalId).toBeUndefined();
  });

  it('handles parent without externalId — children keep their IDs as-is', () => {
    const parent = resource('project.project', {
      name: 'Fiscal',
      type_ids: children('project.task.type', [
        resource('project.task.type', 'nuevo', { name: 'Nuevo' }),
      ]),
    });

    const result = flattenChildren([parent]);

    // Child keeps its original short externalId (no prefix available)
    expect(result[1].externalId).toBe('nuevo');
  });
});
