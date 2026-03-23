/**
 * @marcfargas/odoo-testcontainers
 *
 * Testcontainers module for Odoo development in Node.js.
 *
 * Features:
 * - Fresh containers for each test run (no shared state)
 * - Module auto-installation with dependency resolution
 * - High-level presets for common Odoo setups
 * - Custom addons support (mount local directories)
 * - Automatic cleanup after tests
 *
 * @example
 * ```typescript
 * import { startOdoo, OdooPresets } from '@marcfargas/odoo-testcontainers';
 *
 * // Simple usage with presets
 * const odoo = await OdooPresets.hr(); // HR + Attendance pre-installed
 * const client = odoo.client; // Ready-to-use authenticated client
 *
 * // Advanced usage
 * const odoo = await startOdoo({
 *   modules: ['hr_attendance', 'project', 'sale'],
 *   addonsPath: './my-custom-addons',
 *   database: 'test_db',
 * });
 *
 * // Always cleanup
 * afterAll(() => odoo.cleanup());
 * ```
 */

export {
  OdooTestContainer,
  type OdooTestContainerOptions,
  type StartedOdooContainer,
  type AddonsMount,
} from './odoo-container';

export { startOdoo, OdooPresets } from './presets';

export {
  readSeedConfig,
  resolveSeedInfo,
  normaliseOdooVersion,
  type SeedConfig,
  type SeedVersionConfig,
  type SeedInfo,
} from './seed-resolver';

// Provisioners — opt-in imports for test data setup
export * from './provisioners';
