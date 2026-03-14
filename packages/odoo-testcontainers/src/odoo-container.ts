/**
 * Custom Testcontainer module for Odoo development.
 *
 * Provides high-level API for starting Odoo with specific modules,
 * custom addons, and proper cleanup.
 */

import { GenericContainer, StartedTestContainer, Wait, Network } from 'testcontainers';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { OdooClient, ModuleManager } from '@marcfargas/odoo-client';
import { resolveSeedInfo, normaliseOdooVersion } from './seed-resolver';

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
  private options: Required<Omit<OdooTestContainerOptions, 'addonsPath' | 'env'>> & {
    addonsPath?: string | AddonsMount[];
    env: Record<string, string>;
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
   * When ODOO_SEED_IMAGE is set and the seed covers all requested modules,
   * uses the pre-seeded Postgres image for ~15s startup instead of ~3min.
   */
  async start(): Promise<StartedOdooContainer> {
    const odooVer = normaliseOdooVersion(process.env.ODOO_VERSION);
    const seedInfo = resolveSeedInfo(this.options.modules, odooVer);

    if (seedInfo) {
      console.log(
        `🌱 Starting Odoo testcontainer with pre-seeded image: ${seedInfo.seedImage}\n` +
          `   Modules: ${this.options.modules.join(', ') || '(all seeded)'}`
      );
    } else {
      // If ODOO_SEED_IMAGE was set but we're not using it, log why
      if (process.env.ODOO_SEED_IMAGE) {
        console.log(
          `⚠️  ODOO_SEED_IMAGE set but seed not usable for [${this.options.modules.join(', ')}] — cold start`
        );
      }
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
      let postgresContainer: StartedPostgreSqlContainer | StartedTestContainer;
      let pgUser: string;
      let pgPassword: string;

      if (seedInfo) {
        // SEED HIT — pre-seeded image: pg_restore runs via initdb.d (~15s).
        //
        // IMPORTANT wait strategy: the SECOND "ready for start up." log line
        // fires AFTER pg_restore completes. The first fires before restore.
        // Waiting for this exact message is critical for a consistent DB state.
        //
        // SEED_DB_NAME tells seed-db-init.sh what database name to create,
        // matching this container's configured database option.
        postgresContainer = await new GenericContainer(seedInfo.seedImage)
          .withNetwork(network)
          .withNetworkAliases('db')
          .withExposedPorts(5432)
          .withEnvironment({ SEED_DB_NAME: this.options.database })
          .withWaitStrategy(
            Wait.forLogMessage(
              'PostgreSQL init process complete; ready for start up.'
            ).withStartupTimeout(90_000)
          )
          .start();

        // Seed image is built with admin/admin (see docker/Dockerfile.seed-db)
        pgUser = 'admin';
        pgPassword = 'admin';
        startedContainers.push(postgresContainer);
        console.log(
          `✅ Seed PostgreSQL ready (${this.options.database} restored from dump) ` +
            `on port ${postgresContainer.getMappedPort(5432)}`
        );
      } else {
        // COLD START — fresh Postgres, Odoo will --init the database.
        postgresContainer = await new PostgreSqlContainer('postgres:15-alpine')
          .withDatabase(this.options.database)
          .withUsername('odoo')
          .withPassword('odoo')
          .withNetwork(network)
          .withNetworkAliases('db')
          .start();

        pgUser = 'odoo';
        pgPassword = 'odoo';
        startedContainers.push(postgresContainer);
        console.log(
          `✅ PostgreSQL ready at ` +
            `${postgresContainer.getHost()}:${postgresContainer.getMappedPort(5432)}`
        );
      }

      // ── Odoo ──────────────────────────────────────────────────────────
      //
      // --max-cron-threads 0 disables the cron scheduler:
      //   • Eliminates ir_cron advisory-lock races during DB init
      //   • Saves ~60–90 s of startup time in CI
      //   • Safe for test environments (no scheduled jobs needed)
      //
      // Seed path: no --init (database already exists + modules installed)
      // Cold-start path: --init base to create the database structure
      const odooCommand = seedInfo
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
      //
      // Seed hit: seed already has seedInfo.seedModules installed.
      //   Install only the EXTRA modules requested but not in the seed.
      // Cold start: install all requested modules.
      const modulesToInstall = seedInfo
        ? this.options.modules.filter((m) => !seedInfo.seedModules.includes(m))
        : this.options.modules;

      if (modulesToInstall.length > 0) {
        await this.installModules(moduleManager, modulesToInstall);
      } else if (seedInfo) {
        console.log('✅ All requested modules already present in seed');
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
          // Give Docker a moment to release network endpoints
          await new Promise((r) => setTimeout(r, 1000));
          // Network cleanup with retry
          try {
            await network.stop();
          } catch {
            await new Promise((r) => setTimeout(r, 2000));
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
      await new Promise((r) => setTimeout(r, 1000));
      try {
        await network.stop();
      } catch {
        await new Promise((r) => setTimeout(r, 2000));
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
