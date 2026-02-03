/**
 * Code generation module.
 *
 * Exports:
 * - CodeGenerator - Main orchestrator for code generation
 * - generateCode - Convenience function
 * - Type mappers - Field type mapping utilities
 * - Formatter - Code formatting and output generation
 */

export { CodeGenerator, generateCode } from './generator';
export type { CodeGeneratorOptions } from './generator';

export {
  mapFieldType,
  getFieldTypeExpression,
  isWritableField,
  generateFieldJSDoc,
} from './type-mappers';
export type { TypeScriptTypeExpression } from './type-mappers';

export {
  modelNameToInterfaceName,
  generateModelInterface,
  generateCompleteFile,
  generateHelperTypes,
} from './formatter';
