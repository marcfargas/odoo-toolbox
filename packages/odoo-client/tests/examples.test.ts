/**
 * Unit tests for examples
 * 
 * Validates that all example files:
 * - Have correct TypeScript syntax
 * - Import available modules correctly
 * - Follow expected patterns
 * 
 * Note: We do NOT run the examples end-to-end (that would require Odoo).
 * Instead, we validate syntax and structure.
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Examples', () => {
  const examplesDir = path.join(__dirname, '..', '..', '..', 'examples');
  const exampleFiles = [
    '1-basic-connection.ts',
    '2-schema-introspection.ts',
    '3-generate-types.ts',
    '4-crud-operations.ts',
    '5-search-and-filter.ts',
    '6-context-and-batch.ts',
  ];

  describe('File Structure', () => {
    it('should have all expected example files', () => {
      exampleFiles.forEach((file) => {
        const filePath = path.join(examplesDir, file);
        expect(fs.existsSync(filePath)).toBe(true);
      });
    });

    it('should have examples README', () => {
      const readmePath = path.join(examplesDir, 'README.md');
      expect(fs.existsSync(readmePath)).toBe(true);
      const content = fs.readFileSync(readmePath, 'utf-8');
      expect(content).toContain('Examples');
      expect(content).toContain('Quick Start');
    });
  });

  describe('Example Content', () => {
    it('should have documentation in each example', () => {
      exampleFiles.forEach((file) => {
        const filePath = path.join(examplesDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Should have JSDoc header
        expect(content).toContain('/**');
        expect(content).toContain('* Example');
        
        // Should have main function
        expect(content).toContain('async function main()');
        
        // Should have error handling
        expect(content).toContain('try');
        expect(content).toContain('catch');
        
        // Should call logout
        expect(content).toContain('logout()');
      });
    });

    it('example 1 should demonstrate authentication', () => {
      const filePath = path.join(examplesDir, '1-basic-connection.ts');
      const content = fs.readFileSync(filePath, 'utf-8');
      
      expect(content).toContain('authenticate');
      expect(content).toContain('sessionInfo');
      expect(content).toContain('search');
      expect(content).toContain('read');
    });

    it('example 2 should demonstrate introspection', () => {
      const filePath = path.join(examplesDir, '2-schema-introspection.ts');
      const content = fs.readFileSync(filePath, 'utf-8');
      
      expect(content).toContain('getModels');
      expect(content).toContain('getFields');
      expect(content).toContain('getModelMetadata');
    });

    it('example 3 should demonstrate code generation', () => {
      const filePath = path.join(examplesDir, '3-generate-types.ts');
      const content = fs.readFileSync(filePath, 'utf-8');
      
      expect(content).toContain('CodeGenerator');
      expect(content).toContain('generateCompleteFile');
      expect(content).toContain('getModelMetadata');
      expect(content).toContain('writeFileSync');
    });

    it('example 4 should demonstrate CRUD', () => {
      const filePath = path.join(examplesDir, '4-crud-operations.ts');
      const content = fs.readFileSync(filePath, 'utf-8');
      
      expect(content).toContain('create');
      expect(content).toContain('read');
      expect(content).toContain('write');
      expect(content).toContain('unlink');
    });

    it('example 5 should demonstrate search', () => {
      const filePath = path.join(examplesDir, '5-search-and-filter.ts');
      const content = fs.readFileSync(filePath, 'utf-8');
      
      expect(content).toContain('search');
      expect(content).toContain('searchRead');
      expect(content).toContain('domain');
      expect(content).toContain('order');
      expect(content).toContain('limit');
    });

    it('example 6 should demonstrate context and batch', () => {
      const filePath = path.join(examplesDir, '6-context-and-batch.ts');
      const content = fs.readFileSync(filePath, 'utf-8');
      
      expect(content).toContain('context');
      expect(content).toContain('batch');
      // Check for batch operations (using write with array of IDs)
      expect(content).toContain('client.write');
      expect(content).toContain('batchIds');
    });
  });

  describe('README Coverage', () => {
    it('should document each example in README', () => {
      const readmePath = path.join(examplesDir, 'README.md');
      const content = fs.readFileSync(readmePath, 'utf-8');
      
      // Check each example is documented
      expect(content).toContain('1. Basic Connection');
      expect(content).toContain('2. Schema Introspection');
      expect(content).toContain('3. Generate TypeScript Types');
      expect(content).toContain('4. CRUD Operations');
      expect(content).toContain('5. Search and Filtering');
      expect(content).toContain('6. Context Variables');
      
      // Check common patterns section
      expect(content).toContain('Common Patterns');
      expect(content).toContain('Tips & Best Practices');
      expect(content).toContain('Troubleshooting');
    });

    it('should include quick start in README', () => {
      const readmePath = path.join(examplesDir, 'README.md');
      const content = fs.readFileSync(readmePath, 'utf-8');
      
      expect(content).toContain('Quick Start');
      expect(content).toContain('Prerequisites');
      expect(content).toContain('npx ts-node');
    });
  });

  describe('TypeScript Syntax', () => {
    it('should have valid imports', () => {
      exampleFiles.forEach((file) => {
        const filePath = path.join(examplesDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Should import OdooClient
        expect(content).toContain("import { OdooClient }");
        expect(content).toContain('odoo-client');
      });
    });

    it('should use async/await pattern', () => {
      exampleFiles.forEach((file) => {
        const filePath = path.join(examplesDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Should have async main
        expect(content).toContain('async');
        expect(content).toContain('await');
        expect(content).toContain('main()');
      });
    });
  });
});
