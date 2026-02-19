/**
 * Example 5: Properties Fields - Basic Overview
 *
 * ⚠️ IMPORTANT: This example shows the structure of properties fields only.
 * For actual property updates, use the safe helper functions in the Odoo skill:
 * skills/odoo/base/properties.md
 *
 * Properties are dangerous - they use full-replacement semantics.
 * Writing properties directly causes data loss.
 *
 * Prerequisites:
 * - Odoo instance with CRM module installed
 *
 * Run: npx ts-node packages/odoo-client/examples/5-properties.ts
 */

import {
  OdooClient,
  PropertiesDefinition,
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

    console.log('📚 Properties Fields Structure Demo\n');
    console.log('⚠️  WARNING: For actual property updates, use the safe helpers');
    console.log('    documented in skills/odoo/base/properties.md\n');

    // Get a CRM team
    const teams = await client.searchRead('crm.team', [], { fields: ['id', 'name'], limit: 1 });

    if (teams.length === 0) {
      console.log('❌ No CRM teams found. Install CRM module first.');
      process.exit(1);
    }

    const teamId = teams[0].id;
    console.log(`Using CRM Team: ${teams[0].name} (ID: ${teamId})\n`);

    // ==========================================
    // Part 1: Properties Definition Structure
    // ==========================================

    console.log('📝 Part 1: Properties Definition Structure\n');

    const propertiesDefinition: PropertiesDefinition = [
      {
        name: 'demo_priority',
        string: 'Demo Priority',
        type: 'selection',
        selection: [
          ['low', 'Low'],
          ['high', 'High'],
        ],
      },
      {
        name: 'demo_score',
        string: 'Demo Score',
        type: 'integer',
      },
    ];

    await client.write('crm.team', teamId, {
      lead_properties_definition: propertiesDefinition,
    });

    console.log('✅ Property definitions created');
    console.log('   - demo_priority: selection');
    console.log('   - demo_score: integer\n');

    // ==========================================
    // Part 2: Read/Write Format Differences
    // ==========================================

    console.log('📝 Part 2: Read/Write Format Differences\n');

    // Create a lead with properties
    const leadId = await client.create('crm.lead', {
      name: 'Demo Lead',
      team_id: teamId,
      lead_properties: {
        demo_priority: 'high',
        demo_score: 85,
      },
    });

    // Read properties (returns array with metadata)
    const [lead] = await client.read('crm.lead', [leadId], ['lead_properties']);

    console.log('READ format (array with metadata):');
    console.log(JSON.stringify(lead.lead_properties, null, 2));
    console.log();

    console.log('Helper functions:');
    const priority = getPropertyValue(lead.lead_properties, 'demo_priority');
    const writeFormat = propertiesToWriteFormat(lead.lead_properties);

    console.log(`  getPropertyValue: ${priority}`);
    console.log(`  propertiesToWriteFormat:`, writeFormat);
    console.log();

    // ==========================================
    // Part 3: The Critical Warning
    // ==========================================

    console.log('🚫 Part 3: WHY DIRECT WRITES ARE DANGEROUS\n');

    console.log('❌ NEVER do this (causes data loss):');
    console.log(`
    await client.write('crm.lead', ${leadId}, {
      lead_properties: { demo_priority: 'low' }  // ← Wipes out demo_score!
    });
    `);

    console.log('✅ ALWAYS use safe helpers from skills/odoo/base/properties.md:');
    console.log(`
    await updatePropertiesSafely(client, 'crm.lead', ${leadId}, 'lead_properties', {
      demo_priority: 'low'  // ← Preserves demo_score automatically
    });
    `);

    // ==========================================
    // Cleanup
    // ==========================================

    console.log('🧹 Cleaning up demo data...');
    await client.unlink('crm.lead', [leadId]);

    console.log('✅ Demo complete!\n');
    console.log('📚 Next Steps:');
    console.log('   1. Read skills/odoo/base/properties.md');
    console.log('   2. Copy the safe helper functions');
    console.log('   3. Never write properties directly');
    console.log('   4. Always use updatePropertiesSafely()');

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
