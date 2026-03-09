/**
 * Global test setup using Testcontainers.
 *
 * Starts fresh PostgreSQL + Odoo containers for each test run.
 * Tests connect to localhost on dynamic ports — no shared state between runs.
 *
 * In CI, we also use testcontainers (no more manual docker-compose).
 */

import { GenericContainer, Network, Wait } from 'testcontainers';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import path from 'path';

const SKIP_TEARDOWN = process.env.SKIP_TEARDOWN === 'true';

export default async function globalSetup() {
  console.log('🚀 Starting Odoo test environment with Testcontainers...');

  const projectRoot = path.resolve(__dirname, '..', '..');

  try {
    // Create an isolated network
    const network = await new Network().start();

    // Start PostgreSQL
    const postgres = await new PostgreSqlContainer('postgres:15-alpine')
      .withDatabase('postgres')
      .withUsername('admin')
      .withPassword('admin')
      .withNetwork(network)
      .withNetworkAliases('postgres')
      .start();

    const pgPort = postgres.getMappedPort(5432);
    console.log(`✅ PostgreSQL ready on port ${pgPort}`);

    // Start Odoo — mirrors docker-compose.test.yml exactly
    const odoo = await new GenericContainer('odoo:17.0')
      .withNetwork(network)
      .withEnvironment({
        HOST: 'postgres',
        USER: 'admin',
        PASSWORD: 'admin',
      })
      .withEntrypoint(['/mnt/docker/odoo-entrypoint.sh'])
      .withCommand(['--database', 'odoo', '--init', 'base,mail,crm', '--without-demo', 'all', '--max-cron-threads', '0'])
      .withBindMounts([
        { source: path.join(projectRoot, 'docker'), target: '/mnt/docker', readOnly: true },
        { source: path.join(projectRoot, 'test-addons'), target: '/mnt/oca', readOnly: true },
      ])
      .withExposedPorts(8069)
      .withWaitStrategy(
        Wait.forHttp('/web/health', 8069).forStatusCode(200).withStartupTimeout(180_000)
      )
      .start();

    const odooPort = odoo.getMappedPort(8069);
    console.log(`✅ Odoo HTTP ready on port ${odooPort}`);

    // /web/health fires as soon as the HTTP listener binds, but the ORM / session
    // handler may not be ready yet — authenticate() against a half-started worker
    // returns 500 and causes integration test beforeAll to fail.
    // Poll until a real JSON-RPC authenticate call succeeds (max 60s).
    const odooBaseUrl = `http://localhost:${odooPort}`;
    console.log('⏳ Waiting for Odoo session handler to be ready...');
    const authPayload = JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { db: 'odoo', login: 'admin', password: 'admin' },
    });
    let authReady = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const res = await fetch(`${odooBaseUrl}/web/session/authenticate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: authPayload,
        });
        if (res.ok) {
          authReady = true;
          break;
        }
      } catch {
        // not ready yet
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (!authReady) {
      throw new Error('Odoo session handler did not become ready within 60 seconds');
    }
    console.log('✅ Odoo session handler ready');

    // Set env vars so tests find the containers (dynamic ports)
    process.env.ODOO_URL = odooBaseUrl;
    process.env.ODOO_DB_NAME = 'odoo';
    process.env.ODOO_DB_USER = 'admin';
    process.env.ODOO_DB_PASSWORD = 'admin';

    console.log(`✅ Test environment ready (Odoo at ${process.env.ODOO_URL})`);

    // Return teardown function
    return async () => {
      if (SKIP_TEARDOWN) {
        console.log('⏭️  Skipping teardown (SKIP_TEARDOWN=true)');
        return;
      }

      console.log('🧹 Cleaning up Testcontainers...');
      await odoo.stop();
      await postgres.stop();
      await network.stop();
      console.log('✅ Test environment cleaned up');
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Failed to start test environment:', errorMessage);
    process.exit(1);
  }
}
