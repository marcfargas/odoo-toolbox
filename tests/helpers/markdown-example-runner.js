"use strict";
/**
 * Markdown Example Runner
 *
 * Executes extracted code blocks against a real Odoo instance,
 * handling setup, teardown, and dependency injection.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTestContext = createTestContext;
exports.cleanupTestContext = cleanupTestContext;
exports.clearCreatedRecords = clearCreatedRecords;
exports.executeCodeBlock = executeCodeBlock;
exports.evaluateExpect = evaluateExpect;
exports.isModuleInstalled = isModuleInstalled;
exports.checkDependencies = checkDependencies;
const client_1 = require("@odoo-toolbox/client");
const introspection_1 = require("@odoo-toolbox/introspection");
const odoo_instance_1 = require("./odoo-instance");
/**
 * Create a test context with dependency injection based on needs.
 *
 * @param needs - Array of dependency names (e.g., ['client', 'introspector'])
 * @param config - Optional config override
 * @returns Test context with requested dependencies
 */
async function createTestContext(needs, config) {
    const testConfig = config || (0, odoo_instance_1.getTestConfig)();
    const client = new client_1.OdooClient({
        url: testConfig.url,
        database: testConfig.database,
        username: testConfig.username,
        password: testConfig.password,
    });
    await client.authenticate();
    const createdRecords = [];
    const ctx = {
        client,
        createdRecords,
        trackRecord(model, id) {
            createdRecords.push({ model, id });
        },
        uniqueTestName(prefix) {
            return (0, odoo_instance_1.uniqueTestName)(prefix);
        },
        // Provide class constructors for code that needs to create its own instances
        OdooClient: client_1.OdooClient,
        Introspector: introspection_1.Introspector,
        ModuleManager: client_1.ModuleManager,
    };
    // Add optional dependencies
    if (needs.includes('introspector')) {
        ctx.introspector = new introspection_1.Introspector(client);
    }
    if (needs.includes('module-manager')) {
        ctx.moduleManager = new client_1.ModuleManager(client);
    }
    return ctx;
}
/**
 * Cleanup test context - delete created records and logout.
 *
 * @param ctx - Test context to cleanup
 */
async function cleanupTestContext(ctx) {
    // Delete created records in reverse order
    for (const { model, id } of ctx.createdRecords.reverse()) {
        try {
            await ctx.client.unlink(model, id);
        }
        catch {
            // Ignore cleanup errors
        }
    }
    ctx.createdRecords.length = 0;
    try {
        ctx.client.logout();
    }
    catch {
        // Ignore logout errors
    }
}
/**
 * Clear created records from context (for per-test cleanup).
 */
async function clearCreatedRecords(ctx) {
    for (const { model, id } of ctx.createdRecords.reverse()) {
        try {
            await ctx.client.unlink(model, id);
        }
        catch {
            // Ignore cleanup errors
        }
    }
    ctx.createdRecords.length = 0;
}
/**
 * Process imports from code and return the body.
 * Imports are stripped since we inject dependencies.
 */
function processImports(code) {
    const importPattern = /^import\s+.*from\s+['"].*['"];?\s*$/gm;
    const imports = [];
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
function wrapCodeForExecution(code, needs) {
    const { bodyCode } = processImports(code);
    const injections = [];
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
async function executeCodeBlock(block, ctx) {
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
    }
    catch (error) {
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
function evaluateExpect(expectExpr, result, ctx) {
    try {
        // Create a function that evaluates the expression
        // with result and common variables in scope
        // eslint-disable-next-line no-new-func
        const evalFn = new Function('result', 'ctx', 'id', 'session', `return (${expectExpr});`);
        // Extract common variables from result
        const id = typeof result === 'number' ? result : result?.id;
        const session = result?.session || ctx.client.getSession();
        return evalFn(result, ctx, id, session);
    }
    catch {
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
async function isModuleInstalled(ctx, moduleName) {
    if (!ctx.moduleManager) {
        ctx.moduleManager = new client_1.ModuleManager(ctx.client);
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
async function checkDependencies(block, ctx) {
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
//# sourceMappingURL=markdown-example-runner.js.map