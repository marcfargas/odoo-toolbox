/**
 * Example 3: End-to-End CRM Lead to Sale Workflow
 *
 * Demonstrates how to:
 * - Install required modules (CRM and Sales) if not present
 * - Use introspection to explore CRM and Sales models before working with them
 * - Create and manage CRM leads (crm.lead)
 * - Schedule follow-up activities on records (mail.activity)
 * - Handle relational field requirements (many2one fields)
 * - Create contacts and link them to leads (res.partner)
 * - Create sales quotations from leads (sale.order)
 * - Confirm quotations using action methods
 * - Properly clean up created records
 *
 * Prerequisites:
 * - Odoo instance running
 * - Valid credentials (admin access recommended)
 *
 * Run: npx ts-node packages/odoo-introspection/examples/3-e2e-lead-to-sale.ts
 *
 * Note: This example will install the CRM and Sales modules if not already
 * installed. This is optional for users who already have these modules, but
 * required for our test suite which starts with a blank database.
 */

import { OdooClient, ModuleManager } from '@odoo-toolbox/client';
import { Introspector } from '../src';

// Configuration from environment variables or defaults
const config = {
  url: process.env.ODOO_URL || 'http://localhost:8069',
  database: process.env.ODOO_DB || 'odoo',
  username: process.env.ODOO_USER || 'admin',
  password: process.env.ODOO_PASSWORD || 'admin',
};

// Track created records for cleanup
interface CreatedRecords {
  lead?: number;
  partner?: number;
  activity?: number;
  saleOrder?: number;
}

async function main() {
  const client = new OdooClient(config);
  const createdRecords: CreatedRecords = {};

  try {
    // ============================================================
    // PHASE 1: Authentication
    // ============================================================
    console.log('='.repeat(60));
    console.log('🔐 PHASE 1: Authentication');
    console.log('='.repeat(60));
    console.log('\nConnecting to Odoo...');
    await client.authenticate();
    console.log(`✅ Authenticated as ${config.username}\n`);

    // ============================================================
    // PHASE 2: Ensure Required Modules Are Installed
    // ============================================================
    console.log('='.repeat(60));
    console.log('📦 PHASE 2: Ensure Required Modules Are Installed');
    console.log('='.repeat(60));
    console.log('\n💡 Note: This step is optional if you already have CRM and');
    console.log('   Sales modules installed. We include it for test environments');
    console.log('   that start with a blank database.\n');

    await ensureModulesInstalled(client);

    const introspector = new Introspector(client);

    // ============================================================
    // PHASE 3: Introspection - Explore the Models We'll Use
    // ============================================================
    console.log('\n' + '='.repeat(60));
    console.log('📚 PHASE 3: Introspection - Understanding Our Models');
    console.log('='.repeat(60));
    console.log('\n🔍 Before working with any model, inspect its structure.');
    console.log('   This helps understand required fields and dependencies.\n');

    // Inspect crm.lead
    console.log('🔍 Inspecting crm.lead model...');
    const leadFields = await introspector.getFields('crm.lead');
    const keyLeadFields = leadFields.filter((f) =>
      ['name', 'email_from', 'phone', 'partner_id', 'expected_revenue'].includes(f.name)
    );

    console.log('   Key fields for crm.lead:');
    keyLeadFields.forEach((field) => {
      const required = field.required ? '(required)' : '(optional)';
      const relation = field.relation ? ` → ${field.relation}` : '';
      console.log(`   - ${field.name}: ${field.ttype}${relation} ${required}`);
    });

    // Inspect res.partner
    console.log('\n🔍 Inspecting res.partner model...');
    const partnerFields = await introspector.getFields('res.partner');
    const keyPartnerFields = partnerFields.filter((f) =>
      ['name', 'email', 'phone', 'is_company', 'street', 'city'].includes(f.name)
    );

    console.log('   Key fields for res.partner:');
    keyPartnerFields.forEach((field) => {
      const required = field.required ? '(required)' : '(optional)';
      console.log(`   - ${field.name}: ${field.ttype} ${required}`);
    });

    // Inspect sale.order
    console.log('\n🔍 Inspecting sale.order model...');
    const saleFields = await introspector.getFields('sale.order');
    const keySaleFields = saleFields.filter((f) =>
      ['name', 'partner_id', 'opportunity_id', 'state', 'amount_total'].includes(f.name)
    );

    console.log('   Key fields for sale.order:');
    keySaleFields.forEach((field) => {
      const required = field.required ? '(required)' : '(optional)';
      const relation = field.relation ? ` → ${field.relation}` : '';
      console.log(`   - ${field.name}: ${field.ttype}${relation} ${required}`);
    });

    const partnerIdField = keySaleFields.find((f) => f.name === 'partner_id');
    if (partnerIdField?.required) {
      console.log('\n💡 Notice: sale.order has partner_id as REQUIRED!');
      console.log('   This means we cannot create a quotation without a customer.');
    }

    // ============================================================
    // PHASE 4: Create a CRM Lead
    // ============================================================
    console.log('\n' + '='.repeat(60));
    console.log('📝 PHASE 4: Create a CRM Lead');
    console.log('='.repeat(60));

    const leadData = {
      name: 'Demo Lead - Enterprise Software License',
      email_from: 'john.smith@example.com',
      phone: '+1 555-0123',
      expected_revenue: 50000,
      description: 'Interested in annual enterprise license.\nCreated via odoo-toolbox example.',
    };

    console.log('\n📝 Creating CRM lead...');
    console.log(`   Name: ${leadData.name}`);
    console.log(`   Email: ${leadData.email_from}`);
    console.log(`   Expected Revenue: $${leadData.expected_revenue}`);

    const leadId = await client.create('crm.lead', leadData);
    createdRecords.lead = leadId;
    console.log(`✅ Lead created with ID: ${leadId}\n`);

    // Read back the lead to see how Odoo processed it
    const [lead] = await client.read<{
      name: string;
      partner_id: [number, string] | false;
      stage_id: [number, string] | false;
      create_date: string;
    }>('crm.lead', [leadId], ['name', 'partner_id', 'stage_id', 'create_date']);

    console.log('   Lead details after creation:');
    console.log(`   - Stage: ${lead.stage_id ? lead.stage_id[1] : 'None'}`);
    console.log(`   - Partner: ${lead.partner_id ? lead.partner_id[1] : 'None (not yet linked)'}`);
    console.log(`   - Created: ${lead.create_date}`);

    // ============================================================
    // PHASE 5: Schedule a Follow-up Activity
    // ============================================================
    console.log('\n' + '='.repeat(60));
    console.log('📅 PHASE 5: Schedule a Follow-up Activity');
    console.log('='.repeat(60));

    // Activities in Odoo use mail.activity model
    // They require an activity type and a model reference - let's find them first
    console.log('\n🔍 Finding available activity types...');
    const activityTypes = await client.searchRead<{
      id: number;
      name: string;
    }>('mail.activity.type', [], { fields: ['name', 'id'], limit: 5 });

    if (activityTypes.length === 0) {
      console.log('⚠️  No activity types found - skipping activity creation');
    } else {
      console.log('   Available activity types:');
      activityTypes.forEach((at) => {
        console.log(`   - ${at.name} (ID: ${at.id})`);
      });

      // Use the first activity type (usually "To Do" or "Call")
      const activityTypeId = activityTypes[0].id;

      // Find the ir.model record for crm.lead (needed for res_model_id)
      // Activities require a many2one reference to ir.model, not just the model name
      console.log('\n🔍 Looking up ir.model record for crm.lead...');
      const models = await client.searchRead<{ id: number; model: string }>(
        'ir.model',
        [['model', '=', 'crm.lead']],
        { fields: ['id', 'model'], limit: 1 }
      );

      if (models.length === 0) {
        console.log('⚠️  Could not find ir.model for crm.lead - skipping activity');
      } else {
        console.log(`   Found: ir.model ID ${models[0].id}`);

        // Calculate a deadline 7 days from now
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 7);
        const deadlineStr = deadline.toISOString().split('T')[0]; // YYYY-MM-DD format

        const activityData = {
          res_model_id: models[0].id, // many2one to ir.model (not string!)
          res_id: leadId,
          activity_type_id: activityTypeId,
          summary: 'Follow up on enterprise license inquiry',
          date_deadline: deadlineStr,
          note: 'Discuss pricing options and implementation timeline.',
        };

        console.log(`\n📝 Creating activity on lead...`);
        console.log(`   Type: ${activityTypes[0].name}`);
        console.log(`   Summary: ${activityData.summary}`);
        console.log(`   Deadline: ${deadlineStr}`);
        console.log('   💡 Note: Activities use res_model_id (many2one to ir.model)');

        const activityId = await client.create('mail.activity', activityData);
        createdRecords.activity = activityId;
        console.log(`✅ Activity scheduled with ID: ${activityId}`);
      }
    }

    // ============================================================
    // PHASE 6: Attempt to Create Quotation WITHOUT Partner (WILL FAIL)
    // ============================================================
    console.log('\n' + '='.repeat(60));
    console.log('⚠️  PHASE 6: Attempting Quotation Without Partner');
    console.log('='.repeat(60));

    console.log("\n💡 Educational moment: Let's try to create a sale.order");
    console.log('   linked to our lead, but WITHOUT a partner...\n');

    try {
      // This SHOULD fail because partner_id is required
      const badQuotationData = {
        opportunity_id: leadId,
        // partner_id is intentionally missing!
      };

      console.log('📝 Attempting to create quotation without partner_id...');
      await client.create('sale.order', badQuotationData);

      // If we get here, something unexpected happened
      console.log('❓ Unexpectedly succeeded - your Odoo may have different constraints');
    } catch (error) {
      console.log('❌ EXPECTED ERROR: Quotation creation failed!');
      if (error instanceof Error) {
        // Extract just the key part of the error
        const errorMsg = error.message.includes('partner_id')
          ? 'Missing required field: partner_id'
          : error.message.slice(0, 100);
        console.log(`   Reason: ${errorMsg}`);
      }
      console.log('\n💡 Lesson: sale.order REQUIRES a partner_id (customer).');
      console.log('   We must create a contact first, then link it to the lead.');
    }

    // ============================================================
    // PHASE 7: Create a Contact (res.partner)
    // ============================================================
    console.log('\n' + '='.repeat(60));
    console.log('👤 PHASE 7: Create a Contact');
    console.log('='.repeat(60));

    const partnerData = {
      name: 'John Smith',
      email: 'john.smith@example.com',
      phone: '+1 555-0123',
      is_company: false,
      street: '123 Business Ave',
      city: 'Tech City',
      comment: 'Created via odoo-toolbox example for CRM lead demo.',
    };

    console.log('\n📝 Creating contact...');
    console.log(`   Name: ${partnerData.name}`);
    console.log(`   Email: ${partnerData.email}`);
    console.log(`   Company: ${partnerData.is_company ? 'Yes' : 'No (Individual)'}`);

    const partnerId = await client.create('res.partner', partnerData);
    createdRecords.partner = partnerId;
    console.log(`✅ Contact created with ID: ${partnerId}`);

    // ============================================================
    // PHASE 8: Link Contact to Lead
    // ============================================================
    console.log('\n' + '='.repeat(60));
    console.log('🔗 PHASE 8: Link Contact to Lead');
    console.log('='.repeat(60));

    console.log('\n✏️  Updating lead to link partner...');
    console.log(`   Lead ID: ${leadId}`);
    console.log(`   Partner ID: ${partnerId}`);

    // For many2one fields, we write just the ID number
    await client.write('crm.lead', [leadId], { partner_id: partnerId });
    console.log('✅ Lead updated with partner link!\n');

    // Verify the update
    const [updatedLead] = await client.read<{
      partner_id: [number, string] | false;
    }>('crm.lead', [leadId], ['partner_id']);

    console.log('   Verification:');
    console.log(`   - partner_id read value: ${JSON.stringify(updatedLead.partner_id)}`);
    console.log('   💡 Note: When READING many2one, Odoo returns [id, display_name]');
    console.log('      When WRITING many2one, we just pass the numeric ID.');

    // ============================================================
    // PHASE 9: Create Quotation (Now It Should Work!)
    // ============================================================
    console.log('\n' + '='.repeat(60));
    console.log('📋 PHASE 9: Create Sales Quotation');
    console.log('='.repeat(60));

    const quotationData = {
      partner_id: partnerId, // Now we have a partner!
      opportunity_id: leadId, // Link back to the lead
      note: 'Enterprise Software License - Annual subscription',
    };

    console.log('\n📝 Creating quotation...');
    console.log(`   Customer: Partner ID ${partnerId}`);
    console.log(`   Linked to Lead: ${leadId}`);

    const saleOrderId = await client.create('sale.order', quotationData);
    createdRecords.saleOrder = saleOrderId;
    console.log(`✅ Quotation created with ID: ${saleOrderId}\n`);

    // Read the created quotation
    const [quotation] = await client.read<{
      name: string;
      state: string;
      partner_id: [number, string];
      opportunity_id: [number, string] | false;
      amount_total: number;
    }>(
      'sale.order',
      [saleOrderId],
      ['name', 'state', 'partner_id', 'opportunity_id', 'amount_total']
    );

    console.log('   Quotation details:');
    console.log(`   - Reference: ${quotation.name}`);
    console.log(`   - State: ${quotation.state}`);
    console.log(`   - Customer: ${quotation.partner_id[1]}`);
    console.log(
      `   - Opportunity: ${quotation.opportunity_id ? quotation.opportunity_id[1] : 'None'}`
    );
    console.log(`   - Amount: ${quotation.amount_total} (empty - no lines yet)`);

    // ============================================================
    // PHASE 10: Confirm the Quotation
    // ============================================================
    console.log('\n' + '='.repeat(60));
    console.log('✨ PHASE 10: Confirm the Quotation');
    console.log('='.repeat(60));

    console.log('\n📝 Confirming quotation (converting to Sales Order)...');
    console.log("   Using: client.call('sale.order', 'action_confirm', [[orderId]])");

    // To confirm a quotation, we call the action_confirm method
    // This is how you invoke Odoo action methods via RPC
    await client.call('sale.order', 'action_confirm', [[saleOrderId]]);
    console.log('✅ Quotation confirmed!\n');

    // Read the updated state
    const [confirmedOrder] = await client.read<{ name: string; state: string }>(
      'sale.order',
      [saleOrderId],
      ['name', 'state']
    );

    console.log('   Order after confirmation:');
    console.log(`   - Reference: ${confirmedOrder.name}`);
    console.log(`   - State: ${confirmedOrder.state} (should be 'sale')`);

    // ============================================================
    // SUMMARY
    // ============================================================
    console.log('\n' + '='.repeat(60));
    console.log('🎉 WORKFLOW COMPLETE!');
    console.log('='.repeat(60));
    console.log('\n📊 Summary of what we accomplished:');
    console.log('   1. ✅ Ensured CRM and Sales modules are installed');
    console.log('   2. ✅ Used introspection to understand model structures');
    console.log('   3. ✅ Created a CRM lead (crm.lead)');
    console.log('   4. ✅ Scheduled a follow-up activity (mail.activity)');
    console.log('   5. ✅ Learned that quotations require a partner');
    console.log('   6. ✅ Created a contact (res.partner)');
    console.log('   7. ✅ Linked contact to lead');
    console.log('   8. ✅ Created a quotation (sale.order)');
    console.log('   9. ✅ Confirmed quotation to sales order');
    console.log('\n💡 Key Takeaways:');
    console.log('   - Use ModuleManager to install required modules');
    console.log('   - Always use introspection to understand model requirements');
    console.log('   - many2one fields: write with ID, read returns [id, name]');
    console.log('   - Some models have strict relational requirements');
    console.log('   - Action methods (like action_confirm) use client.call()');

    // ============================================================
    // CLEANUP
    // ============================================================
    console.log('\n' + '='.repeat(60));
    console.log('🧹 CLEANUP: Removing Created Records');
    console.log('='.repeat(60));

    await cleanup(client, createdRecords);

    console.log('\n✅ All done! Thank you for exploring odoo-toolbox.\n');
    await client.logout();
  } catch (error) {
    console.error('\n❌ Unexpected error occurred:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
    }

    // Always try to clean up on error
    console.log('\n🧹 Attempting cleanup after error...');
    await cleanup(client, createdRecords);

    await client.logout();
    process.exit(1);
  }
}

/**
 * Ensure the CRM and Sales modules are installed.
 *
 * This is required for test environments that start with a blank database.
 * For production instances that already have these modules, this will
 * simply verify they're installed and continue.
 */
async function ensureModulesInstalled(client: OdooClient): Promise<void> {
  const moduleManager = new ModuleManager(client);
  const requiredModules = ['crm', 'sale'];

  console.log('Checking required modules...');
  for (const moduleName of requiredModules) {
    const isInstalled = await moduleManager.isModuleInstalled(moduleName);
    if (!isInstalled) {
      console.log(`   📥 Installing ${moduleName}... (this may take a moment)`);
      await moduleManager.installModule(moduleName);
      console.log(`   ✅ ${moduleName} installed`);
    } else {
      console.log(`   ✅ ${moduleName} already installed`);
    }
  }
}

/**
 * Clean up all created records in reverse order of creation.
 *
 * We delete in reverse order because of relational constraints:
 * - Cancel and delete sale.order first (references partner and lead)
 * - Delete activity (references lead)
 * - Delete lead (references partner)
 * - Delete partner last
 */
async function cleanup(client: OdooClient, records: CreatedRecords): Promise<void> {
  // Delete in reverse dependency order
  if (records.saleOrder) {
    try {
      console.log(`\n🗑️  Cancelling and deleting sale.order ${records.saleOrder}...`);
      // First cancel the order (confirmed orders can't be deleted directly)
      await client.call('sale.order', 'action_cancel', [[records.saleOrder]]);
      console.log('   ✅ Cancelled');
      await client.unlink('sale.order', records.saleOrder);
      console.log('   ✅ Deleted');
    } catch (e) {
      console.log(`   ⚠️  Could not delete: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  if (records.activity) {
    try {
      console.log(`🗑️  Deleting mail.activity ${records.activity}...`);
      await client.unlink('mail.activity', records.activity);
      console.log('   ✅ Deleted');
    } catch (e) {
      console.log(`   ⚠️  Could not delete: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  if (records.lead) {
    try {
      console.log(`🗑️  Deleting crm.lead ${records.lead}...`);
      await client.unlink('crm.lead', records.lead);
      console.log('   ✅ Deleted');
    } catch (e) {
      console.log(`   ⚠️  Could not delete: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  if (records.partner) {
    try {
      console.log(`🗑️  Deleting res.partner ${records.partner}...`);
      await client.unlink('res.partner', records.partner);
      console.log('   ✅ Deleted');
    } catch (e) {
      console.log(`   ⚠️  Could not delete: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }
}

main();
