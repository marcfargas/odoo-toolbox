"use strict";
/**
 * Example 2: Planning Without Applying - CI/CD Validation
 *
 * This example shows how to use the planning and dry-run features
 * for CI/CD pipelines without making actual changes.
 *
 * Use case: Validate configuration in a pipeline, generate reports,
 * let humans approve changes before application.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@odoo-toolbox/client");
const src_1 = require("../src");
async function main() {
    const client = new client_1.OdooClient({
        url: process.env.ODOO_URL || 'http://localhost:8069',
        database: process.env.ODOO_DB || 'odoo',
        username: process.env.ODOO_USER || 'admin',
        password: process.env.ODOO_PASSWORD || 'admin',
    });
    await client.authenticate();
    console.log('✓ Connected to Odoo\n');
    // ============================================================================
    // Load desired configuration from file or code
    // ============================================================================
    const desiredConfiguration = new Map([
        [
            1,
            {
                name: 'Standard Project',
                active: true,
                description: 'Company-wide standard project',
            },
        ],
        [
            3,
            {
                name: 'Archived Old Project',
                active: false,
                description: 'This project is archived',
            },
        ],
    ]);
    console.log('Configuration audit:');
    console.log('====================\n');
    console.log('Desired configuration:');
    desiredConfiguration.forEach((config, id) => {
        console.log(`  [${id}] ${config.name} (active: ${config.active})`);
    });
    console.log();
    // ============================================================================
    // Read actual state
    // ============================================================================
    console.log('Reading actual configuration from Odoo...');
    const actualProjects = await client.searchRead('project.project', [['id', 'in', [1, 3]]]);
    const actualStates = new Map(actualProjects.map((p) => [
        p.id,
        {
            name: p.name,
            active: p.active,
            description: p.description,
        },
    ]));
    console.log(`Found ${actualStates.size} projects\n`);
    // ============================================================================
    // Compare and plan
    // ============================================================================
    console.log('Analyzing differences...\n');
    const diffs = (0, src_1.compareRecords)('project.project', desiredConfiguration, actualStates);
    const plan = (0, src_1.generatePlan)(diffs, {
        autoReorder: true,
        validateDependencies: true,
    });
    // ============================================================================
    // Generate report
    // ============================================================================
    console.log('Drift Report:');
    console.log('═════════════\n');
    if (plan.summary.isEmpty) {
        console.log('✓ No drift detected. Configuration is in sync.\n');
    }
    else {
        console.log(`Drift detected: ${plan.summary.totalOperations} change(s) needed\n`);
        // Show the plan
        const formatted = (0, src_1.formatPlanForConsole)(plan);
        console.log(formatted);
        console.log();
        // Detailed change summary
        console.log('Detailed changes:');
        console.log('─────────────────\n');
        plan.operations.forEach((op, index) => {
            console.log(`${index + 1}. ${op.type.toUpperCase()} ${op.model}[${op.id}]`);
            if (op.values) {
                Object.entries(op.values).forEach(([field, value]) => {
                    console.log(`   ${field} = ${typeof value === 'object' ? JSON.stringify(value) : value}`);
                });
            }
            console.log();
        });
    }
    // ============================================================================
    // Validate without applying
    // ============================================================================
    if (!plan.summary.isEmpty) {
        console.log('Running validation (dry-run)...\n');
        const validation = await (0, src_1.dryRunPlan)(plan, client, {
            validate: true,
            stopOnError: false,
        });
        if (validation.success) {
            console.log('✓ All changes validated successfully.\n');
        }
        else {
            console.log('✗ Validation errors found:\n');
            validation.errors?.forEach((err) => console.log(`  - ${err}`));
            console.log();
        }
    }
    // ============================================================================
    // Generate summary for CI/CD output
    // ============================================================================
    console.log('Summary:');
    console.log('────────\n');
    const summary = {
        timestamp: new Date().toISOString(),
        environment: {
            url: process.env.ODOO_URL || 'http://localhost:8069',
            database: process.env.ODOO_DB || 'odoo',
        },
        audit: {
            itemsChecked: desiredConfiguration.size,
            itemsWithDrift: diffs.length,
            changesPlan: {
                creates: plan.summary.creates,
                updates: plan.summary.updates,
                deletes: plan.summary.deletes,
            },
        },
        status: plan.summary.isEmpty ? 'PASS' : 'CHANGES_NEEDED',
    };
    console.log(JSON.stringify(summary, null, 2));
    // ============================================================================
    // Exit with appropriate code for CI
    // ============================================================================
    if (plan.summary.hasErrors) {
        console.log('\n⚠ Validation failed, stopping here (no changes applied)');
        process.exit(1);
    }
    if (!plan.summary.isEmpty) {
        console.log('\n⚠ Drift detected but NOT applied (dry-run only)');
        console.log('   Review changes above and apply manually or via CI/CD approval');
        process.exit(0); // Still exit 0 because validation passed
    }
    console.log('\n✓ Configuration is in sync!');
    process.exit(0);
}
main().catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
});
//# sourceMappingURL=2-ci-cd-validation.js.map