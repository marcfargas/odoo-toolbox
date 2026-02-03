"use strict";
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
const vitest_1 = require("vitest");
const path = __importStar(require("path"));
const markdown_example_extractor_1 = require("../../../tests/helpers/markdown-example-extractor");
const markdown_example_runner_1 = require("../../../tests/helpers/markdown-example-runner");
(0, vitest_1.describe)('Markdown Documentation Examples', () => {
    let ctx;
    let allBlocks = [];
    const docsDir = path.resolve(__dirname, '..', 'assets', 'initial', 'base');
    (0, vitest_1.beforeAll)(async () => {
        // Extract blocks from documentation
        allBlocks = await (0, markdown_example_extractor_1.extractFromDirectory)(docsDir);
        console.log(`\nFound ${allBlocks.length} testable code blocks in documentation`);
        if (allBlocks.length > 0) {
            // Collect all unique dependencies
            const allNeeds = new Set();
            allBlocks.forEach((b) => b.needs.forEach((n) => allNeeds.add(n)));
            // Always include client
            allNeeds.add('client');
            // Create context with all possible dependencies
            ctx = await (0, markdown_example_runner_1.createTestContext)(Array.from(allNeeds));
        }
    }, 60000);
    (0, vitest_1.afterAll)(async () => {
        if (ctx) {
            await (0, markdown_example_runner_1.cleanupTestContext)(ctx);
        }
    });
    (0, vitest_1.it)('extracts and executes all testable code blocks from markdown', async () => {
        // Skip if no blocks found (no annotations yet)
        if (allBlocks.length === 0) {
            console.log('No testable blocks found - skipping');
            return;
        }
        const results = [];
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
            const deps = await (0, markdown_example_runner_1.checkDependencies)(block, ctx);
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
            const result = await (0, markdown_example_runner_1.executeCodeBlock)(block, ctx);
            if (!result.success) {
                results.push({
                    id: block.id,
                    sourceFile: block.sourceFile,
                    success: false,
                    error: result.error?.message,
                });
                // Cleanup after failure too
                await (0, markdown_example_runner_1.clearCreatedRecords)(ctx);
                continue;
            }
            // Evaluate expect if present
            if (block.expect) {
                const expectPassed = (0, markdown_example_runner_1.evaluateExpect)(block.expect, result.result, ctx);
                if (!expectPassed) {
                    results.push({
                        id: block.id,
                        sourceFile: block.sourceFile,
                        success: false,
                        error: `Expect failed: ${block.expect}`,
                    });
                    await (0, markdown_example_runner_1.clearCreatedRecords)(ctx);
                    continue;
                }
            }
            results.push({
                id: block.id,
                sourceFile: block.sourceFile,
                success: true,
            });
            // Cleanup after each block
            await (0, markdown_example_runner_1.clearCreatedRecords)(ctx);
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
        (0, vitest_1.expect)(failed.length).toBe(0);
    }, 120000); // 2 minute timeout for all blocks
});
//# sourceMappingURL=markdown-examples.integration.test.js.map