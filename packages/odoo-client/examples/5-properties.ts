/**
 * Example 5: Working with Properties Fields
 *
 * Demonstrates how to:
 * - Read and write PropertiesDefinition fields
 * - Create and update properties values
 * - Convert between read and write formats
 * - Use helper functions for properties
 *
 * Prerequisites:
 * - Odoo instance with CRM or Project module installed
 * - Properties-enabled models (e.g., crm.lead, project.task)
 *
 * Run: npx ts-node packages/odoo-client/examples/5-properties.ts
 */

import {
  OdooClient,
  PropertiesDefinition,
  PropertiesWriteFormat,
  getPropertyValue,
  propertiesToWriteFormat,
} from '../src';

async function main() {
  const client = new OdooClient({
    url: process.env.ODOO_URL || 'http://localhost:8069',
    database: process.env.ODOO_DATABASE || 'odoo',
    username: process.env.ODOO_USERNAME || 'admin',
    password: process.env.ODOO_PASSWORD || 'admin',
  });

  try {
    await client.authenticate();
    console.log('🔐 Authenticated\n');

    // ==========================================
    // Part 1: Creating Property Definitions
    // ==========================================

    console.log('📝 Part 1: Creating Property Definitions\n');

    // Get a CRM team to define properties on
    const teams = await client.searchRead('crm.team', [], { fields: ['id', 'name'], limit: 1 });

    if (teams.length === 0) {
      console.log('❌ No CRM teams found. Install CRM module first.');
      process.exit(1);
    }

    const teamId = teams[0].id;
    console.log(`Working with CRM Team: ${teams[0].name} (ID: ${teamId})\n`);

    // Define custom properties
    // Each property needs: name, type, and string (label)
    const propertiesDefinition: PropertiesDefinition = [
      {
        name: 'priority_level',
        string: 'Priority Level',
        type: 'selection',
        selection: [
          ['low', 'Low'],
          ['medium', 'Medium'],
          ['high', 'High'],
          ['critical', 'Critical'],
        ],
      },
      {
        name: 'estimated_revenue',
        string: 'Estimated Revenue',
        type: 'float',
      },
      {
        name: 'contact_attempts',
        string: 'Contact Attempts',
        type: 'integer',
      },
      {
        name: 'special_notes',
        string: 'Special Notes',
        type: 'char', // Note: use 'char' not 'text' - only standard types are allowed
      },
      {
        name: 'requires_approval',
        string: 'Requires Approval',
        type: 'boolean',
      },
    ];

    console.log('Creating property definitions...');
    await client.write('crm.team', teamId, {
      lead_properties_definition: propertiesDefinition,
    });
    console.log('✅ Property definitions created\n');

    // Read back the definitions
    const teamData = await client.read('crm.team', teamId, ['lead_properties_definition']);

    console.log('Stored property definitions:');
    teamData[0].lead_properties_definition.forEach((def: any) => {
      console.log(`  - ${def.string} (${def.name}): ${def.type}`);
    });
    console.log();

    // ==========================================
    // Part 2: Creating Records with Properties
    // ==========================================

    console.log('📝 Part 2: Creating Records with Properties\n');

    // When creating/writing, use simple key-value format
    const leadProperties: PropertiesWriteFormat = {
      priority_level: 'high',
      estimated_revenue: 50000.0,
      contact_attempts: 3,
      special_notes: 'VIP customer, handle with care',
      requires_approval: true,
    };

    console.log('Creating lead with properties...');
    const leadId = await client.create('crm.lead', {
      name: 'High Priority Deal',
      team_id: teamId,
      lead_properties: leadProperties,
    });
    console.log(`✅ Lead created with ID: ${leadId}\n`);

    // ==========================================
    // Part 3: Reading Properties
    // ==========================================

    console.log('📝 Part 3: Reading Properties\n');

    // When reading, Odoo returns full metadata
    const leadData = await client.read('crm.lead', leadId, ['name', 'lead_properties']);

    const lead = leadData[0];
    console.log(`Lead: ${lead.name}`);
    console.log('Properties (read format - array with metadata):');
    console.log(JSON.stringify(lead.lead_properties, null, 2));
    console.log();

    // ==========================================
    // Part 4: Using Helper Functions
    // ==========================================

    console.log('📝 Part 4: Using Helper Functions\n');

    // Extract specific property value
    const priorityLevel = getPropertyValue(lead.lead_properties, 'priority_level');
    const estimatedRevenue = getPropertyValue(lead.lead_properties, 'estimated_revenue');

    console.log('Extracted values:');
    console.log(`  Priority Level: ${priorityLevel}`);
    console.log(`  Estimated Revenue: $${estimatedRevenue}\n`);

    // Convert from read format to write format
    const writeFormat = propertiesToWriteFormat(lead.lead_properties);
    console.log('Converted to write format:');
    console.log(JSON.stringify(writeFormat, null, 2));
    console.log();

    // ==========================================
    // Part 5: Updating Properties
    // ==========================================

    console.log('📝 Part 5: Updating Properties\n');

    // Update some properties
    const updatedProperties: PropertiesWriteFormat = {
      priority_level: 'critical',
      estimated_revenue: 75000.0,
      contact_attempts: 5,
      special_notes: 'VIP customer - CEO contacted directly',
      requires_approval: false, // Approval obtained
    };

    console.log('Updating lead properties...');
    await client.write('crm.lead', leadId, {
      lead_properties: updatedProperties,
    });
    console.log('✅ Properties updated\n');

    // Read updated lead
    const updatedLead = await client.read('crm.lead', leadId, ['name', 'lead_properties']);

    console.log('Updated properties:');
    updatedLead[0].lead_properties.forEach((prop: any) => {
      console.log(`  ${prop.string}: ${JSON.stringify(prop.value)}`);
    });
    console.log();

    // ==========================================
    // Part 6: Partial Updates (Important!)
    // ==========================================

    console.log('📝 Part 6: Understanding Property Updates\n');

    // IMPORTANT: When writing properties, Odoo replaces ALL properties
    // If you only write some properties, others will be set to 'false'
    // To update only specific properties, you must:
    // 1. Read current properties
    // 2. Convert to write format
    // 3. Modify the values you want
    // 4. Write back ALL properties

    console.log('Reading current properties...');
    const currentLead = await client.read('crm.lead', leadId, ['lead_properties']);
    const currentProps = propertiesToWriteFormat(currentLead[0].lead_properties);

    console.log('Current properties:');
    console.log(JSON.stringify(currentProps, null, 2));
    console.log();

    // Modify only what we want to change
    console.log('Updating only contact_attempts to 10...');
    currentProps.contact_attempts = 10;

    await client.write('crm.lead', leadId, {
      lead_properties: currentProps, // Write ALL properties, not just the changed one
    });

    const finalLead = await client.read('crm.lead', leadId, ['lead_properties']);
    const contactAttempts = getPropertyValue(finalLead[0].lead_properties, 'contact_attempts');
    const finalPriorityLevel = getPropertyValue(finalLead[0].lead_properties, 'priority_level');

    console.log(`✅ Contact attempts updated to: ${contactAttempts}`);
    console.log(`✅ Priority level preserved: ${finalPriorityLevel}\n`);

    console.log('🎉 All operations completed successfully!');

    await client.logout();
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ Error:', error.message);
      if (error.stack) console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
