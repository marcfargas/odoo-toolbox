import { execSync } from 'child_process';

const CI = process.env.CI === 'true';
const KEEP_CONTAINERS = process.env.KEEP_CONTAINERS === 'true';
const SKIP_TEARDOWN = process.env.SKIP_TEARDOWN === 'true';

// Matrix testing support
const ODOO_VERSION = process.env.ODOO_VERSION || '17.0';

/**
 * Generate unique project name based on version.
 * Format: odoo-toolbox-{major}-{minor}
 * 
 * Examples:
 * - 17.0 → odoo-toolbox-17-0
 * - 18.0 → odoo-toolbox-18-0
 * 
 * IMPORTANT: This must match getProjectName() in globalSetup.ts and npm scripts in package.json.
 */
function getProjectName(version: string): string {
  return `odoo-toolbox-${version.replace(/\./g, '-')}`;
}

export default async function globalTeardown() {
  if (CI) {
    // CI handles cleanup via workflow
    console.log('🔄 CI mode detected - skipping cleanup');
    return;
  }

  if (KEEP_CONTAINERS) {
    const projectName = getProjectName(ODOO_VERSION);
    console.log('🧊 Keeping containers for debugging (KEEP_CONTAINERS=true)');
    console.log(`   Cleanup: docker compose -p ${projectName} down -v`);
    return;
  }

  if (SKIP_TEARDOWN) {
    const projectName = getProjectName(ODOO_VERSION);
    console.log('⏭️  Skipping teardown for fast iteration (SKIP_TEARDOWN=true)');
    console.log(`   Run "docker compose -p ${projectName} down" to cleanup manually`);
    return;
  }

  const projectName = getProjectName(ODOO_VERSION);
  console.log('🧹 Cleaning up test environment...');

  try {
    execSync(`docker compose -p ${projectName} down -v`, {
      stdio: 'inherit',
    });
    console.log('✅ Test environment cleaned up');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn('⚠️ Error during cleanup:', errorMessage);
    // Don't fail teardown on cleanup errors
  }
}
