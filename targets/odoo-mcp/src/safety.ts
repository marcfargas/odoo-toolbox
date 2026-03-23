import type { OperationInfo, SafetyContext, SafetyLevel } from '@marcfargas/odoo-client';
import { allows, type Op, type PolicyRule } from './policy';

export function mapToOp(level: SafetyLevel): Op {
  if (level === 'READ') return 'read';
  if (level === 'DELETE') return 'delete';
  return 'write';
}

export function createMcpSafetyContext(getPolicy: () => PolicyRule[]): SafetyContext {
  const mcpSafety: SafetyContext = {
    confirm: async (op: OperationInfo): Promise<boolean> => {
      const currentPolicy = getPolicy();
      return allows(currentPolicy, op.model, mapToOp(op.level));
    },
  };

  return mcpSafety;
}
