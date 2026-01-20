import { execSync } from 'child_process';

const CI = process.env.CI === 'true';

export default async function globalSetup() {
  if (CI) {
    // In GitHub Actions CI, services are handled by the workflow
    console.log('🔄 CI mode detected - skipping Docker setup');
    return;
  }

  console.log('🚀 Starting Odoo test environment...');

  try {
    // Start containers and wait for healthchecks to pass
    console.log('📦 Starting Docker containers...');
    execSync('docker-compose -f docker-compose.test.yml up -d --wait', {
      stdio: 'inherit',
    });

    console.log('✅ Test environment ready');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Failed to start test environment:', errorMessage);
    process.exit(1);
  }
}
