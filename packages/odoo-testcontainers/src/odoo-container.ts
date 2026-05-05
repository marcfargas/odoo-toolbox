/**
 * Custom Testcontainer module for Odoo development.
 *
 * Provides high-level API for starting Odoo with specific modules,
 * custom addons, and proper cleanup.
 */

import Dockerode from 'dockerode';
import { GenericContainer, StartedTestContainer, Wait, Network } from 'testcontainers';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { OdooClient, ModuleManager } from '@marcfargas/odoo-client';
import { normaliseOdooVersion } from './version';
import {
  createSnapshotCache,
  ensureSnapshotDir,
  hasSnapshot,
  restoreSnapshot,
  saveSnapshot,
  snapshotBindMount,
  type SnapshotCacheOptions,
} from './snapshot-cache';

const POSTGRES_IMAGE = 'postgres:15-alpine';

/**
 * Force-disconnect all containers from a Docker network.
 *
 * When testcontainers `.stop()` is called on containers, they may not fully
 * disconnect from networks before the promise resolves. Docker requires all
 * endpoints to be disconnected before a network can be removed. This helper
 * uses the Docker API directly to force-disconnect any remaining endpoints.
 */
async function forceDisconnectNetwork(networkId: string): Promise<void> {
  const docker = new Dockerode();
  const network = docker.getNetwork(networkId);
  try {
    const info = await network.inspect();
    for (const containerId of Object.keys(info.Containers || {})) {
      try {
        await network.disconnect({ Container: containerId, Force: true });
      } catch {
        /* container may already be gone */
      }
    }
  } catch {
    /* network may already be gone */
  }
}

// ── Public types ────────────────────────────────────────────────────

export interface AddonsMount {
  /** Local source directory (e.g., './oca-addons' or './my-custom-addons') */
  source: string;
  /** Mount point inside container (e.g., '/mnt/oca-addons') */
  target?: string;
  /** Mount mode (default: 'ro' for read-only) */
  mode?: 'ro' | 'rw';
}

export interface OdooTestContainerOptions {
  /** Odoo modules to install (e.g., ['hr_attendance', 'project', 'sale']) */
  modules?: string[];
  /** Custom addons to mount - can be string (single path) or AddonsMount[] (multiple) */
  addonsPath?: string | AddonsMount[];
  /** Database name (default: 'test_odoo') */
  database?: string;
  /** Admin password (default: 'admin') */
  adminPassword?: string;
  /** Additional environment variables */
  env?: Record<string, string>;
  /** Startup timeout in ms (default: 180000) */
  startupTimeout?: number;
  /**
   * Cache the post-init/module-install database baseline as a local pg_dump.
   * Enabled by default. Set false to force a cold Odoo init every time.
   */
  snapshot?: boolean | SnapshotCacheOptions;
}

export interface StartedOdooContainer {
  odooContainer: StartedTestContainer;
  postgresContainer: StartedPostgreSqlContainer | StartedTestContainer;
  client: OdooClient;
  moduleManager: ModuleManager;
  url: string;
  database: string;
  cleanup: () => Promise<void>;
}

export class OdooTestContainer {
  private options: Required<Omit<OdooTestContainerOptions, 'addonsPath' | 'env' | 'snapshot'>> & {
    addonsPath?: string | AddonsMount[];
    env: Record<string, string>;
    snapshot?: boolean | SnapshotCacheOptions;
  };

  constructor(options: OdooTestContainerOptions = {}) {
    this.options = {
      modules: [],
      database: 'test_odoo',
      adminPassword: 'admin',
      startupTimeout: 300_000, // 5 min — DB init can take 3–4 min in CI
      env: {},
      ...options,
    };
  }

  /**
   * Start Odoo container with PostgreSQL and install requested modules.
   *
   * When snapshot caching is enabled, the first run for a given
   * Odoo/modules/addons/env hash writes a local pg_dump. Later starts restore
   * that baseline and skip Odoo --init plus module installation.
   */
  async start(): Promise<StartedOdooContainer> {
    const odooVer = normaliseOdooVersion(process.env.ODOO_VERSION);
    const snapshot = createSnapshotCache(this.options.snapshot, {
      odooVersion: odooVer,
      postgresImage: POSTGRES_IMAGE,
      modules: this.options.modules,
      addonsPath: this.options.addonsPath,
      database: this.options.database,
      adminPassword: this.options.adminPassword,
      env: this.options.env,
    });
    const snapshotHit = hasSnapshot(snapshot);

    if (snapshot.enabled) {
      ensureSnapshotDir(snapshot);
      console.log(
        snapshotHit
          ? `⚡ Starting Odoo testcontainer from snapshot ${snapshot.key}`
          : `🚀 Starting Odoo testcontainer cold; will save snapshot ${snapshot.key}`
      );
    } else {
      console.log(
        `🚀 Starting Odoo testcontainer with modules: ${this.options.modules.join(', ')}`
      );
    }

    // Create a network for container communication
    const network = await new Network().start();

    // Track started containers for cleanup on error
    const startedContainers: StartedTestContainer[] = [];

    try {
      // ── Postgres ──────────────────────────────────────────────────────
      const pgUser = 'odoo';
      const pgPassword = 'odoo';

      const postgresContainer: StartedPostgreSqlContainer | StartedTestContainer =
        await new PostgreSqlContainer(POSTGRES_IMAGE)
          .withDatabase(this.options.database)
          .withUsername(pgUser)
          .withPassword(pgPassword)
          .withNetwork(network)
          .withNetworkAliases('db')
          .withBindMounts(snapshotBindMount(snapshot))
          .start();

      startedContainers.push(postgresContainer);
      console.log(
        `✅ PostgreSQL ready at ` +
          `${postgresContainer.getHost()}:${postgresContainer.getMappedPort(5432)}`
      );

      if (snapshotHit) {
        await restoreSnapshot(postgresContainer, snapshot, this.options.database, pgUser);
        console.log(`✅ Restored Odoo database snapshot ${snapshot.key}`);
      }

      // ── Odoo ──────────────────────────────────────────────────────────
      //
      // --max-cron-threads 0 disables the cron scheduler:
      //   • Eliminates ir_cron advisory-lock races during DB init
      //   • Saves ~60–90 s of startup time in CI
      //   • Safe for test environments (no scheduled jobs needed)
      //
      // Snapshot hit: no --init (database already exists + modules installed).
      // Snapshot miss: --init base creates the database structure.
      const odooCommand = snapshotHit
        ? ['--database', this.options.database, '--without-demo', 'all', '--max-cron-threads', '0']
        : [
            '--database',
            this.options.database,
            '--init',
            'base',
            '--without-demo',
            'all',
            '--max-cron-threads',
            '0',
          ];

      let odooContainer = new GenericContainer(`odoo:${odooVer}`)
        .withNetwork(network)
        .withEnvironment({
          HOST: 'db',
          PORT: '5432',
          USER: pgUser,
          PASSWORD: pgPassword,
          ...this.options.env,
        })
        .withCommand(odooCommand)
        .withExposedPorts(8069)
        .withWaitStrategy(
          // /web/health fires as soon as the HTTP listener binds (before
          // the ORM is ready). waitForOdooReady() then probes
          // /web/session/authenticate until auth succeeds.
          Wait.forHttp('/web/health', 8069)
            .forStatusCode(200)
            .withStartupTimeout(this.options.startupTimeout)
        );

      // Mount custom addons if specified
      if (this.options.addonsPath) {
        const { bindMounts, addonsPaths } = this.prepareAddonMounts(this.options.addonsPath);

        odooContainer = odooContainer.withBindMounts(bindMounts);

        // Tell Odoo where to find all the addons
        const allAddonsPaths = [
          '/usr/lib/python3/dist-packages/odoo/addons', // Core Odoo addons
          ...addonsPaths, // Custom addon paths
        ].join(',');

        odooContainer = odooContainer.withEnvironment({
          ...this.options.env,
          ADDONS_PATH: allAddonsPaths,
        });
      }

      const startedOdooContainer = await odooContainer.start();
      startedContainers.push(startedOdooContainer);
      const url = `http://${startedOdooContainer.getHost()}:${startedOdooContainer.getMappedPort(8069)}`;

      console.log(`✅ Odoo ready at ${url}`);

      // Wait for ORM/session to be ready (not just HTTP listener)
      await this.waitForOdooReady(url, this.options.database);

      // Create authenticated client
      const client = new OdooClient({
        url,
        database: this.options.database,
        username: 'admin',
        password: this.options.adminPassword,
      });

      await client.authenticate();
      console.log('✅ Authenticated with Odoo');

      const moduleManager = new ModuleManager(client);

      // ── Module installation ───────────────────────────────────────────
      if (!snapshotHit && this.options.modules.length > 0) {
        await this.installModules(moduleManager, this.options.modules);
      } else if (snapshotHit) {
        console.log('✅ All requested modules already present in snapshot');
      }

      if (!snapshotHit && snapshot.enabled) {
        await saveSnapshot(postgresContainer, snapshot, this.options.database, pgUser);
        console.log(`✅ Saved Odoo database snapshot ${snapshot.key}`);
      }

      return {
        odooContainer: startedOdooContainer,
        postgresContainer,
        client,
        moduleManager,
        url,
        database: this.options.database,
        cleanup: async () => {
          console.log('🧹 Cleaning up Odoo testcontainer...');
          client.logout();
          // Stop containers first (parallel, settle all)
          await Promise.allSettled([startedOdooContainer.stop(), postgresContainer.stop()]);
          // Force-disconnect any remaining endpoints (containers may not fully
          // disconnect from the network before .stop() resolves)
          await forceDisconnectNetwork(network.getId());
          // Network cleanup with retry
          try {
            await network.stop();
          } catch {
            try {
              await network.stop();
            } catch {
              /* best-effort */
            }
          }
          console.log('✅ Cleanup complete');
        },
      };
    } catch (error) {
      // Stop containers before network to avoid "active endpoints" error
      await Promise.allSettled(startedContainers.map((c) => c.stop()));
      // Force-disconnect any remaining endpoints, including orphan containers
      // (e.g. a half-started Odoo container not yet in startedContainers[])
      await forceDisconnectNetwork(network.getId());
      try {
        await network.stop();
      } catch {
        try {
          await network.stop();
        } catch {
          /* best-effort */
        }
      }
      throw error;
    }
  }

  // ── Addon helpers ─────────────────────────────────────────────────────

  /**
   * Prepare addon mounts from various input formats.
   */
  private prepareAddonMounts(addonsPath: string | AddonsMount[]): {
    bindMounts: Array<{ source: string; target: string }>;
    addonsPaths: string[];
  } {
    const bindMounts: Array<{ source: string; target: string }> = [];
    const addonsPaths: string[] = [];

    if (typeof addonsPath === 'string') {
      // Simple string path
      const target = '/mnt/extra-addons';
      bindMounts.push({
        source: addonsPath,
        target,
      });
      addonsPaths.push(target);
    } else {
      // Array of AddonsMount objects
      addonsPath.forEach((mount, index) => {
        const target = mount.target || `/mnt/addons-${index}`;
        bindMounts.push({
          source: mount.source,
          target,
        });
        addonsPaths.push(target);
      });
    }

    return { bindMounts, addonsPaths };
  }

  // ── Readiness helpers ─────────────────────────────────────────────────

  /**
   * Wait for Odoo's ORM/session layer to be ready.
   *
   * /web/health returns 200 as soon as the HTTP listener binds, but the
   * ORM and session handler (/web/session/authenticate) may not be ready
   * for several more seconds. Polling authenticate — the same endpoint
   * that clients will use immediately after startup — ensures the server
   * is truly ready before we hand it to the test.
   */
  private async waitForOdooReady(url: string, database: string, maxAttempts = 30): Promise<void> {
    const authPayload = JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { db: database, login: 'admin', password: this.options.adminPassword },
    });

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`${url}/web/session/authenticate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: authPayload,
        });

        if (response.ok) {
          // Odoo returns HTTP 200 even before the DB exists, with uid=false.
          // Only proceed when uid is a positive integer (auth succeeded).
          const data = (await response.json()) as { result?: { uid?: number | false } };
          if (data.result?.uid) {
            console.log(`✅ Odoo session handler ready (attempt ${i + 1})`);
            return;
          }
        }
      } catch {
        // not ready yet — swallow and retry
      }

      console.log(`⏳ Waiting for Odoo session handler... (attempt ${i + 1}/${maxAttempts})`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error('Odoo session handler did not become ready within timeout');
  }

  // ── Module installation ───────────────────────────────────────────────

  /**
   * Install modules with dependency resolution.
   */
  private async installModules(moduleManager: ModuleManager, modules: string[]): Promise<void> {
    console.log(`📦 Installing Odoo modules: ${modules.join(', ')}`);

    for (const module of modules) {
      if (!(await moduleManager.isModuleInstalled(module))) {
        console.log(`📦 Installing ${module}...`);
        await moduleManager.installModule(module);
        console.log(`✅ ${module} installed`);
      } else {
        console.log(`✅ ${module} already installed`);
      }
    }
  }
}
