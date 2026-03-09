import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ZodError } from 'zod';
import {
  OdooAccessError,
  OdooAuthError,
  OdooNetworkError,
  OdooTimeoutError,
  OdooValidationError,
} from '@marcfargas/odoo-client';

export type ErrorCode =
  | 'AUTH_ERROR'
  | 'POLICY_DENIED'
  | 'VALIDATION_ERROR'
  | 'ODOO_ACCESS'
  | 'LIMIT_ERROR'
  | 'OVERSIZE'
  | 'RPC_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR';

function safeMessage(input: unknown, fallback: string): string {
  if (typeof input !== 'string' || input.trim().length === 0) {
    return fallback;
  }

  const firstLine = input.split('\n')[0]?.trim() ?? fallback;

  if (firstLine.toLowerCase().includes('traceback')) {
    return fallback;
  }

  return firstLine;
}

export function mcpError(code: ErrorCode, message: string): CallToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: `${code}: ${message}` }],
  };
}

export function toValidationError(error: ZodError): CallToolResult {
  const first = error.issues[0];
  const path = first?.path.join('.') || 'arguments';
  const message = first?.message ?? 'Invalid arguments.';
  return mcpError('VALIDATION_ERROR', `${path}: ${message}`);
}

export function formatMcpError(err: unknown): CallToolResult {
  if (err instanceof OdooAuthError) {
    return mcpError('AUTH_ERROR', 'Odoo authentication failed. Check ODOO_USER and ODOO_PASSWORD.');
  }

  if (err instanceof OdooValidationError) {
    return mcpError('VALIDATION_ERROR', safeMessage(err.message, 'Invalid request.'));
  }

  if (err instanceof OdooAccessError) {
    return mcpError(
      'ODOO_ACCESS',
      safeMessage(err.message, 'Access denied — check Odoo user permissions.')
    );
  }

  if (err instanceof OdooTimeoutError) {
    return mcpError('TIMEOUT_ERROR', 'Odoo RPC timed out.');
  }

  if (err instanceof OdooNetworkError) {
    return mcpError('NETWORK_ERROR', safeMessage(err.message, 'Cannot reach Odoo endpoint.'));
  }

  if (err instanceof Error) {
    const message = err.message ?? '';

    if (/AccessError/i.test(message)) {
      return mcpError('ODOO_ACCESS', 'Access denied — check Odoo user permissions.');
    }

    if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|network/i.test(message)) {
      return mcpError('NETWORK_ERROR', safeMessage(message, 'Cannot reach Odoo endpoint.'));
    }

    if (/timeout|timed out/i.test(message)) {
      return mcpError('TIMEOUT_ERROR', safeMessage(message, 'Odoo RPC timed out.'));
    }

    return mcpError('RPC_ERROR', safeMessage(message, 'Odoo RPC failed.'));
  }

  return mcpError('RPC_ERROR', 'Odoo RPC failed.');
}
