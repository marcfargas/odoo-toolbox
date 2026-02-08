/**
 * Markdown Documentation Examples Integration Tests
 *
 * This file automatically extracts and tests code examples from
 * the meta-skills documentation markdown files.
 *
 * Code blocks marked with `testable` in their fence metadata are
 * extracted and executed against a real Odoo instance.
 *
 * Example annotation:
 * ```typescript testable id="basic-connection" needs="client" expect="session !== null"
 * const session = client.getSession();
 * ```
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import {
  extractFromDirectory,
  type TestableCodeBlock,
} from '../../../tests/helpers/markdown-example-extractor';
import {
  createTestContext,
  cleanupTestContext,
  clearCreatedRecords,
  executeCodeBlock,
  evaluateExpect,
  checkDependencies,
  type TestContext,
} from '../../../tests/helpers/markdown-example-runner';

describe('Markdown Documentation Examples', () => {
  let ctx: TestContext;
  let allBlocks: TestableCodeBlock[] = [];
  const docsDir = path.resolve(__dirname, '..', '..', '..', 'skills', 'odoo', 'base');

  beforeAll(async () => {
    // Extract blocks from documentation
    allBlocks = await extractFromDirectory(docsDir);
    console.log(`\nFound ${allBlocks.length} testable code blocks in documentation`);

    if (allBlocks.length > 0) {
      // Collect all unique dependencies
      const allNeeds = new Set<string>();
      allBlocks.forEach((b) => b.needs.forEach((n) => allNeeds.add(n)));

      // Always include client
      allNeeds.add('client');

      // Create context with all possible dependencies
      ctx = await createTestContext(Array.from(allNeeds));
    }
  }, 60000);

  afterAll(async () => {
    if (ctx) {
      await cleanupTestContext(ctx);
    }
  });

  it('extracts and executes all testable code blocks from markdown', async () => {
    // Skip if no blocks found (no annotations yet)
    if (allBlocks.length === 0) {
      console.log('No testable blocks found - skipping');
      return;
    }

    const results: Array<{
      id: string;
      sourceFile: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const block of allBlocks) {
      // Check if block should be skipped
      if (block.skip) {
        results.push({
          id: block.id,
          sourceFile: block.sourceFile,
          success: true, // Skipped counts as success
          error: `Skipped: ${block.skip}`,
        });
        continue;
      }

      // Check dependencies
      const deps = await checkDependencies(block, ctx);
      if (!deps.available) {
        results.push({
          id: block.id,
          sourceFile: block.sourceFile,
          success: true, // Missing deps counts as skip
          error: `Skipped: ${deps.reason}`,
        });
        continue;
      }

      // Execute the code block
      const result = await executeCodeBlock(block, ctx);

      if (!result.success) {
        results.push({
          id: block.id,
          sourceFile: block.sourceFile,
          success: false,
          error: result.error?.message,
        });
        // Cleanup after failure too
        await clearCreatedRecords(ctx);
        continue;
      }

      // Evaluate expect if present
      if (block.expect) {
        const expectPassed = evaluateExpect(block.expect, result.result, ctx);
        if (!expectPassed) {
          results.push({
            id: block.id,
            sourceFile: block.sourceFile,
            success: false,
            error: `Expect failed: ${block.expect}`,
          });
          await clearCreatedRecords(ctx);
          continue;
        }
      }

      results.push({
        id: block.id,
        sourceFile: block.sourceFile,
        success: true,
      });

      // Cleanup after each block
      await clearCreatedRecords(ctx);
    }

    // Report results
    const failed = results.filter((r) => !r.success);
    const skipped = results.filter((r) => r.success && r.error?.startsWith('Skipped'));
    const passed = results.filter((r) => r.success && !r.error);

    console.log(`\nMarkdown Examples Results:`);
    console.log(`  Passed: ${passed.length}`);
    console.log(`  Skipped: ${skipped.length}`);
    console.log(`  Failed: ${failed.length}`);

    if (failed.length > 0) {
      console.log(`\nFailed examples:`);
      for (const f of failed) {
        console.log(`  - ${f.id} (${f.sourceFile}): ${f.error}`);
      }
    }

    // Fail the test if any examples failed
    expect(failed.length).toBe(0);
  }, 120000); // 2 minute timeout for all blocks
});
