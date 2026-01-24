/**
 * Main code generation orchestration.
 * 
 * Coordinates:
 * 1. Introspection (querying Odoo metadata)
 * 2. Type mapping (Odoo types → TypeScript)
 * 3. Code formatting (generating TypeScript code)
 * 4. Optional file output (if file system adapter provided)
 */

import { OdooClient } from '@odoo-toolbox/client';
import { Introspector } from '../introspection/index.js';
import type { ModelMetadata } from '../introspection/types.js';
import { generateCompleteFile, generateHelperTypes } from './formatter.js';

/**
 * File system adapter interface for writing generated files.
 * Can be implemented using Node.js fs or browser APIs.
 */
export interface FileSystemAdapter {
  writeFile(path: string, content: string): Promise<void>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
}

/**
 * Logger interface for progress reporting.
 * Can be implemented using console or custom loggers.
 */
export interface Logger {
  log(message: string): void;
}

/**
 * Default logger that does nothing (for browser compatibility).
 */
const noopLogger: Logger = {
  log: () => {}
};

/**
 * Options for code generation.
 */
export interface CodeGeneratorOptions {
  /** Output path for generated.ts file (requires fs adapter) */
  outputPath?: string;
  
  /** File system adapter for writing files (optional, Node.js only) */
  fs?: FileSystemAdapter;
  
  /** Logger for progress messages (optional) */
  logger?: Logger;
  
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
  private introspector: Introspector;

  constructor(client: OdooClient) {
    this.introspector = new Introspector(client);
  }

  /**
   * Generate TypeScript interfaces from Odoo model metadata.
   * 
   * Steps:
   * 1. Query all models via introspection
   * 2. Query fields for each model
   * 3. Map Odoo types to TypeScript
   * 4. Format generated code
   * 5. Write to file (if outputPath and fs provided)
   * 
   * @param options - Generation options
   * @returns Generated TypeScript code
   */
  async generate(options: CodeGeneratorOptions = {}): Promise<string> {
    const {
      outputPath,
      fs,
      logger = noopLogger,
      includeTransient = false,
      modules = undefined,
      bypassCache = false
    } = options;

    logger.log('[odoo-introspection:codegen] Starting code generation...');

    // Step 1: Get all models
    logger.log('[odoo-introspection:codegen] Querying Odoo models...');
    const models = await this.introspector.getModels({
      includeTransient,
      modules,
      bypassCache
    });

    logger.log(`[odoo-introspection:codegen] Found ${models.length} models`);

    // Step 2: Get metadata for each model
    logger.log('[odoo-introspection:codegen] Querying model fields...');
    const allMetadata: ModelMetadata[] = [];

    for (const model of models) {
      try {
        const metadata = await this.introspector.getModelMetadata(
          model.model,
          { bypassCache }
        );
        allMetadata.push(metadata);
      } catch (error) {
        logger.log(`[odoo-introspection:codegen] Warning: Failed to introspect ${model.model}`);
      }
    }

    logger.log(`[odoo-introspection:codegen] Successfully introspected ${allMetadata.length} models`);

    // Step 3: Generate code
    logger.log('[odoo-introspection:codegen] Generating TypeScript interfaces...');
    const generatedCode = generateCompleteFile(allMetadata);
    const helperTypes = generateHelperTypes();
    const fullCode = `${helperTypes}\n\n${generatedCode}`;

    // Step 4: Write to file (if fs adapter and outputPath provided)
    if (outputPath && fs) {
      await this.writeGeneratedFile(fullCode, outputPath, fs);
      logger.log(`[odoo-introspection:codegen] Generated file: ${outputPath}`);
    }

    return fullCode;
  }

  /**
   * Write generated code to file using the provided file system adapter.
   * 
   * Creates parent directories if they don't exist.
   * 
   * @param code - Generated TypeScript code
   * @param outputPath - Full output file path
   * @param fs - File system adapter
   */
  private async writeGeneratedFile(
    code: string,
    outputPath: string,
    fs: FileSystemAdapter
  ): Promise<void> {
    // Extract directory from path
    const lastSlash = Math.max(outputPath.lastIndexOf('/'), outputPath.lastIndexOf('\\'));
    if (lastSlash > 0) {
      const dir = outputPath.substring(0, lastSlash);
      // Create directory if it doesn't exist
      await fs.mkdir(dir, { recursive: true });
    }

    // Write file
    await fs.writeFile(outputPath, code);
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
