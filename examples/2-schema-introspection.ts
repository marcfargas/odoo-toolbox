/**
 * Example 2: Schema Introspection
 *
 * Demonstrates how to:
 * - List all available Odoo models
 * - Inspect field metadata for a specific model
 * - Understand field types and properties (required, readonly, relational)
 * - Filter models by module
 * - Work with the schema dynamically
 *
 * Prerequisites:
 * - Odoo instance running and authenticated (see example 1)
 *
 * Run: npx ts-node examples/2-schema-introspection.ts
 */

import { OdooClient } from '../packages/odoo-client/src';

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

    // List all models
    console.log('📦 Listing all models...');
    const models = await client.getModels();
    console.log(`✅ Found ${models.length} models\n`);
    console.log('First 10 models:');
    models.slice(0, 10).forEach((model) => {
      console.log(`   - ${model.model}: ${model.name}`);
    });

    // List models from a specific module
    console.log('\n📦 Models from "sale" module:');
    const saleModels = models.filter((m) => m.model.startsWith('sale.'));
    saleModels.forEach((model) => {
      console.log(`   - ${model.model}: ${model.name}`);
    });

    // Inspect fields for a specific model
    console.log('\n🔍 Inspecting "res.partner" model:');
    const partnerFields = await client.getFields('res.partner');
    console.log(`✅ Found ${partnerFields.length} fields\n`);

    // Show field details
    console.log('Sample fields:');
    partnerFields.slice(0, 5).forEach((field) => {
      console.log(`   ${field.name} (${field.field_description})`);
      console.log(`      Type: ${field.ttype}`);
      console.log(
        `      Required: ${field.required}, Readonly: ${field.readonly}`
      );
      if (field.relation) {
        console.log(`      Relates to: ${field.relation}`);
      }
      if (field.help) {
        console.log(`      Help: ${field.help}`);
      }
      console.log();
    });

    // Get combined metadata (model + fields) for code generation
    console.log('💾 Getting metadata for code generation:');
    const metadata = await client.getModelMetadata('res.partner');
    console.log(`✅ Got metadata for ${metadata.model.name}`);
    console.log(`   Fields: ${metadata.fields.length}`);
    console.log(`   This metadata can be used to generate TypeScript interfaces`);

    await client.logout();
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  }
}

main();
