import { describe, it, expect } from 'vitest';
import { model, isModelPolicy } from '../../src/dsl';

describe('model()', () => {
  it('creates a ModelPolicy with removeOrphans', () => {
    const policy = model('res.partner', { removeOrphans: true });
    expect(policy.__type).toBe('model');
    expect(policy.model).toBe('res.partner');
    expect(policy.removeOrphans).toBe(true);
    expect(policy.archiveOrphans).toBeUndefined();
  });

  it('creates a ModelPolicy with archiveOrphans', () => {
    const policy = model('product.template', { archiveOrphans: true });
    expect(policy.__type).toBe('model');
    expect(policy.model).toBe('product.template');
    expect(policy.archiveOrphans).toBe(true);
    expect(policy.removeOrphans).toBeUndefined();
  });

  it('creates a ModelPolicy with both flags', () => {
    const policy = model('res.partner', { removeOrphans: false, archiveOrphans: true });
    expect(policy.removeOrphans).toBe(false);
    expect(policy.archiveOrphans).toBe(true);
  });

  it('passes isModelPolicy type guard (positive)', () => {
    const policy = model('res.partner', { removeOrphans: true });
    expect(isModelPolicy(policy)).toBe(true);
  });

  it('passes isModelPolicy type guard (negative)', () => {
    expect(isModelPolicy(null)).toBe(false);
    expect(isModelPolicy(undefined)).toBe(false);
    expect(isModelPolicy({ __type: 'resource' })).toBe(false);
    expect(isModelPolicy('string')).toBe(false);
  });

  it('result is frozen (immutable)', () => {
    const policy = model('res.partner', { removeOrphans: true });
    expect(Object.isFrozen(policy)).toBe(true);
  });
});
