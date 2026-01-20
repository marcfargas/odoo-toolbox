/**
 * Example 1: Basic Connection and Authentication
 *
 * Demonstrates how to:
 * - Create an OdooClient instance
 * - Authenticate with Odoo
 * - Handle authentication errors
 * - Verify connection status
 *
 * Prerequisites:
 * - Odoo instance running at http://localhost:8069
 * - Valid credentials: admin / admin
 *
 * Run: npx ts-node examples/1-basic-connection.ts
 */

import { OdooClient } from '../packages/odoo-client/src';

async function main() {
  // Create client with connection config
  const client = new OdooClient({
    url: 'http://localhost:8069',
    database: 'odoo',
    username: 'admin',
    password: 'admin',
  });

  try {
    // Authenticate - required before making RPC calls
    console.log('🔐 Authenticating...');
    const sessionInfo = await client.authenticate();
    console.log('✅ Authentication successful');
    console.log(`   User ID: ${sessionInfo.uid}`);
    console.log(`   Username: ${sessionInfo.username}`);
    console.log(`   Company: ${sessionInfo.company_name}`);

    // Optional: Verify connection by making a simple call
    console.log('\n🔍 Verifying connection...');
    const [partnerId] = await client.search('res.partner', [
      ['id', '=', sessionInfo.partner_id],
    ]);
    const [partner] = await client.read('res.partner', [partnerId], [
      'id',
      'name',
      'email',
    ]);
    console.log('✅ Connection verified');
    console.log(`   Partner: ${partner.name} (${partner.email})`);

    // Logout (optional but good practice)
    console.log('\n👋 Logging out...');
    await client.logout();
    console.log('✅ Logged out');
  } catch (error) {
    // Handle errors gracefully
    if (error instanceof Error) {
      console.error('❌ Error:', error.message);

      // Common error patterns:
      if (error.message.includes('connect')) {
        console.error(
          '   → Is Odoo running at http://localhost:8069? Try: docker-compose up'
        );
      } else if (error.message.includes('authentication')) {
        console.error(
          '   → Invalid credentials. Check username/password combination.'
        );
      } else if (error.message.includes('database')) {
        console.error('   → Invalid database name. Check ODOO_DB_NAME.');
      }
    }
    process.exit(1);
  }
}

main();
