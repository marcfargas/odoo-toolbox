import { OdooError, OdooRpcError, OdooAuthError, OdooNetworkError } from '@odoo-toolbox/client';
import { ZodError } from 'zod';

export type McpErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'CONNECTION_FAILED'
  | 'INVALID_INPUT'
  | 'ODOO_RPC_ERROR'
  | 'ODOO_NOT_FOUND'
  | 'ODOO_ACCESS_DENIED'
  | 'INTERNAL_ERROR';

export interface McpError {
  code: McpErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface McpErrorResponse {
  success: false;
  error: McpError;
}

export function formatError(error: unknown): McpErrorResponse {
  if (error instanceof ZodError) {
    return {
      success: false,
      error: {
        code: 'INVALID_INPUT',
        message: 'Invalid input parameters',
        details: {
          issues: error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
      },
    };
  }

  if (error instanceof OdooAuthError) {
    return {
      success: false,
      error: {
        code: 'NOT_AUTHENTICATED',
        message: error.message,
      },
    };
  }

  if (error instanceof OdooNetworkError) {
    const causeMessage = error.cause instanceof Error ? error.cause.message : String(error.cause);
    return {
      success: false,
      error: {
        code: 'CONNECTION_FAILED',
        message: error.message,
        details: { cause: causeMessage },
      },
    };
  }

  if (error instanceof OdooRpcError) {
    // Check for common error patterns
    const message = error.message.toLowerCase();
    if (message.includes('access denied') || message.includes('not allowed')) {
      return {
        success: false,
        error: {
          code: 'ODOO_ACCESS_DENIED',
          message: error.message,
          details: { code: error.code, data: error.data },
        },
      };
    }
    if (message.includes('does not exist') || message.includes('not found')) {
      return {
        success: false,
        error: {
          code: 'ODOO_NOT_FOUND',
          message: error.message,
          details: { code: error.code, data: error.data },
        },
      };
    }
    return {
      success: false,
      error: {
        code: 'ODOO_RPC_ERROR',
        message: error.message,
        details: { code: error.code, data: error.data },
      },
    };
  }

  if (error instanceof OdooError) {
    return {
      success: false,
      error: {
        code: 'ODOO_RPC_ERROR',
        message: error.message,
      },
    };
  }

  if (error instanceof Error) {
    // Check for authentication errors from session manager
    if (error.message.includes('Not authenticated')) {
      return {
        success: false,
        error: {
          code: 'NOT_AUTHENTICATED',
          message: error.message,
        },
      };
    }
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message,
      },
    };
  }

  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: String(error),
    },
  };
}

export function isErrorResponse(response: unknown): response is McpErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    (response as McpErrorResponse).success === false &&
    'error' in response
  );
}
