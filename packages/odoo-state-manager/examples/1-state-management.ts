/**
 * Example 1: State Management - Drift Detection & Planning
 *
 * This example demonstrates the full state management workflow:
 * 1. Compare desired state vs actual Odoo state
 * 2. Generate execution plan
 * 3. Review and apply changes
 *
 * Use case: Ensure projects have consistent configuration across your Odoo instance
 */

import { OdooClient } from '@marcfargas/odoo-client';
import { compareRecords, generatePlan, formatPlanForConsole, applyPlan, dryRunPlan } from '../src';

async function main() {
  // Initialize client
  const client = new OdooClient({
    url: process.env.ODOO_URL || 'http://localhost:8069',
    database: process.env.ODOO_DB || 'odoo',
    username: process.env.ODOO_USER || 'admin',
    password: process.env.ODOO_PASSWORD || 'admin',
  });

  await client.authenticate();
  console.log('✓ Connected to Odoo\n');

  // ============================================================================
  // STEP 1: Define Desired State
  // ============================================================================

  console.log('Step 1: Define desired project configuration');
  console.log('───────────────────────────────────────────\n');

  // What we want our projects to look like
  const desiredProjects = new Map([
    [
      1,
      {
        name: 'Q1 Planning - Updated',
        active: true,
        description: 'Q1 2026 planning activities',
      },
    ],
    [
      2,
      {
        name: 'Q2 Planning - New',
        active: true,
        description: 'Q2 2026 planning activities',
      },
    ],
  ]);

  console.log('Desired state for 2 projects:');
  desiredProjects.forEach((values, id) => {
    console.log(`  - Project ${id}: ${values.name}`);
  });
  console.log();

  // ============================================================================
  // STEP 2: Read Actual State from Odoo
  // ============================================================================

  console.log('Step 2: Read actual state from Odoo');
  console.log('────────────────────────────────────\n');

  // Read first 2 projects
  const projectIds = await client.search('project.project', [['id', '<=', 2]]);
  console.log(`Found ${projectIds.length} projects`);

  const actualProjects = await client.searchRead('project.project', [['id', '<=', 2]], {
    fields: ['name', 'active', 'description'],
  });

  // Convert to Map format for comparison
  const actualStates = new Map(actualProjects.map((p) => [p.id, p]));

  console.log('Actual state:');
  actualStates.forEach((values, id) => {
    console.log(`  - Project ${id}: ${values.name}`);
  });
  console.log();

  // ============================================================================
  // STEP 3: Compare Desired vs Actual
  // ============================================================================

  console.log('Step 3: Compare desired vs actual state');
  console.log('───────────────────────────────────────\n');

  // Get field metadata for readonly field filtering (optional but recommended)
  const fieldMetadata = await client.getFieldMetadata('project.project', [
    'name',
    'active',
    'description',
  ]);

  // Perform deep comparison
  const diffs = compareRecords('project.project', desiredProjects, actualStates, {
    fieldMetadata,
  });

  console.log(`Detected ${diffs.length} record(s) with changes:`);
  diffs.forEach((diff) => {
    console.log(`\n  Project ${diff.id}:`);
    diff.changes.forEach((change) => {
      console.log(`    ${change.path}: "${change.oldValue}" → "${change.newValue}"`);
    });
  });
  console.log();

  // ============================================================================
  // STEP 4: Generate Execution Plan
  // ============================================================================

  console.log('Step 4: Generate execution plan');
  console.log('───────────────────────────────\n');

  const plan = generatePlan(diffs, {
    autoReorder: true,
    validateDependencies: true,
  });

  console.log(
    `Plan summary: ${plan.summary.creates} creates, ${plan.summary.updates} updates, ${plan.summary.deletes} deletes`
  );
  console.log();

  // ============================================================================
  // STEP 5: Review Plan in Terraform-like Format
  // ============================================================================

  console.log('Step 5: Review plan (Terraform-like format)');
  console.log('──────────────────────────────────────────\n');

  const formatted = formatPlanForConsole(plan);
  console.log(formatted);
  console.log();

  // ============================================================================
  // STEP 6: Dry-Run Validation
  // ============================================================================

  console.log('Step 6: Dry-run validation (no changes to Odoo)');
  console.log('─────────────────────────────────────────────\n');

  const dryRunResult = await dryRunPlan(plan, client, {
    validate: true,
  });

  if (dryRunResult.success) {
    console.log('✓ Dry-run passed validation');
  } else {
    console.log('✗ Dry-run validation failed:');
    dryRunResult.errors?.forEach((err) => console.log(`  - ${err}`));
    process.exit(1);
  }
  console.log();

  // ============================================================================
  // STEP 7: Apply Changes
  // ============================================================================

  console.log('Step 7: Apply changes to Odoo');
  console.log('──────────────────────────────\n');

  const applyResult = await applyPlan(plan, client, {
    dryRun: false,
    stopOnError: false,
    onProgress: (current, total, opId) => {
      process.stdout.write(`  [${current}/${total}] Executing ${opId}...\r`);
    },
    onOperationComplete: (opResult) => {
      if (!opResult.success) {
        console.log(`  ✗ Failed: ${opResult.error?.message}`);
      }
    },
  });

  console.log(`\n✓ Applied ${applyResult.applied}/${applyResult.total} operations`);

  if (applyResult.failed > 0) {
    console.log(`✗ ${applyResult.failed} operations failed:`);
    applyResult.errors?.forEach((err) => console.log(`  - ${err}`));
  }

  console.log(`\nExecution took ${applyResult.duration}ms`);
  console.log();

  // ============================================================================
  // STEP 8: Verify Changes
  // ============================================================================

  console.log('Step 8: Verify changes were applied');
  console.log('──────────────────────────────────\n');

  const verifyProjects = await client.searchRead('project.project', [['id', '<=', 2]], {
    fields: ['name', 'active', 'description'],
  });

  console.log('Final state in Odoo:');
  verifyProjects.forEach((proj) => {
    console.log(`  - Project ${proj.id}: ${proj.name}`);
  });

  console.log('\n✓ State management workflow complete!');
}

// Error handling
main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
