import { readFileSync } from 'node:fs';

export type Op = 'read' | 'write' | 'delete' | 'raw';

export interface PolicyRule {
  model: string;
  ops: Op[];
}

const VALID_OPS: ReadonlySet<Op> = new Set(['read', 'write', 'delete', 'raw']);

export const DEFAULT_POLICY: PolicyRule[] = [{ model: '*', ops: ['read'] }];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function matchModel(pattern: string, model: string): boolean {
  if (pattern === '*') {
    return true;
  }

  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -1);
    return model.startsWith(prefix);
  }

  return pattern === model;
}

export function normalizePolicy(input: unknown): PolicyRule[] {
  if (!Array.isArray(input)) {
    throw new Error('Policy must be an array of rules.');
  }

  const normalized: PolicyRule[] = [];

  for (const rawRule of input) {
    if (!isRecord(rawRule)) {
      throw new Error('Invalid policy rule: expected object.');
    }

    const model = rawRule.model;
    const ops = rawRule.ops;

    if (typeof model !== 'string' || model.trim().length === 0) {
      throw new Error('Invalid policy rule: model must be a non-empty string.');
    }

    if (!Array.isArray(ops) || ops.length === 0) {
      throw new Error(`Invalid policy rule for '${model}': ops must be a non-empty array.`);
    }

    const normalizedOps = ops.map((op) => {
      if (typeof op !== 'string' || !VALID_OPS.has(op as Op)) {
        throw new Error(`Invalid op '${String(op)}' in rule '${model}'.`);
      }
      return op as Op;
    });

    normalized.push({ model, ops: normalizedOps });
  }

  if (normalized.length === 0) {
    throw new Error('Policy must contain at least one rule.');
  }

  return normalized;
}

export function loadPolicyFromString(json: string): PolicyRule[] {
  const parsed = JSON.parse(json) as unknown;
  return normalizePolicy(parsed);
}

export function loadPolicyFromFile(filePath: string): PolicyRule[] {
  const content = readFileSync(filePath, 'utf8');
  return loadPolicyFromString(content);
}

export function loadPolicy(
  options: {
    policyFile?: string;
    policyJson?: string;
  } = {}
): PolicyRule[] {
  const { policyFile, policyJson } = options;

  if (policyFile) {
    return loadPolicyFromFile(policyFile);
  }

  if (policyJson) {
    return loadPolicyFromString(policyJson);
  }

  return DEFAULT_POLICY;
}

export function allows(policy: PolicyRule[], model: string, op: Op): boolean {
  for (const rule of policy) {
    if (matchModel(rule.model, model)) {
      return rule.ops.includes(op);
    }
  }

  return false;
}
