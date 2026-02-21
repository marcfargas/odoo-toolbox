/**
 * @marcfargas/odoo-test-harness
 *
 * Declarative test setup for Odoo — spin up containers with specific data shapes.
 *
 * @example
 * ```typescript
 * import { TestHarness } from '@marcfargas/odoo-test-harness';
 *
 * const harness = await TestHarness.start({
 *   modules: ['project', 'hr_timesheet'],
 *   projects: [
 *     {
 *       name: 'Project Alpha',
 *       stages: ['Backlog', 'In Progress', 'Done'],
 *       tasks: [
 *         { name: 'Setup environment', stage: 'Done' },
 *         { name: 'Implement feature', stage: 'In Progress' },
 *       ],
 *     },
 *   ],
 *   partners: [
 *     { name: 'Acme Corp', isCompany: true, category: 'Customer' },
 *     { name: 'John Doe', email: 'john@acme.com', parentName: 'Acme Corp' },
 *   ],
 *   partnerCategories: ['Customer', 'Vendor'],
 * });
 *
 * const client = harness.client;
 * const projectId = harness.refs.projects['Project Alpha'];
 *
 * await harness.stop();
 * ```
 */

// Main class
export { TestHarness } from './harness';

// Types
export type {
  TestHarnessConfig,
  ProjectConfig,
  TaskConfig,
  PartnerConfig,
  PropertyConfig,
  UserConfig,
  ProvisionedRefs,
} from './types';

// Individual provisioners (for advanced / custom use)
export {
  provisionModules,
  provisionPartnerCategories,
  provisionPartners,
  provisionProjects,
  provisionTaskProperties,
  provisionUsers,
} from './provisioners';
export type { ProjectProvisionResult } from './provisioners';
