"use strict";
/**
 * Example 1: Schema Introspection
 *
 * Demonstrates how to:
 * - List all available Odoo models
 * - Inspect field metadata for a specific model
 * - Understand field types and properties (required, readonly, relational)
 * - Filter models by module
 * - Work with the schema dynamically
 *
 * Prerequisites:
 * - Odoo instance running and authenticated
 *
 * Run: npx ts-node packages/odoo-introspection/examples/1-schema-introspection.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@odoo-toolbox/client");
const src_1 = require("../src");
async function main() {
    const client = new client_1.OdooClient({
        url: 'http://localhost:8069',
        database: 'odoo',
        username: 'admin',
        password: 'admin',
    });
    try {
        await client.authenticate();
        console.log('🔐 Authenticated\n');
        // Create introspector
        const introspector = new src_1.Introspector(client);
        // List all models
        console.log('📦 Listing all models...');
        const models = await introspector.getModels();
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
        const partnerFields = await introspector.getFields('res.partner');
        console.log(`✅ Found ${partnerFields.length} fields\n`);
        // Show field details
        console.log('Sample fields:');
        partnerFields.slice(0, 5).forEach((field) => {
            console.log(`   ${field.name} (${field.field_description})`);
            console.log(`      Type: ${field.ttype}`);
            console.log(`      Required: ${field.required}, Readonly: ${field.readonly}`);
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
        const metadata = await introspector.getModelMetadata('res.partner');
        console.log(`✅ Got metadata for ${metadata.model.name}`);
        console.log(`   Fields: ${metadata.fields.length}`);
        console.log(`   This metadata can be used to generate TypeScript interfaces`);
        await client.logout();
    }
    catch (error) {
        if (error instanceof Error) {
            console.error('❌ Error:', error.message);
        }
        process.exit(1);
    }
}
main();
//# sourceMappingURL=1-schema-introspection.js.map