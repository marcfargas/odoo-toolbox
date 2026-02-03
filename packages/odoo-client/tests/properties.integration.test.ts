import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { OdooClient } from '../src/client/odoo-client';
import {
  PropertiesDefinition,
  PropertiesWriteFormat,
  getPropertyValue,
  propertiesToWriteFormat,
  getPropertyDefinition,
} from '../src/types/properties';

describe('Properties Fields Integration', () => {
  const odooUrl = process.env.ODOO_URL || 'http://localhost:8069';
  const odooDb = process.env.ODOO_DB_NAME || 'odoo';
  const odooUser = process.env.ODOO_DB_USER || 'admin';
  const odooPassword = process.env.ODOO_DB_PASSWORD || 'admin';

  let client: OdooClient;
  let teamId: number;
  let leadId: number;

  beforeAll(async () => {
    client = new OdooClient({
      url: odooUrl,
      database: odooDb,
      username: odooUser,
      password: odooPassword,
    });

    await client.authenticate();

    // Get or create a CRM team
    const teams = await client.searchRead('crm.team', [], { limit: 1 });
    if (teams.length === 0) {
      throw new Error('No CRM teams found. Install CRM module first.');
    }
    teamId = teams[0].id;
  });

  afterAll(async () => {
    // Clean up test lead if created
    if (leadId) {
      try {
        await client.unlink('crm.lead', leadId);
      } catch {
        // Ignore cleanup errors
      }
    }
    client.logout();
  });

  describe('PropertiesDefinition', () => {
    it('should create and read property definitions', async () => {
      const propertiesDefinition: PropertiesDefinition = [
        {
          name: 'test_char',
          string: 'Test Character Field',
          type: 'char',
        },
        {
          name: 'test_integer',
          string: 'Test Integer',
          type: 'integer',
        },
        {
          name: 'test_boolean',
          string: 'Test Boolean',
          type: 'boolean',
        },
        {
          name: 'test_selection',
          string: 'Test Selection',
          type: 'selection',
          selection: [
            ['opt1', 'Option 1'],
            ['opt2', 'Option 2'],
          ],
        },
      ];

      // Write definitions
      await client.write('crm.team', teamId, {
        lead_properties_definition: propertiesDefinition,
      });

      // Read back
      const team = await client.read('crm.team', teamId, ['lead_properties_definition']);

      expect(team[0].lead_properties_definition).toBeDefined();
      expect(Array.isArray(team[0].lead_properties_definition)).toBe(true);
      expect(team[0].lead_properties_definition.length).toBe(4);

      const charDef = team[0].lead_properties_definition.find((d: any) => d.name === 'test_char');
      expect(charDef).toBeDefined();
      expect(charDef.type).toBe('char');
      expect(charDef.string).toBe('Test Character Field');
    });
  });

  describe('Properties values', () => {
    it('should create a record with properties', async () => {
      const leadProperties: PropertiesWriteFormat = {
        test_char: 'Hello Properties',
        test_integer: 42,
        test_boolean: true,
        test_selection: 'opt1',
      };

      leadId = await client.create('crm.lead', {
        name: 'Test Lead for Properties',
        team_id: teamId,
        lead_properties: leadProperties,
      });

      expect(leadId).toBeGreaterThan(0);

      // Read back
      const lead = await client.read('crm.lead', leadId, ['lead_properties']);

      expect(lead[0].lead_properties).toBeDefined();
      expect(Array.isArray(lead[0].lead_properties)).toBe(true);
      expect(lead[0].lead_properties.length).toBe(4);
    });

    it('should update properties', async () => {
      const updatedProperties: PropertiesWriteFormat = {
        test_char: 'Updated Text',
        test_integer: 100,
        test_boolean: false,
        test_selection: 'opt2',
      };

      await client.write('crm.lead', leadId, {
        lead_properties: updatedProperties,
      });

      const lead = await client.read('crm.lead', leadId, ['lead_properties']);

      const charValue = getPropertyValue(lead[0].lead_properties, 'test_char');
      const intValue = getPropertyValue(lead[0].lead_properties, 'test_integer');
      const boolValue = getPropertyValue(lead[0].lead_properties, 'test_boolean');
      const selValue = getPropertyValue(lead[0].lead_properties, 'test_selection');

      expect(charValue).toBe('Updated Text');
      expect(intValue).toBe(100);
      expect(boolValue).toBe(false);
      expect(selValue).toBe('opt2');
    });

    it('should handle partial updates (replaces unspecified with false)', async () => {
      // IMPORTANT: Odoo's behavior is to replace unspecified properties with false
      // To update only some properties, you must read first, modify, then write all
      const lead = await client.read('crm.lead', leadId, ['lead_properties']);
      const currentProps = propertiesToWriteFormat(lead[0].lead_properties);

      // Modify only what we want to change
      currentProps.test_integer = 999;

      await client.write('crm.lead', leadId, {
        lead_properties: currentProps,
      });

      const updatedLead = await client.read('crm.lead', leadId, ['lead_properties']);

      const intValue = getPropertyValue(updatedLead[0].lead_properties, 'test_integer');
      const charValue = getPropertyValue(updatedLead[0].lead_properties, 'test_char');

      expect(intValue).toBe(999);
      expect(charValue).toBe('Updated Text'); // Preserved because we wrote all properties
    });
  });

  describe('Helper functions', () => {
    it('should extract property value by name', async () => {
      // First ensure we have known properties
      const knownProps: PropertiesWriteFormat = {
        test_char: 'Known Value',
        test_integer: 123,
        test_boolean: true,
        test_selection: 'opt1',
      };

      await client.write('crm.lead', leadId, {
        lead_properties: knownProps,
      });

      const lead = await client.read('crm.lead', leadId, ['lead_properties']);

      const value = getPropertyValue(lead[0].lead_properties, 'test_char');
      expect(value).toBe('Known Value');

      const nonExistent = getPropertyValue(lead[0].lead_properties, 'non_existent');
      expect(nonExistent).toBeUndefined();
    });

    it('should convert properties to write format', async () => {
      const lead = await client.read('crm.lead', leadId, ['lead_properties']);

      const writeFormat = propertiesToWriteFormat(lead[0].lead_properties);

      expect(writeFormat).toEqual({
        test_char: 'Known Value',
        test_integer: 123,
        test_boolean: true,
        test_selection: 'opt1',
      });
    });

    it('should get property definition by name', async () => {
      const team = await client.read('crm.team', teamId, ['lead_properties_definition']);

      const charDef = getPropertyDefinition(team[0].lead_properties_definition, 'test_char');
      expect(charDef).toBeDefined();
      expect(charDef?.type).toBe('char');
      expect(charDef?.string).toBe('Test Character Field');

      const nonExistent = getPropertyDefinition(team[0].lead_properties_definition, 'non_existent');
      expect(nonExistent).toBeUndefined();
    });
  });

  describe('Property type support', () => {
    it('should support float properties', async () => {
      const definitions: PropertiesDefinition = [
        {
          name: 'test_float',
          string: 'Test Float',
          type: 'float',
        },
      ];

      await client.write('crm.team', teamId, {
        lead_properties_definition: definitions,
      });

      await client.write('crm.lead', leadId, {
        lead_properties: { test_float: 3.14159 },
      });

      const lead = await client.read('crm.lead', leadId, ['lead_properties']);
      const floatValue = getPropertyValue(lead[0].lead_properties, 'test_float');

      expect(floatValue).toBeCloseTo(3.14159, 5);
    });

    it('should support date properties', async () => {
      const definitions: PropertiesDefinition = [
        {
          name: 'test_date',
          string: 'Test Date',
          type: 'date',
        },
      ];

      await client.write('crm.team', teamId, {
        lead_properties_definition: definitions,
      });

      await client.write('crm.lead', leadId, {
        lead_properties: { test_date: '2024-01-15' },
      });

      const lead = await client.read('crm.lead', leadId, ['lead_properties']);
      const dateValue = getPropertyValue(lead[0].lead_properties, 'test_date');

      expect(dateValue).toBe('2024-01-15');
    });

    it('should support datetime properties', async () => {
      const definitions: PropertiesDefinition = [
        {
          name: 'test_datetime',
          string: 'Test DateTime',
          type: 'datetime',
        },
      ];

      await client.write('crm.team', teamId, {
        lead_properties_definition: definitions,
      });

      const testDateTime = '2024-01-15 10:30:00';
      await client.write('crm.lead', leadId, {
        lead_properties: { test_datetime: testDateTime },
      });

      const lead = await client.read('crm.lead', leadId, ['lead_properties']);
      const datetimeValue = getPropertyValue(lead[0].lead_properties, 'test_datetime');

      expect(datetimeValue).toBe(testDateTime);
    });
  });
});
