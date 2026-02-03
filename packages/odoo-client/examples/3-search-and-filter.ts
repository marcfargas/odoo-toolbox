/**
 * Example 3: Search and Filtering
 *
 * Demonstrates how to:
 * - Search with Odoo domain filters
 * - Use comparison operators (=, !=, >, <, in, etc.)
 * - Combine conditions with AND/OR logic
 * - Paginate results (limit, offset)
 * - Order by fields
 * - Use searchRead for combined search + read in one call
 * - Filter by model fields and relationships
 *
 * Prerequisites:
 * - Odoo instance running and authenticated
 * - Some sample data in res.partner
 *
 * Run: npx ts-node packages/odoo-client/examples/3-search-and-filter.ts
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

    // Simple search - all records
    console.log('🔍 Simple search: All partners');
    const allIds = await client.search('res.partner', []);
    console.log(`✅ Found ${allIds.length} partners`);

    // Search with exact match
    console.log('\n🔍 Search: Companies only');
    const companyIds = await client.search('res.partner', [['is_company', '=', true]]);
    console.log(`✅ Found ${companyIds.length} companies`);

    // Search with comparison operators
    console.log('\n🔍 Search: Partners created after 2024-01-01');
    const recentIds = await client.search('res.partner', [['create_date', '>=', '2024-01-01']]);
    console.log(`✅ Found ${recentIds.length} recent partners`);

    // Search with IN operator (list membership)
    console.log('\n🔍 Search: Partners in specific list');
    const targetIds = allIds.slice(0, Math.min(3, allIds.length));
    if (targetIds.length > 0) {
      const matchingIds = await client.search('res.partner', [['id', 'in', targetIds]]);
      console.log(`✅ Found ${matchingIds.length} matching partners`);
    }

    // Search with OR logic (multiple conditions)
    console.log('\n🔍 Search: Companies OR partners with emails');
    const orIds = await client.search('res.partner', [
      '|', // OR operator
      ['is_company', '=', true],
      ['email', '!=', false], // has email
    ]);
    console.log(`✅ Found ${orIds.length} results`);

    // Search with AND + OR combined
    console.log('\n🔍 Search: (Companies OR has email) AND active');
    const complexIds = await client.search('res.partner', [
      '&', // AND operator
      '|',
      ['is_company', '=', true],
      ['email', '!=', false],
      ['active', '=', true],
    ]);
    console.log(`✅ Found ${complexIds.length} results`);

    // Search with ordering
    console.log('\n🔍 Search: Companies ordered by name');
    const orderedIds = await client.search('res.partner', [['is_company', '=', true]], {
      order: 'name ASC',
      limit: 5,
    });
    console.log(`✅ Found ${orderedIds.length} companies (first 5, ordered by name)`);

    // SearchRead - combined search + read in one call (more efficient!)
    console.log('\n🔍 SearchRead: Companies with their details (combined operation)');
    const results = await client.searchRead('res.partner', [
      ['is_company', '=', true],
      ['active', '=', true],
    ]);
    console.log(`✅ Found ${results.length} active companies (search + read in 1 call)`);
    if (results.length > 0) {
      console.log('\nFirst company details:');
      const first = results[0];
      console.log(`   ID: ${first.id}`);
      console.log(`   Name: ${first.name}`);
      if (first.email) console.log(`   Email: ${first.email}`);
      if (first.phone) console.log(`   Phone: ${first.phone}`);
      if (first.website) console.log(`   Website: ${first.website}`);
    }

    // Pagination example
    console.log('\n🔍 Pagination: Getting partners in batches');
    const pageSize = 5;
    let offset = 0;
    let batchNum = 1;
    while (offset < Math.min(20, allIds.length)) {
      const paginated = await client.search('res.partner', [], {
        limit: pageSize,
        offset: offset,
        order: 'name ASC',
      });
      console.log(`   Batch ${batchNum}: ${paginated.length} records (offset: ${offset})`);
      if (paginated.length === 0) break;
      offset += pageSize;
      batchNum++;
    }

    // Advanced: Filter by related model (many2one)
    console.log('\n🔍 Advanced: Partners from a specific country');
    // First find a country (USA = 1)
    const usaPartners = await client.search('res.partner', [
      ['country_id', '=', 1], // country_id is a many2one relationship
    ]);
    console.log(`✅ Found ${usaPartners.length} partners in USA (country_id = 1)`);

    await client.logout();
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  }
}

main();
