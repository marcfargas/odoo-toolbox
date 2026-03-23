import { readdir } from 'fs/promises';
import { join } from 'path';
import createDebug from 'debug';
import { isResourceDefinition, isModelPolicy } from '../dsl/types';
import type { ResourceDefinition, ModelPolicy } from '../dsl/types';
import type { EvaluationResult } from './types';

const debug = createDebug('odoo-state-manager:evaluate');

/** Recursively collect all .ts files, skipping node_modules and .d.ts files. */
async function collectTsFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name === 'node_modules') continue;

    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      const nested = await collectTsFiles(fullPath);
      files.push(...nested);
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

/** Flatten any value to an array of primitives/objects (handles nested arrays). */
function flattenDeep(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return (value as unknown[]).flatMap(flattenDeep);
  }
  return [value];
}

/** Collect all exported definitions from a dynamically imported module. */
function collectFromModule(mod: Record<string, unknown>): {
  resources: ResourceDefinition[];
  policies: ModelPolicy[];
} {
  const resources: ResourceDefinition[] = [];
  const policies: ModelPolicy[] = [];

  for (const [key, value] of Object.entries(mod)) {
    debug('  export %s: %o', key, value);
    const items = flattenDeep(value);
    for (const item of items) {
      if (isResourceDefinition(item)) {
        resources.push(item);
      } else if (isModelPolicy(item)) {
        policies.push(item);
      }
    }
  }

  return { resources, policies };
}

/**
 * Discover all .ts files in `dir`, dynamically import each one, and collect
 * all exported ResourceDefinitions and ModelPolicies.
 */
export async function evaluate(dir: string): Promise<EvaluationResult> {
  debug('evaluating directory: %s', dir);

  const files = (await collectTsFiles(dir)).sort();
  debug('found %d files: %o', files.length, files);

  const resources: ResourceDefinition[] = [];
  const policies: ModelPolicy[] = [];

  for (const file of files) {
    debug('importing %s', file);
    // Use pathToFileURL for cross-platform compatibility with dynamic import
    const { pathToFileURL } = await import('url');
    const mod = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
    const collected = collectFromModule(mod);
    debug('  -> %d resources, %d policies', collected.resources.length, collected.policies.length);
    resources.push(...collected.resources);
    policies.push(...collected.policies);
  }

  return { resources, policies, files };
}
