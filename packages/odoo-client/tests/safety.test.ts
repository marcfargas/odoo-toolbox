/**
 * Tests for the safety module and error hierarchy
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  OdooError,
  OdooRpcError,
  OdooAuthError,
  OdooNetworkError,
  OdooTimeoutError,
  OdooValidationError,
  OdooAccessError,
  OdooMissingError,
  OdooSafetyError,
  inferSafetyLevel,
  READ_METHODS,
  DELETE_METHODS,
  setDefaultSafetyContext,
  getDefaultSafetyContext,
  resolveSafetyContext,
  configFromEnv,
} from '../src';
import type { SafetyContext, OperationInfo } from '../src';

// ─── Error Hierarchy ───

describe('Error Hierarchy', () => {
  describe('OdooError', () => {
    it('is the base error', () => {
      const err = new OdooError('test');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(OdooError);
      expect(err.message).toBe('test');
    });

    it('has toJSON with ODOO_ERROR code', () => {
      const err = new OdooError('test');
      const json = err.toJSON();
      expect(json.error).toBe('ODOO_ERROR');
      expect(json.message).toBe('test');
    });
  });

  describe('OdooRpcError', () => {
    it('extends OdooError', () => {
      const err = new OdooRpcError('rpc fail', { code: '200', data: { foo: 1 } });
      expect(err).toBeInstanceOf(OdooError);
      expect(err).toBeInstanceOf(OdooRpcError);
      expect(err.code).toBe('200');
      expect(err.data).toEqual({ foo: 1 });
    });

    it('has toJSON with RPC_ERROR code', () => {
      const json = new OdooRpcError('fail', { code: '200' }).toJSON();
      expect(json.error).toBe('RPC_ERROR');
      expect(json.details).toEqual({ code: '200', data: undefined });
    });
  });

  describe('OdooAuthError', () => {
    it('extends OdooRpcError', () => {
      const err = new OdooAuthError('bad creds');
      expect(err).toBeInstanceOf(OdooRpcError);
      expect(err).toBeInstanceOf(OdooError);
    });

    it('has toJSON with AUTH_ERROR code', () => {
      expect(new OdooAuthError().toJSON().error).toBe('AUTH_ERROR');
    });
  });

  describe('OdooNetworkError', () => {
    it('extends OdooRpcError with cause', () => {
      const cause = new Error('ECONNREFUSED');
      const err = new OdooNetworkError('cannot connect', cause);
      expect(err).toBeInstanceOf(OdooRpcError);
      expect(err.cause).toBe(cause);
    });

    it('has toJSON with NETWORK_ERROR code', () => {
      const json = new OdooNetworkError('fail', new Error('cause')).toJSON();
      expect(json.error).toBe('NETWORK_ERROR');
      expect((json.details as any).cause).toBe('cause');
    });
  });

  describe('OdooTimeoutError', () => {
    it('extends OdooNetworkError', () => {
      const err = new OdooTimeoutError('timeout', new Error('timeout'));
      expect(err).toBeInstanceOf(OdooNetworkError);
      expect(err).toBeInstanceOf(OdooRpcError);
    });

    it('has toJSON with TIMEOUT_ERROR code', () => {
      expect(new OdooTimeoutError('t', new Error('t')).toJSON().error).toBe('TIMEOUT_ERROR');
    });
  });

  describe('OdooValidationError', () => {
    it('extends OdooRpcError', () => {
      const err = new OdooValidationError('required field missing');
      expect(err).toBeInstanceOf(OdooRpcError);
    });

    it('has toJSON with VALIDATION_ERROR code', () => {
      expect(new OdooValidationError('fail').toJSON().error).toBe('VALIDATION_ERROR');
    });
  });

  describe('OdooAccessError', () => {
    it('extends OdooRpcError', () => {
      const err = new OdooAccessError('no permission');
      expect(err).toBeInstanceOf(OdooRpcError);
    });

    it('has toJSON with ACCESS_ERROR code', () => {
      expect(new OdooAccessError('fail').toJSON().error).toBe('ACCESS_ERROR');
    });
  });

  describe('OdooMissingError', () => {
    it('extends OdooRpcError', () => {
      const err = new OdooMissingError('record not found');
      expect(err).toBeInstanceOf(OdooRpcError);
    });

    it('has toJSON with MISSING_ERROR code', () => {
      expect(new OdooMissingError('fail').toJSON().error).toBe('MISSING_ERROR');
    });
  });

  describe('OdooSafetyError', () => {
    it('extends OdooError but NOT OdooRpcError', () => {
      const op: OperationInfo = {
        name: 'odoo.unlink',
        level: 'DELETE',
        model: 'res.partner',
        description: 'Delete 3 records from res.partner',
      };
      const err = new OdooSafetyError(op);
      expect(err).toBeInstanceOf(OdooError);
      expect(err).not.toBeInstanceOf(OdooRpcError);
      expect(err.operation).toBe(op);
    });

    it('has toJSON with SAFETY_BLOCKED code', () => {
      const op: OperationInfo = {
        name: 'odoo.unlink',
        level: 'DELETE',
        model: 'res.partner',
        description: 'Delete records',
      };
      const json = new OdooSafetyError(op).toJSON();
      expect(json.error).toBe('SAFETY_BLOCKED');
      expect((json.details as any).operation.name).toBe('odoo.unlink');
    });
  });

  describe('instanceof compatibility', () => {
    it('all RPC errors are caught by OdooRpcError', () => {
      const errors = [
        new OdooAuthError(),
        new OdooNetworkError('n', new Error('e')),
        new OdooTimeoutError('t', new Error('e')),
        new OdooValidationError('v'),
        new OdooAccessError('a'),
        new OdooMissingError('m'),
      ];
      for (const err of errors) {
        expect(err).toBeInstanceOf(OdooRpcError);
        expect(err).toBeInstanceOf(OdooError);
      }
    });

    it('OdooSafetyError is NOT caught by OdooRpcError', () => {
      const err = new OdooSafetyError({
        name: 'test',
        level: 'WRITE',
        model: 'test',
        description: 'test',
      });
      expect(err).toBeInstanceOf(OdooError);
      expect(err).not.toBeInstanceOf(OdooRpcError);
    });
  });
});

// ─── Safety Level Inference ───

describe('inferSafetyLevel', () => {
  it('classifies known read methods as READ', () => {
    for (const method of READ_METHODS) {
      expect(inferSafetyLevel(method)).toBe('READ');
    }
  });

  it('classifies unlink as DELETE', () => {
    for (const method of DELETE_METHODS) {
      expect(inferSafetyLevel(method)).toBe('DELETE');
    }
  });

  it('classifies unknown methods as WRITE (safe default)', () => {
    expect(inferSafetyLevel('create')).toBe('WRITE');
    expect(inferSafetyLevel('write')).toBe('WRITE');
    expect(inferSafetyLevel('action_confirm')).toBe('WRITE');
    expect(inferSafetyLevel('message_post')).toBe('WRITE');
    expect(inferSafetyLevel('custom_method')).toBe('WRITE');
  });
});

// ─── Safety Context Resolution ───

describe('Safety Context Resolution', () => {
  const testCtx: SafetyContext = { confirm: async () => true };
  const blockCtx: SafetyContext = { confirm: async () => false };

  afterEach(() => {
    setDefaultSafetyContext(null);
  });

  describe('setDefaultSafetyContext / getDefaultSafetyContext', () => {
    it('defaults to null', () => {
      expect(getDefaultSafetyContext()).toBeNull();
    });

    it('can be set and retrieved', () => {
      setDefaultSafetyContext(testCtx);
      expect(getDefaultSafetyContext()).toBe(testCtx);
    });

    it('can be reset to null', () => {
      setDefaultSafetyContext(testCtx);
      setDefaultSafetyContext(null);
      expect(getDefaultSafetyContext()).toBeNull();
    });
  });

  describe('resolveSafetyContext', () => {
    it('returns null when no context set anywhere', () => {
      expect(resolveSafetyContext(undefined)).toBeNull();
    });

    it('uses global default when client context is undefined', () => {
      setDefaultSafetyContext(testCtx);
      expect(resolveSafetyContext(undefined)).toBe(testCtx);
    });

    it('per-client null overrides global default', () => {
      setDefaultSafetyContext(testCtx);
      expect(resolveSafetyContext(null)).toBeNull();
    });

    it('per-client context overrides global default', () => {
      setDefaultSafetyContext(testCtx);
      expect(resolveSafetyContext(blockCtx)).toBe(blockCtx);
    });
  });
});

// ─── configFromEnv ───

describe('configFromEnv', () => {
  afterEach(() => {
    // Restore original env
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('TEST_ODOO_')) {
        delete process.env[key];
      }
    }
  });

  it('reads env vars with given prefix', () => {
    process.env.TEST_ODOO_URL = 'http://localhost:8069';
    process.env.TEST_ODOO_DB = 'mydb';
    process.env.TEST_ODOO_USER = 'admin';
    process.env.TEST_ODOO_PASSWORD = 'secret';

    const config = configFromEnv('TEST_ODOO');
    expect(config.url).toBe('http://localhost:8069');
    expect(config.database).toBe('mydb');
    expect(config.username).toBe('admin');
    expect(config.password).toBe('secret');
  });

  it('supports DATABASE and USERNAME aliases', () => {
    process.env.TEST_ODOO_URL = 'http://localhost:8069';
    process.env.TEST_ODOO_DATABASE = 'mydb';
    process.env.TEST_ODOO_USERNAME = 'admin';
    process.env.TEST_ODOO_PASSWORD = 'secret';

    const config = configFromEnv('TEST_ODOO');
    expect(config.database).toBe('mydb');
    expect(config.username).toBe('admin');
  });

  it('throws OdooError when env vars are missing', () => {
    expect(() => configFromEnv('TEST_ODOO')).toThrow(OdooError);
    expect(() => configFromEnv('TEST_ODOO')).toThrow('Missing environment variables');
  });

  it('lists all missing vars in error message', () => {
    process.env.TEST_ODOO_URL = 'http://localhost';
    try {
      configFromEnv('TEST_ODOO');
    } catch (e: any) {
      expect(e.message).toContain('TEST_ODOO_DB');
      expect(e.message).toContain('TEST_ODOO_USER');
      expect(e.message).toContain('TEST_ODOO_PASSWORD');
      expect(e.message).not.toContain('TEST_ODOO_URL');
    }
  });
});
