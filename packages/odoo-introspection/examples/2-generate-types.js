"use strict";
/**
 * Example 2: Generate TypeScript Types
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
 * Run: npx ts-node packages/odoo-introspection/examples/2-generate-types.ts
 *
 * This generates a file like:
 *   packages/odoo-introspection/examples/generated/models.ts
 *
 * Which can then be imported:
 *   import { ResPartner, SaleOrder } from './generated/models'
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@odoo-toolbox/client");
const codegen_1 = require("../src/codegen");
const introspection_1 = require("../src/introspection");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
        const introspector = new introspection_1.Introspector(client);
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
            }
            catch (error) {
                console.log(`   ⚠️  ${modelName} (skipped - not found or no access)`);
            }
        }
        if (metadataList.length === 0) {
            console.error('❌ No models were successfully retrieved');
            process.exit(1);
        }
        // Generate TypeScript code
        console.log('\n🔧 Generating code...');
        const generatedCode = (0, codegen_1.generateCompleteFile)(metadataList);
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
    }
    catch (error) {
        if (error instanceof Error) {
            console.error('❌ Error:', error.message);
        }
        process.exit(1);
    }
}
main();
//# sourceMappingURL=2-generate-types.js.map