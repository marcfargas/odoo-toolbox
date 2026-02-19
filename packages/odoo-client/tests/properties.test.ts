import { describe, it, expect } from 'vitest';
import { OdooClient } from '../src/client/odoo-client';
import { PropertiesService } from '../src/services/properties/properties-service';

describe('Properties Service', () => {
  it('should be accessible via client.properties', () => {
    const client = new OdooClient({
      url: 'http://test.example.com',
      database: 'test',
      username: 'test',
      password: 'test',
    });

    expect(client.properties).toBeInstanceOf(PropertiesService);
    expect(client.properties).toBe(client.properties); // Should be cached
  });

  it('should have the expected methods', () => {
    const client = new OdooClient({
      url: 'http://test.example.com',
      database: 'test',
      username: 'test',
      password: 'test',
    });

    const service = client.properties;

    expect(typeof service.updateSafely).toBe('function');
    expect(typeof service.updateSafelyBatch).toBe('function');
    expect(typeof service.getCurrentWriteFormat).toBe('function');
  });
});
