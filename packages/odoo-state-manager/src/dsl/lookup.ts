import type { LookupDomain, LookupRef } from './types';

export function lookup(model: string, domain: LookupDomain): LookupRef {
  return Object.freeze({ __type: 'lookup' as const, model, domain });
}
