/**
 * Example 2: CRUD Operations
 *
 * Demonstrates how to:
 * - Create records (POST/create)
 * - Read records (GET/read)
 * - Update records (PUT/write)
 * - Delete records (DELETE/unlink)
 * - Handle responses and errors
 * - Use context for special behavior
 *
 * Prerequisites:
 * - Odoo instance running and authenticated
 * - Write access to res.partner model
 *
 * Run: npx ts-node packages/odoo-client/examples/2-crud-operations.ts
 *
 * Note: This example creates and deletes test records. It's safe to run
 * but does modify your Odoo database.
 */

import { OdooClient } from '../src';

/**
 * Verify that records have been deleted from Odoo
 * Uses search() instead of read() to bypass Odoo's read cache
 */
async function verifyDeleted(client: OdooClient, model: string, ids: number[]): Promise<boolean> {
  // Wait for Odoo cache to clear
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Search for the IDs - should return empty if deleted
  const foundIds = await client.search(model, [['id', 'in', ids]]);
  return foundIds.length === 0;
}

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

    // CREATE - Add a new record
    console.log('📝 CREATE: Adding a new partner...');
    const createResult = await client.create('res.partner', {
      name: 'Example Corp',
      email: 'contact@example.com',
      phone: '+1-555-0100',
      is_company: true,
      street: '123 Main St',
      city: 'Springfield',
      country_id: 1, // USA
    });
    console.log(`✅ Created record with ID: ${createResult}`);

    const partnerId = createResult;

    // READ - Get the record back
    console.log('\n📖 READ: Fetching the record...');
    const [partner] = await client.read(
      'res.partner',
      [partnerId],
      ['id', 'name', 'email', 'phone', 'city', 'is_company']
    );
    console.log('✅ Record retrieved:');
    console.log(`   Name: ${partner.name}`);
    console.log(`   Email: ${partner.email}`);
    console.log(`   Phone: ${partner.phone}`);
    console.log(`   City: ${partner.city}`);

    // UPDATE - Modify the record
    console.log('\n✏️  UPDATE: Modifying the record...');
    const updateResult = await client.write('res.partner', [partnerId], {
      email: 'newemail@example.com',
      phone: '+1-555-0200',
      street: '456 Oak Ave',
      city: 'Shelbyville',
    });
    console.log(`✅ Updated record (success: ${updateResult})`);

    // READ again to verify updates
    console.log('\n📖 READ (updated): Fetching again to verify changes...');
    const [updatedPartner] = await client.read(
      'res.partner',
      [partnerId],
      ['email', 'phone', 'street', 'city']
    );
    console.log('✅ Record after update:');
    console.log(`   Email: ${updatedPartner.email}`);
    console.log(`   Phone: ${updatedPartner.phone}`);
    console.log(`   Street: ${updatedPartner.street}`);
    console.log(`   City: ${updatedPartner.city}`);

    // DELETE - Remove the record
    console.log('\n🗑️  DELETE: Removing the record...');
    const deleteResult = await client.unlink('res.partner', [partnerId]);
    console.log(`✅ Deleted record (success: ${deleteResult})`);

    // Verify deletion
    console.log('\n📖 Verifying deletion...');
    const isDeleted = await verifyDeleted(client, 'res.partner', [partnerId]);
    if (isDeleted) {
      console.log('✅ Record is gone');
    } else {
      console.log('⚠️  Record still exists (unexpected)');
    }

    // Batch operations example
    console.log('\n🔄 BATCH: Creating multiple records at once...');
    const batchIds = await Promise.all(
      [
        { name: 'Batch Partner 1', email: 'batch1@example.com' },
        { name: 'Batch Partner 2', email: 'batch2@example.com' },
        { name: 'Batch Partner 3', email: 'batch3@example.com' },
      ].map((data) => client.create('res.partner', data))
    );
    console.log(`✅ Created ${batchIds.length} records: [${batchIds.join(', ')}]`);

    // Batch delete
    console.log('\n🔄 BATCH DELETE: Cleaning up...');
    const batchDeleteResult = await client.unlink('res.partner', batchIds);
    console.log(`✅ Deleted ${batchIds.length} records (success: ${batchDeleteResult})`);

    // Verify batch deletion
    console.log('\n📖 Verifying batch deletion...');
    const areBatchDeleted = await verifyDeleted(client, 'res.partner', batchIds);
    if (areBatchDeleted) {
      console.log('✅ All batch records are gone');
    } else {
      console.log('⚠️  Some records still exist (unexpected)');
    }

    await client.logout();
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  }
}

main();
