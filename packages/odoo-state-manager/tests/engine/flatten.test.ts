import { describe, it, expect } from 'vitest';
import { resource } from '../../src/dsl/resource';
import { lookup } from '../../src/dsl/lookup';
import { children } from '../../src/dsl/children';
import { flattenChildren } from '../../src/engine/flatten';
import { isResourceRef } from '../../src/dsl/types';

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

  it('attaches parentScope when inverseField is provided', () => {
    const parent = resource('project.project', 'bgbl.fiscal', {
      name: 'Fiscal',
      type_ids: children('project.task.type', 'project_id', [
        resource('project.task.type', 'nuevo', {
          _ref: lookup('project.task.type', { name: 'Nuevo' }),
          name: 'Nuevo',
        }),
      ]),
    });

    const result = flattenChildren([parent]);

    expect(result[1].parentScope).toEqual({
      inverseField: 'project_id',
      parentExternalId: 'bgbl.fiscal',
    });
  });

  it('attaches parentScope with parentRef when parent has _ref', () => {
    const parent = resource('project.project', 'bgbl.fiscal', {
      _ref: lookup('project.project', { name: 'Fiscal' }),
      name: 'Fiscal',
      type_ids: children('project.task.type', 'project_id', [
        resource('project.task.type', 'nuevo', { name: 'Nuevo' }),
      ]),
    });

    const result = flattenChildren([parent]);

    expect(result[1].parentScope).toEqual({
      inverseField: 'project_id',
      parentExternalId: 'bgbl.fiscal',
      parentRef: { __type: 'lookup', model: 'project.project', domain: { name: 'Fiscal' } },
    });
  });

  it('does not attach parentScope when no inverseField', () => {
    const parent = resource('project.project', 'bgbl.fiscal', {
      name: 'Fiscal',
      type_ids: children('project.task.type', [
        resource('project.task.type', 'nuevo', { name: 'Nuevo' }),
      ]),
    });

    const result = flattenChildren([parent]);

    expect(result[1].parentScope).toBeUndefined();
  });

  describe('inline many2one resource', () => {
    it('extracts inline resource to top-level and replaces with ResourceRef', () => {
      const parent = resource('ir.cron', 'bgbl.my_cron', {
        name: 'My Cron',
        ir_actions_server_id: resource('ir.actions.server', 'action', {
          name: 'My Action',
          state: 'code',
        }),
      });

      const result = flattenChildren([parent]);

      expect(result).toHaveLength(2);
      // Inline resource comes BEFORE parent
      expect(result[0].model).toBe('ir.actions.server');
      expect(result[1].model).toBe('ir.cron');

      const ref = result[1].values.ir_actions_server_id;
      expect(isResourceRef(ref)).toBe(true);
      if (isResourceRef(ref)) {
        expect(ref.externalId).toBe('bgbl.my_cron.action');
      }
    });

    it('auto-prefixes inline resource externalId with parent', () => {
      const parent = resource('ir.cron', 'bgbl.my_cron', {
        name: 'My Cron',
        ir_actions_server_id: resource('ir.actions.server', 'action', {
          name: 'My Action',
        }),
      });

      const result = flattenChildren([parent]);
      expect(result[0].externalId).toBe('bgbl.my_cron.action');
    });

    it('leaves fully qualified inline resource externalId unchanged', () => {
      const parent = resource('ir.cron', 'bgbl.my_cron', {
        name: 'My Cron',
        ir_actions_server_id: resource('ir.actions.server', 'other.my_action', {
          name: 'My Action',
        }),
      });

      const result = flattenChildren([parent]);
      expect(result[0].externalId).toBe('other.my_action');
    });

    it('attaches parentScope with no inverseField', () => {
      const parent = resource('ir.cron', 'bgbl.my_cron', {
        name: 'My Cron',
        ir_actions_server_id: resource('ir.actions.server', 'action', {
          name: 'My Action',
        }),
      });

      const result = flattenChildren([parent]);
      expect(result[0].parentScope).toEqual({
        parentExternalId: 'bgbl.my_cron',
      });
      expect(result[0].parentScope?.inverseField).toBeUndefined();
    });

    it('throws when inline resource has no externalId and parent has no externalId', () => {
      const parent = resource('ir.cron', {
        name: 'My Cron',
        ir_actions_server_id: resource('ir.actions.server', {
          name: 'My Action',
        }),
      });

      expect(() => flattenChildren([parent])).toThrow(/external ID/i);
    });

    it('throws when inline resource has unqualified externalId and parent has no externalId', () => {
      const parent = resource('ir.cron', {
        name: 'My Cron',
        ir_actions_server_id: resource('ir.actions.server', 'action', {
          name: 'My Action',
        }),
      });

      expect(() => flattenChildren([parent])).toThrow(/external ID/i);
    });

    it('works when parent has no externalId but inline resource has qualified externalId', () => {
      const parent = resource('ir.cron', {
        name: 'My Cron',
        ir_actions_server_id: resource('ir.actions.server', 'bgbl.standalone_action', {
          name: 'My Action',
        }),
      });

      const result = flattenChildren([parent]);
      expect(result).toHaveLength(2);
      expect(result[0].externalId).toBe('bgbl.standalone_action');
    });

    it('coexists with children() and lookup() in the same parent', () => {
      const parent = resource('ir.cron', 'bgbl.my_cron', {
        name: 'My Cron',
        ir_actions_server_id: resource('ir.actions.server', 'action', {
          name: 'My Action',
        }),
        partner_id: lookup('res.partner', { name: 'ACME' }),
      });

      const result = flattenChildren([parent]);

      expect(result).toHaveLength(2);

      const parentRes = result[1];
      expect(parentRes.values.partner_id).toEqual({
        __type: 'lookup',
        model: 'res.partner',
        domain: { name: 'ACME' },
      });
      expect(isResourceRef(parentRes.values.ir_actions_server_id)).toBe(true);
    });
  });
});
