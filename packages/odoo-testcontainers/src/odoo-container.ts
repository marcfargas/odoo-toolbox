/**
 * Custom Testcontainer module for Odoo development.
 *
 * Provides high-level API for starting Odoo with specific modules,
 * custom addons, and proper cleanup.
 */

import { GenericContainer, StartedTestContainer, Wait, Network } from 'testcontainers';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { OdooClient, ModuleManager } from '@marcfargas/odoo-client';

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
  postgresContainer: StartedPostgreSqlContainer;
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
      startupTimeout: 180_000,
      env: {},
      ...options,
    };
  }

  /**
   * Start Odoo container with PostgreSQL and install requested modules.
   */
  async start(): Promise<StartedOdooContainer> {
    console.log(`🚀 Starting Odoo testcontainer with modules: ${this.options.modules.join(', ')}`);

    // Create a network for container communication
    const network = await new Network().start();

    try {
      // Start PostgreSQL
      const postgresContainer = await new PostgreSqlContainer('postgres:15-alpine')
        .withDatabase(this.options.database)
        .withUsername('odoo')
        .withPassword('odoo')
        .withNetwork(network)
        .withNetworkAliases('db')
        .start();

      console.log(
        `✅ PostgreSQL ready at ${postgresContainer.getHost()}:${postgresContainer.getMappedPort(5432)}`
      );

      // Start Odoo container
      let odooContainer = new GenericContainer('odoo:17.0')
        .withNetwork(network)
        .withEnvironment({
          HOST: 'db',
          PORT: '5432',
          USER: 'odoo',
          PASSWORD: 'odoo',
          ...this.options.env,
        })
        .withExposedPorts(8069)
        .withWaitStrategy(
          Wait.forAll([
            Wait.forHttp('/web/database/selector', 8069).forStatusCode(200),
            Wait.forLogMessage('HTTP service (werkzeug) running on'),
          ]).withStartupTimeout(this.options.startupTimeout)
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
      const url = `http://${startedOdooContainer.getHost()}:${startedOdooContainer.getMappedPort(8069)}`;

      console.log(`✅ Odoo ready at ${url}`);

      // Wait for services to stabilize
      await this.waitForOdooReady(url);

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

      // Install requested modules
      if (this.options.modules.length > 0) {
        await this.installModules(moduleManager, this.options.modules);
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
      try {
        await network.stop();
      } catch {
        /* best-effort */
      }
      throw error;
    }
  }

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

  /**
   * Wait for Odoo to be fully ready (not just responding to HTTP).
   */
  private async waitForOdooReady(url: string, maxAttempts = 30): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`${url}/web/database/list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });

        if (response.ok) {
          const data: any = await response.json();
          if (data.result && Array.isArray(data.result)) {
            console.log(`✅ Odoo database service ready (attempt ${i + 1})`);
            return;
          }
        }
      } catch (error) {
        // Continue waiting
      }

      console.log(`⏳ Waiting for Odoo database service... (attempt ${i + 1}/${maxAttempts})`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error('Odoo did not become ready within timeout');
  }

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
