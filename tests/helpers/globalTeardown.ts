import { execSync } from 'child_process';

const CI = process.env.CI === 'true';
const KEEP_CONTAINERS = process.env.KEEP_CONTAINERS === 'true';

export default async function globalTeardown() {
  if (CI) {
    // CI handles cleanup via workflow
    console.log('🔄 CI mode detected - skipping cleanup');
    return;
  }

  if (KEEP_CONTAINERS) {
    console.log('🧊 Keeping containers for debugging (KEEP_CONTAINERS=true)');
    return;
  }

  console.log('🧹 Cleaning up test environment...');

  try {
    execSync('docker-compose -f docker-compose.test.yml down -v', {
      stdio: 'inherit',
    });
    console.log('✅ Test environment cleaned up');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn('⚠️ Error during cleanup:', errorMessage);
    // Don't fail teardown on cleanup errors
  }
}
