/**
 * Error classes for Odoo RPC operations
 */

/**
 * Base error for all Odoo-related exceptions
 */
export class OdooError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OdooError';
    Object.setPrototypeOf(this, OdooError.prototype);
  }
}

/**
 * Error thrown when RPC call fails
 *
 * Handles both network errors and Odoo-specific RPC errors
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
}
