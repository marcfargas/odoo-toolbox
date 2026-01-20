/**
 * Main code generation orchestration.
 * 
 * Coordinates:
 * 1. Introspection (querying Odoo metadata)
 * 2. Type mapping (Odoo types → TypeScript)
 * 3. Code formatting (generating TypeScript code)
 * 4. File output (writing generated.ts)
 */

import { OdooClient } from '../client/odoo-client';
import { ModelMetadata } from '../introspection/types';
import { generateCompleteFile, generateHelperTypes } from './formatter';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Options for code generation.
 */
export interface CodeGeneratorOptions {
  /** Output directory for generated.ts file */
  outputDir?: string;
  
  /** Whether to include transient models (wizards) */
  includeTransient?: boolean;
  
  /** Module names to include (e.g., ['sale', 'project']) */
  modules?: string[];
  
  /** Whether to bypass introspection cache */
  bypassCache?: boolean;
}

/**
 * Main code generator orchestrating introspection and type generation.
 */
export class CodeGenerator {
  private client: OdooClient;

  constructor(client: OdooClient) {
    this.client = client;
  }

  /**
   * Generate TypeScript interfaces from Odoo model metadata.
   * 
   * Steps:
   * 1. Query all models via introspection
   * 2. Query fields for each model
   * 3. Map Odoo types to TypeScript
   * 4. Format generated code
   * 5. Write to file (if outputDir provided)
   * 
   * @param options - Generation options
   * @returns Generated TypeScript code
   */
  async generate(options: CodeGeneratorOptions = {}): Promise<string> {
    const {
      outputDir = path.join(process.cwd(), 'src', 'models'),
      includeTransient = false,
      modules = undefined,
      bypassCache = false
    } = options;

    console.log('[codegen] Starting code generation...');

    // Step 1: Get all models
    console.log('[codegen] Querying Odoo models...');
    const models = await this.client.getModels({
      includeTransient,
      modules,
      bypassCache
    });

    console.log(`[codegen] Found ${models.length} models`);

    // Step 2: Get metadata for each model
    console.log('[codegen] Querying model fields...');
    const allMetadata: ModelMetadata[] = [];

    for (const model of models) {
      try {
        const metadata = await this.client.getModelMetadata(
          model.model,
          { bypassCache }
        );
        allMetadata.push(metadata);
      } catch (error) {
        console.warn(`[codegen] Warning: Failed to introspect ${model.model}`, error);
      }
    }

    console.log(`[codegen] Successfully introspected ${allMetadata.length} models`);

    // Step 3: Generate code
    console.log('[codegen] Generating TypeScript interfaces...');
    const generatedCode = generateCompleteFile(allMetadata);
    const helperTypes = generateHelperTypes();
    const fullCode = `${helperTypes}\n\n${generatedCode}`;

    // Step 4: Write to file
    if (outputDir) {
      await this.writeGeneratedFile(fullCode, outputDir);
      console.log(`[codegen] Generated file: ${path.join(outputDir, 'generated.ts')}`);
    }

    return fullCode;
  }

  /**
   * Write generated code to file.
   * 
   * Creates output directory if it doesn't exist.
   * 
   * @param code - Generated TypeScript code
   * @param outputDir - Output directory
   */
  private async writeGeneratedFile(code: string, outputDir: string): Promise<void> {
    // Create directory if it doesn't exist
    await fs.mkdir(outputDir, { recursive: true });

    // Write file
    const filePath = path.join(outputDir, 'generated.ts');
    await fs.writeFile(filePath, code, 'utf-8');
  }
}

/**
 * Generate code from OdooClient in a single function call.
 * 
 * Convenience function for CLI and simple usage.
 * 
 * @param client - Connected OdooClient instance
 * @param options - Generation options
 * @returns Generated TypeScript code
 */
export async function generateCode(
  client: OdooClient,
  options: CodeGeneratorOptions = {}
): Promise<string> {
  const generator = new CodeGenerator(client);
  return generator.generate(options);
}
