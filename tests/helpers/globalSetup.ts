import { execSync } from 'child_process';

const CI = process.env.CI === 'true';
const KEEP_CONTAINERS = process.env.KEEP_CONTAINERS === 'true';
const SKIP_TEARDOWN = process.env.SKIP_TEARDOWN === 'true';

// Matrix testing support
const ODOO_VERSION = process.env.ODOO_VERSION || '17.0';
const POSTGRES_VERSION = process.env.POSTGRES_VERSION || '15';

// Generate unique project name based on version
function getProjectName(version: string): string {
  return `odoo-toolbox-${version.replace(/\./g, '-')}`;
}

// Map Odoo version to default port
function getDefaultPort(version: string): string {
  if (version.startsWith('18.')) return '8018';
  return '8069'; // Default for 17.0 and others
}

export default async function globalSetup() {
  if (CI) {
    // In GitHub Actions CI, services are handled by the workflow
    console.log('🔄 CI mode detected - skipping Docker setup');
    return;
  }

  const projectName = getProjectName(ODOO_VERSION);
  const odooPort = process.env.ODOO_PORT || getDefaultPort(ODOO_VERSION);
  const postgresPort = process.env.POSTGRES_PORT || '5432';

  console.log(`🚀 Starting Odoo ${ODOO_VERSION} test environment...`);
  console.log(`   Port: http://localhost:${odooPort}`);
  console.log(`   Project: ${projectName}`);

  try {
    // Start containers and wait for healthchecks to pass
    console.log('📦 Starting Docker containers...');
    execSync(
      `docker compose -f docker-compose.matrix.yml -p ${projectName} up -d --wait`,
      {
        stdio: 'inherit',
        env: {
          ...process.env,
          COMPOSE_PROJECT_NAME: projectName,
          ODOO_VERSION,
          POSTGRES_VERSION,
          ODOO_PORT: odooPort,
          POSTGRES_PORT: postgresPort,
        },
      }
    );

    console.log('✅ Test environment ready');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Failed to start test environment:', errorMessage);
    process.exit(1);
  }

  // Return teardown function
  return async () => {
    if (CI) {
      // CI handles cleanup via workflow
      console.log('🔄 CI mode detected - skipping cleanup');
      return;
    }

    if (KEEP_CONTAINERS) {
      console.log('🧊 Keeping containers for debugging (KEEP_CONTAINERS=true)');
      console.log(`   Cleanup: docker compose -p ${projectName} down -v`);
      return;
    }

    if (SKIP_TEARDOWN) {
      console.log('⏭️  Skipping teardown for fast iteration (SKIP_TEARDOWN=true)');
      console.log(`   Run "docker compose -p ${projectName} down" to cleanup manually`);
      return;
    }

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
  };
}
