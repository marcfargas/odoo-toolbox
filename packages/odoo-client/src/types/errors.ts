/**
 * Error classes for Odoo RPC operations
 *
 * Hierarchy:
 *   OdooError                    — base, has .toJSON()
 *   ├── OdooRpcError             — generic RPC (code, data)
 *   │   ├── OdooAuthError        — AccessDenied, invalid credentials
 *   │   ├── OdooNetworkError     — connection issues
 *   │   │   └── OdooTimeoutError — request timeout
 *   │   ├── OdooValidationError  — ValidationError + UserError
 *   │   ├── OdooAccessError      — AccessError (ACL/record rules)
 *   │   └── OdooMissingError     — MissingError (record not found)
 *   └── OdooSafetyError          — blocked by safety guard (local, not RPC)
 */

import type { OperationInfo } from '../safety';

/**
 * Structured error shape for JSON serialization.
 * Agents parse the `error` field for programmatic matching.
 */
export interface ErrorJSON {
  error: string;
  message: string;
  details?: unknown;
}

/**
 * Base error for all Odoo-related exceptions.
 * Every error has .toJSON() for structured output.
 */
export class OdooError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OdooError';
    Object.setPrototypeOf(this, OdooError.prototype);
  }

  toJSON(): ErrorJSON {
    return { error: 'ODOO_ERROR', message: this.message };
  }
}

/**
 * Error thrown when RPC call fails.
 * Base class for all server-side Odoo errors.
 */
export class OdooRpcError extends OdooError {
  public readonly code?: string;
  public readonly data?: Record<string, any>;

  constructor(
    message: string,
    options?: {
      code?: string;
      data?: Record<string, any>;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'OdooRpcError';
    this.code = options?.code;
    this.data = options?.data;
    if (options?.cause) {
      this.cause = options.cause;
    }
    Object.setPrototypeOf(this, OdooRpcError.prototype);
  }

  toJSON(): ErrorJSON {
    return {
      error: 'RPC_ERROR',
      message: this.message,
      details: { code: this.code, data: this.data },
    };
  }
}

/**
 * Error thrown when authentication fails
 */
export class OdooAuthError extends OdooRpcError {
  constructor(message: string = 'Authentication failed') {
    super(message);
    this.name = 'OdooAuthError';
    Object.setPrototypeOf(this, OdooAuthError.prototype);
  }

  toJSON(): ErrorJSON {
    return { error: 'AUTH_ERROR', message: this.message };
  }
}

/**
 * Error thrown for network/connection issues
 */
export class OdooNetworkError extends OdooRpcError {
  constructor(message: string, cause: Error) {
    super(message, { cause });
    this.name = 'OdooNetworkError';
    Object.setPrototypeOf(this, OdooNetworkError.prototype);
  }

  toJSON(): ErrorJSON {
    return {
      error: 'NETWORK_ERROR',
      message: this.message,
      details: { cause: this.cause instanceof Error ? this.cause.message : undefined },
    };
  }
}

/**
 * Error thrown when a request times out
 */
export class OdooTimeoutError extends OdooNetworkError {
  constructor(message: string, cause: Error) {
    super(message, cause);
    this.name = 'OdooTimeoutError';
    Object.setPrototypeOf(this, OdooTimeoutError.prototype);
  }

  toJSON(): ErrorJSON {
    return { error: 'TIMEOUT_ERROR', message: this.message };
  }
}

/**
 * Error thrown when Odoo rejects data (ValidationError, UserError).
 *
 * Common causes: missing required fields, constraint violations,
 * business logic rejections.
 *
 * @see https://github.com/odoo/odoo/blob/17.0/odoo/exceptions.py
 */
export class OdooValidationError extends OdooRpcError {
  constructor(message: string, options?: { code?: string; data?: Record<string, any> }) {
    super(message, options);
    this.name = 'OdooValidationError';
    Object.setPrototypeOf(this, OdooValidationError.prototype);
  }

  toJSON(): ErrorJSON {
    return {
      error: 'VALIDATION_ERROR',
      message: this.message,
      details: this.data,
    };
  }
}

/**
 * Error thrown when user lacks permissions (AccessError).
 *
 * Common causes: ACL restrictions, record rules, group-based access.
 *
 * @see https://github.com/odoo/odoo/blob/17.0/odoo/exceptions.py
 */
export class OdooAccessError extends OdooRpcError {
  constructor(message: string, options?: { code?: string; data?: Record<string, any> }) {
    super(message, options);
    this.name = 'OdooAccessError';
    Object.setPrototypeOf(this, OdooAccessError.prototype);
  }

  toJSON(): ErrorJSON {
    return {
      error: 'ACCESS_ERROR',
      message: this.message,
      details: this.data,
    };
  }
}

/**
 * Error thrown when a record doesn't exist (MissingError).
 *
 * Common causes: reading/writing a deleted record, stale cached IDs.
 *
 * @see https://github.com/odoo/odoo/blob/17.0/odoo/exceptions.py
 */
export class OdooMissingError extends OdooRpcError {
  constructor(message: string, options?: { code?: string; data?: Record<string, any> }) {
    super(message, options);
    this.name = 'OdooMissingError';
    Object.setPrototypeOf(this, OdooMissingError.prototype);
  }

  toJSON(): ErrorJSON {
    return {
      error: 'MISSING_ERROR',
      message: this.message,
      details: this.data,
    };
  }
}

/**
 * Error thrown when an operation is blocked by the safety guard.
 *
 * This is a LOCAL error — it happens before any RPC call.
 * Does NOT extend OdooRpcError.
 */
export class OdooSafetyError extends OdooError {
  public readonly operation: OperationInfo;

  constructor(operation: OperationInfo) {
    super(`Operation blocked: ${operation.description}`);
    this.name = 'OdooSafetyError';
    this.operation = operation;
    Object.setPrototypeOf(this, OdooSafetyError.prototype);
  }

  toJSON(): ErrorJSON {
    return {
      error: 'SAFETY_BLOCKED',
      message: this.message,
      details: { operation: this.operation },
    };
  }
}
