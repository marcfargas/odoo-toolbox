/**
 * TestHarness — declarative Odoo test environment.
 *
 * Combines odoo-testcontainers (container lifecycle) with purpose-built
 * provisioners to create a test Odoo instance with a specific data shape.
 *
 * Provisioning order (dependencies first):
 *   1. modules       — must exist before records that need them
 *   2. partnerCategories — must exist before partners reference them
 *   3. partners      — companies before contacts (parentName resolution)
 *   4. projects      — with stages and tasks
 *   5. taskProperties — applied to provisioned projects
 *   6. users         — last, may reference groups from installed modules
 *
 * @example
 * ```typescript
 * const harness = await TestHarness.start({
 *   modules: ['project'],
 *   projects: [{ name: 'Alpha', stages: ['Todo', 'Done'] }],
 * });
 * const client = harness.client;
 * const projectId = harness.refs.projects['Alpha'];
 * await harness.stop();
 * ```
 */

import debug from 'debug';
import { OdooTestContainer, type StartedOdooContainer } from '../odoo-container';
import type { TestHarnessConfig, ProvisionedRefs, ProvisionerClient } from './types';
import {
  provisionModules,
  provisionPartnerCategories,
  provisionPartners,
  provisionProjects,
  provisionTaskProperties,
  provisionUsers,
} from './index';

const log = debug('odoo-test-harness:harness');

/**
 * A running Odoo test environment with provisioned data.
 *
 * Obtain via `TestHarness.start(config)`. Clean up via `harness.stop()`.
 */
export class TestHarness {
  /**
   * Authenticated Odoo client — typed as ProvisionerClient (the minimal
   * interface we require). Cast to the full OdooClient from your own import
   * of @marcfargas/odoo-client if you need service accessors (client.mail, etc.).
   */
  readonly client: ProvisionerClient;

  /** Base URL of the running Odoo instance */
  readonly url: string;

  /** Maps provisioned record names to their Odoo IDs */
  readonly refs: ProvisionedRefs;

  private readonly container: StartedOdooContainer;

  private constructor(container: StartedOdooContainer, refs: ProvisionedRefs) {
    this.container = container;
    // Cast through unknown: container.client is OdooClient from a pinned version
    // inside odoo-testcontainers. At runtime it satisfies ProvisionerClient perfectly.
    this.client = container.client as unknown as ProvisionerClient;
    this.url = container.url;
    this.refs = refs;
  }

  /**
   * Start an Odoo container and provision it according to `config`.
   *
   * @param config - Declarative description of the test environment
   * @returns Ready-to-use TestHarness
   */
  static async start(config: TestHarnessConfig): Promise<TestHarness> {
    log('Starting TestHarness with config: %o', config);

    // 1. Start container (module list passed for early install via OdooTestContainer)
    const container = await new OdooTestContainer({
      modules: config.modules ?? [],
    }).start();

    log('Container started at %s', container.url);

    // Cast once — used for all provisioner calls below
    const client = container.client as unknown as ProvisionerClient;

    const refs: ProvisionedRefs = {
      projects: {},
      partners: {},
      partnerCategories: {},
      tasks: {},
      users: {},
    };

    try {
      // 2. Modules — already installed by OdooTestContainer, but run provisioner
      //    for any that were not handled (belt-and-suspenders / explicit logging)
      if (config.modules && config.modules.length > 0) {
        await provisionModules(client, config.modules);
      }

      // 3. Partner categories — must exist before partners reference them
      if (config.partnerCategories && config.partnerCategories.length > 0) {
        refs.partnerCategories = await provisionPartnerCategories(client, config.partnerCategories);
      }

      // 4. Partners — companies before contacts (parentName requires prior partner IDs)
      if (config.partners && config.partners.length > 0) {
        refs.partners = await provisionPartners(client, config.partners, refs.partnerCategories);
      }

      // 5. Projects (with stages and tasks)
      if (config.projects && config.projects.length > 0) {
        const projectResult = await provisionProjects(client, config.projects);
        refs.projects = projectResult.projects;
        refs.tasks = projectResult.tasks;
      }

      // 6. Task properties — applied to all provisioned projects
      if (config.taskProperties && config.taskProperties.length > 0) {
        await provisionTaskProperties(client, Object.values(refs.projects), config.taskProperties);
      }

      // 7. Users — last so module-provided groups are available
      if (config.users && config.users.length > 0) {
        refs.users = await provisionUsers(client, config.users);
      }
    } catch (err) {
      // If provisioning fails, clean up the container before re-throwing
      log('Provisioning failed — cleaning up container');
      await container.cleanup();
      throw err;
    }

    log('Provisioning complete. refs=%o', refs);
    return new TestHarness(container, refs);
  }

  /**
   * Stop the Odoo container and release all resources.
   */
  async stop(): Promise<void> {
    log('Stopping TestHarness');
    await this.container.cleanup();
    log('TestHarness stopped');
  }
}
