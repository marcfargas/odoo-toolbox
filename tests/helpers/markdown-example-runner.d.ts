/**
 * Markdown Example Runner
 *
 * Executes extracted code blocks against a real Odoo instance,
 * handling setup, teardown, and dependency injection.
 */
import { OdooClient, ModuleManager } from '@odoo-toolbox/client';
import { Introspector } from '@odoo-toolbox/introspection';
import type { TestableCodeBlock } from './markdown-example-extractor';
export interface TestContext {
    /** Authenticated Odoo client */
    client: OdooClient;
    /** Introspector instance (if needed) */
    introspector?: Introspector;
    /** Module manager instance (if needed) */
    moduleManager?: ModuleManager;
    /** Records created during test execution (for cleanup) */
    createdRecords: Array<{
        model: string;
        id: number;
    }>;
    /** Track created record for automatic cleanup */
    trackRecord(model: string, id: number): void;
    /** Generate unique test name */
    uniqueTestName(prefix: string): string;
    /** OdooClient class for code that creates its own client */
    OdooClient: typeof OdooClient;
    /** Introspector class */
    Introspector: typeof Introspector;
    /** ModuleManager class */
    ModuleManager: typeof ModuleManager;
}
export interface RunnerConfig {
    url: string;
    database: string;
    username: string;
    password: string;
}
export interface ExecutionResult {
    success: boolean;
    error?: Error;
    result?: any;
    /** Variables exposed by the code block */
    exports?: Record<string, any>;
}
/**
 * Create a test context with dependency injection based on needs.
 *
 * @param needs - Array of dependency names (e.g., ['client', 'introspector'])
 * @param config - Optional config override
 * @returns Test context with requested dependencies
 */
export declare function createTestContext(needs: string[], config?: RunnerConfig): Promise<TestContext>;
/**
 * Cleanup test context - delete created records and logout.
 *
 * @param ctx - Test context to cleanup
 */
export declare function cleanupTestContext(ctx: TestContext): Promise<void>;
/**
 * Clear created records from context (for per-test cleanup).
 */
export declare function clearCreatedRecords(ctx: TestContext): Promise<void>;
/**
 * Execute a single code block with proper context.
 *
 * @param block - Testable code block to execute
 * @param ctx - Test context with dependencies
 * @returns Execution result
 */
export declare function executeCodeBlock(block: TestableCodeBlock, ctx: TestContext): Promise<ExecutionResult>;
/**
 * Evaluate an expect expression against result.
 *
 * @param expectExpr - Expression like "id > 0" or "session !== null"
 * @param result - Result from code execution
 * @param ctx - Test context (for accessing created records, etc.)
 * @returns Whether the expectation passed
 */
export declare function evaluateExpect(expectExpr: string, result: any, ctx: TestContext): boolean;
/**
 * Check if required module is installed.
 *
 * @param ctx - Test context
 * @param moduleName - Module to check
 * @returns Whether module is installed
 */
export declare function isModuleInstalled(ctx: TestContext, moduleName: string): Promise<boolean>;
/**
 * Check if all required dependencies for a block are available.
 *
 * @param block - Code block to check
 * @param ctx - Test context
 * @returns Object with available flag and reason if not
 */
export declare function checkDependencies(block: TestableCodeBlock, ctx: TestContext): Promise<{
    available: boolean;
    reason?: string;
}>;
//# sourceMappingURL=markdown-example-runner.d.ts.map