/**
 * Markdown Example Runner
 *
 * Executes extracted code blocks against a real Odoo instance,
 * handling setup, teardown, and dependency injection.
 */

import { OdooClient, ModuleManager } from '@odoo-toolbox/client';
import { Introspector } from '@odoo-toolbox/introspection';
import type { TestableCodeBlock } from './markdown-example-extractor';
import { getTestConfig, uniqueTestName } from './odoo-instance';

export interface TestContext {
  /** Authenticated Odoo client */
  client: OdooClient;
  /** Introspector instance (if needed) */
  introspector?: Introspector;
  /** Module manager instance (if needed) */
  moduleManager?: ModuleManager;
  /** Records created during test execution (for cleanup) */
  createdRecords: Array<{ model: string; id: number }>;
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
export async function createTestContext(
  needs: string[],
  config?: RunnerConfig
): Promise<TestContext> {
  const testConfig = config || getTestConfig();

  const client = new OdooClient({
    url: testConfig.url,
    database: testConfig.database,
    username: testConfig.username,
    password: testConfig.password,
  });

  await client.authenticate();

  const createdRecords: Array<{ model: string; id: number }> = [];

  const ctx: TestContext = {
    client,
    createdRecords,
    trackRecord(model: string, id: number) {
      createdRecords.push({ model, id });
    },
    uniqueTestName(prefix: string) {
      return uniqueTestName(prefix);
    },
    // Provide class constructors for code that needs to create its own instances
    OdooClient,
    Introspector,
    ModuleManager,
  };

  // Add optional dependencies
  if (needs.includes('introspector')) {
    ctx.introspector = new Introspector(client);
  }

  if (needs.includes('module-manager')) {
    ctx.moduleManager = new ModuleManager(client);
  }

  return ctx;
}

/**
 * Cleanup test context - delete created records and logout.
 *
 * @param ctx - Test context to cleanup
 */
export async function cleanupTestContext(ctx: TestContext): Promise<void> {
  // Delete created records in reverse order
  for (const { model, id } of ctx.createdRecords.reverse()) {
    try {
      await ctx.client.unlink(model, id);
    } catch {
      // Ignore cleanup errors
    }
  }

  ctx.createdRecords.length = 0;

  try {
    ctx.client.logout();
  } catch {
    // Ignore logout errors
  }
}

/**
 * Clear created records from context (for per-test cleanup).
 */
export async function clearCreatedRecords(ctx: TestContext): Promise<void> {
  for (const { model, id } of ctx.createdRecords.reverse()) {
    try {
      await ctx.client.unlink(model, id);
    } catch {
      // Ignore cleanup errors
    }
  }
  ctx.createdRecords.length = 0;
}

/**
 * Process imports from code and return the body.
 * Imports are stripped since we inject dependencies.
 */
function processImports(code: string): { imports: string[]; bodyCode: string } {
  const importPattern = /^import\s+.*from\s+['"].*['"];?\s*$/gm;
  const imports: string[] = [];

  const bodyCode = code.replace(importPattern, (match) => {
    imports.push(match.trim());
    return '';
  });

  return { imports, bodyCode: bodyCode.trim() };
}

/**
 * Wrap code for execution with injected dependencies.
 *
 * @param code - Raw code from markdown
 * @param needs - Dependencies to inject
 * @returns Wrapped code ready for execution
 */
function wrapCodeForExecution(code: string, needs: string[]): string {
  const { bodyCode } = processImports(code);

  const injections: string[] = [];

  // Always inject these from context
  injections.push('const { trackRecord, uniqueTestName, OdooClient, Introspector, ModuleManager } = ctx;');

  if (needs.includes('client') || needs.length === 0) {
    // Default to providing client if no specific needs
    injections.push('const client = ctx.client;');
  }

  if (needs.includes('introspector')) {
    injections.push('const introspector = ctx.introspector;');
  }

  if (needs.includes('module-manager')) {
    injections.push('const moduleManager = ctx.moduleManager;');
  }

  // Wrap in async IIFE that is immediately invoked
  return `
(async function(ctx) {
  ${injections.join('\n  ')}

  // User code starts here
  ${bodyCode}
})(ctx)
  `.trim();
}

/**
 * Execute a single code block with proper context.
 *
 * @param block - Testable code block to execute
 * @param ctx - Test context with dependencies
 * @returns Execution result
 */
export async function executeCodeBlock(
  block: TestableCodeBlock,
  ctx: TestContext
): Promise<ExecutionResult> {
  try {
    const wrappedCode = wrapCodeForExecution(block.code, block.needs);

    // Create function from wrapped code
    // eslint-disable-next-line no-new-func
    const fn = new Function('ctx', `return ${wrappedCode}`);

    // Execute and capture result
    const result = await fn(ctx);

    // Track any records created via creates attribute
    if (block.creates && typeof result === 'number') {
      ctx.trackRecord(block.creates, result);
    }

    return { success: true, result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Evaluate an expect expression against result.
 *
 * @param expectExpr - Expression like "id > 0" or "session !== null"
 * @param result - Result from code execution
 * @param ctx - Test context (for accessing created records, etc.)
 * @returns Whether the expectation passed
 */
export function evaluateExpect(
  expectExpr: string,
  result: any,
  ctx: TestContext
): boolean {
  try {
    // Create a function that evaluates the expression
    // with result and common variables in scope
    // eslint-disable-next-line no-new-func
    const evalFn = new Function(
      'result',
      'ctx',
      'id',
      'session',
      `return (${expectExpr});`
    );

    // Extract common variables from result
    const id = typeof result === 'number' ? result : result?.id;
    const session = result?.session || ctx.client.getSession();

    return evalFn(result, ctx, id, session);
  } catch {
    return false;
  }
}

/**
 * Check if required module is installed.
 *
 * @param ctx - Test context
 * @param moduleName - Module to check
 * @returns Whether module is installed
 */
export async function isModuleInstalled(
  ctx: TestContext,
  moduleName: string
): Promise<boolean> {
  if (!ctx.moduleManager) {
    ctx.moduleManager = new ModuleManager(ctx.client);
  }
  return ctx.moduleManager.isModuleInstalled(moduleName);
}

/**
 * Check if all required dependencies for a block are available.
 *
 * @param block - Code block to check
 * @param ctx - Test context
 * @returns Object with available flag and reason if not
 */
export async function checkDependencies(
  block: TestableCodeBlock,
  ctx: TestContext
): Promise<{ available: boolean; reason?: string }> {
  for (const need of block.needs) {
    // Check module dependencies
    if (need.endsWith('-module')) {
      const moduleName = need.replace('-module', '');
      const installed = await isModuleInstalled(ctx, moduleName);
      if (!installed) {
        return {
          available: false,
          reason: `Module '${moduleName}' not installed`,
        };
      }
    }
  }

  return { available: true };
}
