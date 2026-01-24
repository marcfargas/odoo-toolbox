/**
 * Code generation module.
 * 
 * Exports:
 * - CodeGenerator - Main orchestrator for code generation
 * - generateCode - Convenience function
 * - Type mappers - Field type mapping utilities
 * - Formatter - Code formatting and output generation
 */

export { CodeGenerator, generateCode } from './generator.js';
export type { CodeGeneratorOptions } from './generator.js';

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
