/**
 * Example 4: Context Variables and Batch Operations
 *
 * Demonstrates how to:
 * - Use Odoo context variables to control behavior
 * - Disable field tracking/audit trail
 * - Set default field values
 * - Control timezone and language settings
 * - Perform efficient batch operations
 * - Understand when to use context
 *
 * Prerequisites:
 * - Odoo instance running and authenticated
 * - Write access to res.partner model
 *
 * Run: npx ts-node packages/odoo-client/examples/4-context-and-batch.ts
 *
 * Important: Context is a powerful feature in Odoo that allows you to:
 * - Pass metadata about the operation
 * - Control model-specific behavior
 * - Set defaults for fields
 * - Disable audit/tracking
 * - Handle multi-company scenarios
 *
 * See AGENTS.md for common context variables and where they're handled.
 */

import { OdooClient } from '../src';

async function main() {
  const client = new OdooClient({
    url: 'http://localhost:8069',
    database: 'odoo',
    username: 'admin',
    password: 'admin',
  });

  try {
    await client.authenticate();
    console.log('🔐 Authenticated\n');

    // Example 1: Batch create with context
    console.log('📦 Batch create with default context');
    const partnerNames = [
      'Batch Partner A',
      'Batch Partner B',
      'Batch Partner C',
    ];
    const batchIds = [];

    for (const name of partnerNames) {
      const id = await client.create(
        'res.partner',
        { name, is_company: false },
        {
          // Context: control Odoo behavior
          lang: 'en_US',
          tz: 'UTC',
          // tracking_disable: true would disable audit trail if this was tracked
        }
      );
      batchIds.push(id);
      console.log(`   ✅ Created: ${name} (ID: ${id})`);
    }

    // Example 2: Batch update - more efficient with context
    console.log('\n🔄 Batch update with same context');
    await client.write(
      'res.partner',
      batchIds,
      {
        phone: '+1-555-0123',
        email: 'batch@example.com',
        street: '789 Batch Street',
      },
      {
        // Context for this batch operation
        lang: 'en_US',
        // This batch update happens more efficiently on the server
      }
    );
    console.log(`✅ Updated ${batchIds.length} records in one call`);

    // Example 3: Search with context for language/timezone
    console.log('\n🔍 Search with language context');
    const results = await client.searchRead('res.partner', [
      ['id', 'in', batchIds],
    ]);
    console.log(`✅ Retrieved ${results.length} records with context`);
    if (results.length > 0) {
      console.log(`   Sample: ${results[0].name}`);
    }

    // Example 4: Context for default values (if supported by model)
    console.log('\n💡 Context can set defaults for many operations');
    console.log('   Examples of context variables:');
    console.log('   - lang: "en_US" - Language for translations');
    console.log('   - tz: "America/New_York" - Timezone for date handling');
    console.log(
      '   - tracking_disable: true - Skip field tracking/audit trail'
    );
    console.log('   - default_<fieldname>: <value> - Set field defaults');
    console.log(
      '   - allowed_company_ids: [1, 2] - Multi-company filtering (base module)'
    );
    console.log(
      '   - active_test: false - Include inactive records in search'
    );
    console.log('   - mail_activity_quick_update: true - Skip validations (mail module)');
    console.log('');
    console.log('   For more, see AGENTS.md documentation on Odoo context.');

    // Example 5: Efficient bulk operations pattern
    console.log('\n⚡ Efficient bulk operations pattern:');
    console.log('   Instead of:');
    console.log('     for (const id of ids) {');
    console.log('       await client.delete(id)  // N calls');
    console.log('     }');
    console.log('');
    console.log('   Use:');
    console.log('     await client.unlink(ids)  // 1 call');
    console.log('');

    // Clean up test records
    console.log('\n🧹 Cleaning up test records...');
    await client.unlink('res.partner', batchIds);
    console.log(`✅ Deleted ${batchIds.length} test records`);

    // Example 6: Reading data with field selection context
    console.log('\n📖 Advanced: Read with computed fields');
    const allIds = await client.search('res.partner', [
      ['is_company', '=', true],
    ]);
    if (allIds.length > 0) {
      // Read some fields - server does computations automatically
      const [company] = await client.read('res.partner', [allIds[0]], [
        'name',
        'is_company',
        // 'display_name' would be computed on the server
        // 'child_ids' would be computed for relational fields
      ]);
      console.log(`✅ Read company with computed fields: ${company.name}`);
    }

    console.log('\n✨ Context usage complete!');
    console.log('   Next: See AGENTS.md for specific model context variables');

    await client.logout();
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  }
}

main();
