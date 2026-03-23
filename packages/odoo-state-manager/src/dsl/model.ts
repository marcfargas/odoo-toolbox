import type { ModelPolicy } from './types';

export function model(
  modelName: string,
  policy: { removeOrphans?: boolean; archiveOrphans?: boolean }
): ModelPolicy {
  return Object.freeze({
    __type: 'model' as const,
    model: modelName,
    ...(policy.removeOrphans !== undefined ? { removeOrphans: policy.removeOrphans } : {}),
    ...(policy.archiveOrphans !== undefined ? { archiveOrphans: policy.archiveOrphans } : {}),
  });
}
