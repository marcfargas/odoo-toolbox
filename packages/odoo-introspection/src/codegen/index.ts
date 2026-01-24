/**
 * Code generation module.
 * 
 * Exports:
 * - CodeGenerator - Main orchestrator for code generation
 * - generateCode - Convenience function
 * - Type mappers - Field type mapping utilities
 * - Formatter - Code formatting and output generation
 * - File system adapters - For Node.js, browser, and in-memory storage
 */

export { CodeGenerator, generateCode } from './generator.js';
export type { CodeGeneratorOptions, FileSystemAdapter, Logger } from './generator.js';

export {
  createNodeFsAdapter,
  createBrowserFsAdapter,
  createMemoryFsAdapter,
} from './fs-adapters.js';

export {
  mapFieldType,
  getFieldTypeExpression,
  isWritableField,
  generateFieldJSDoc,
} from './type-mappers.js';
export type { TypeScriptTypeExpression } from './type-mappers.js';

export {
  modelNameToInterfaceName,
  generateModelInterface,
  generateCompleteFile,
  generateHelperTypes,
} from './formatter.js';
