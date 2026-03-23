import { describe, it, expect } from 'vitest';
import { resource, lookup, isResourceDefinition } from '../../src/dsl';

describe('resource()', () => {
  it('creates a ResourceDefinition for a simple record (no _ref)', () => {
    const res = resource('res.partner', { name: 'ACME', active: true });
    expect(res.__type).toBe('resource');
    expect(res.model).toBe('res.partner');
    expect(res.values).toEqual({ name: 'ACME', active: true });
    expect(res.ref).toBeUndefined();
    expect(res.removeUnmanaged).toBeUndefined();
  });

  it('extracts _ref into ref field and removes it from values', () => {
    const ref = lookup('res.partner', { name: 'ACME' });
    const res = resource('res.partner', { _ref: ref, name: 'ACME' });
    expect(res.ref).toBe(ref);
    expect(res.values).not.toHaveProperty('_ref');
    expect(res.values).toEqual({ name: 'ACME' });
  });

  it('extracts removeUnmanaged from values', () => {
    const res = resource('product.template', {
      name: 'Widget',
      removeUnmanaged: { 'product.pricelist.item': true },
    });
    expect(res.removeUnmanaged).toEqual({ 'product.pricelist.item': true });
    expect(res.values).not.toHaveProperty('removeUnmanaged');
    expect(res.values).toEqual({ name: 'Widget' });
  });

  it('preserves nested resource() in relational fields', () => {
    const line = resource('sale.order.line', { product_id: 1, price_unit: 10 });
    const order = resource('sale.order', { name: 'SO001', order_line: [line] });
    expect(order.values['order_line']).toEqual([line]);
  });

  it('preserves lookup() in field values', () => {
    const ref = lookup('res.currency', { name: 'EUR' });
    const res = resource('res.partner', { name: 'ACME', currency_id: ref });
    expect(res.values['currency_id']).toBe(ref);
  });

  it('passes isResourceDefinition type guard (positive)', () => {
    const res = resource('res.partner', { name: 'ACME' });
    expect(isResourceDefinition(res)).toBe(true);
  });

  it('passes isResourceDefinition type guard (negative)', () => {
    expect(isResourceDefinition(null)).toBe(false);
    expect(isResourceDefinition(undefined)).toBe(false);
    expect(isResourceDefinition({ __type: 'lookup' })).toBe(false);
    expect(isResourceDefinition('string')).toBe(false);
  });

  it('works with .map() for collections', () => {
    const data = [{ name: 'Tag A' }, { name: 'Tag B' }];
    const resources = data.map((d) => resource('res.partner.category', d));
    expect(resources).toHaveLength(2);
    expect(resources[0].__type).toBe('resource');
    expect(resources[0].values).toEqual({ name: 'Tag A' });
    expect(resources[1].values).toEqual({ name: 'Tag B' });
  });
});
