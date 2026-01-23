/**
 * Example 3: Generate TypeScript Types
 *
 * Demonstrates how to:
 * - Use the code generator to create TypeScript interfaces from Odoo schema
 * - Generate type definitions for specific models
 * - Export generated interfaces for use in other code
 * - Control output directory and module filters
 *
 * Prerequisites:
 * - Odoo instance running and authenticated
 * - An output directory for generated files
 *
 * Run: npx ts-node examples/3-generate-types.ts
 *
 * This generates a file like:
 *   examples/generated/models.ts
 *
 * Which can then be imported:
 *   import { ResPartner, SaleOrder } from './generated/models'
 */

import { OdooClient } from '../packages/odoo-client/src';
import { generateCompleteFile } from '../packages/odoo-introspection/src/codegen';
import { Introspector } from '../packages/odoo-introspection/src/introspection';
import * as fs from 'fs';
import * as path from 'path';

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

    // Create introspector
    const introspector = new Introspector(client);

    // Models to generate (just a few for this example)
    const modelsToGenerate = ['res.partner', 'sale.order', 'sale.order.line'];

    console.log(`📝 Generating TypeScript interfaces for ${modelsToGenerate.length} models...`);

    // Get metadata for each model
    const metadataList = [];
    for (const modelName of modelsToGenerate) {
      try {
        const metadata = await introspector.getModelMetadata(modelName);
        metadataList.push(metadata);
        console.log(`   ✅ ${modelName}`);
      } catch (error) {
        console.log(`   ⚠️  ${modelName} (skipped - not found or no access)`);
      }
    }

    if (metadataList.length === 0) {
      console.error('❌ No models were successfully retrieved');
      process.exit(1);
    }

    // Generate TypeScript code
    console.log('\n🔧 Generating code...');
    const generatedCode = generateCompleteFile(metadataList);

    // Ensure output directory exists
    const outputDir = path.join(__dirname, 'generated');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write to file
    const outputPath = path.join(outputDir, 'models.ts');
    fs.writeFileSync(outputPath, generatedCode);

    console.log(`✅ Generated ${outputPath}`);
    console.log(`\nGenerated file preview (first 30 lines):`);
    const lines = generatedCode.split('\n').slice(0, 30);
    lines.forEach((line) => console.log(line));
    console.log('... (see generated/models.ts for full output)\n');

    // Show how to use the generated types
    console.log('💡 Usage in your code:');
    console.log('   import { ResPartner, SaleOrder } from "./generated/models"');
    console.log('');
    console.log('   const partner: ResPartner = {');
    console.log('     name: "Acme Corp",');
    console.log('     email: "contact@acme.com",');
    console.log('     is_company: true,');
    console.log('   };');
    console.log('');
    console.log('   // Now you get autocomplete and type checking! ✨');

    await client.logout();
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  }
}

main();
