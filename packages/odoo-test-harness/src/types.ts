/**
 * Type definitions for @marcfargas/odoo-test-harness.
 */

/**
 * Top-level declarative configuration for a test Odoo instance.
 */
export interface TestHarnessConfig {
  /** Odoo modules to install before provisioning (e.g., ['project', 'hr_timesheet']) */
  modules?: string[];
  /** Projects to create, with optional stages and tasks */
  projects?: ProjectConfig[];
  /** Partners (companies and contacts) to create */
  partners?: PartnerConfig[];
  /** Partner category names to create (must exist before partners reference them) */
  partnerCategories?: string[];
  /** Task property definitions to add to all provisioned projects */
  taskProperties?: PropertyConfig[];
  /** Test users to create */
  users?: UserConfig[];
}

/**
 * Configuration for a project to be provisioned.
 */
export interface ProjectConfig {
  /** Project display name */
  name: string;
  /** Stage names in order (e.g., ['Backlog', 'In Progress', 'Done']) */
  stages?: string[];
  /** Tasks to create inside this project */
  tasks?: TaskConfig[];
}

/**
 * Configuration for a task to be provisioned inside a project.
 */
export interface TaskConfig {
  /** Task display name */
  name: string;
  /** Stage name (must be in the parent project's stages list) */
  stage?: string;
}

/**
 * Configuration for a partner (company or contact) to be provisioned.
 */
export interface PartnerConfig {
  /** Partner display name */
  name: string;
  /** Whether this partner is a company (default: false) */
  isCompany?: boolean;
  /** Contact email address */
  email?: string;
  /** Partner category name — must match an entry in partnerCategories */
  category?: string;
  /** Parent company name — must match another PartnerConfig.name where isCompany=true */
  parentName?: string;
}

/**
 * Configuration for a property field definition.
 * Applied to task_properties_definition on all provisioned projects.
 */
export interface PropertyConfig {
  /** Display label for the property */
  name: string;
  /** Field type */
  type: 'char' | 'integer' | 'float' | 'boolean' | 'selection' | 'date' | 'datetime';
  /** Selection options (only for type 'selection') */
  options?: string[];
}

/**
 * Configuration for a test user to be provisioned.
 */
export interface UserConfig {
  /** Full display name */
  name: string;
  /** Login email / username */
  login: string;
  /** Group XML IDs to assign (e.g., ['project.group_project_manager']) */
  groups?: string[];
}

/**
 * Maps record names to their Odoo database IDs.
 * Returned by TestHarness so tests can reference provisioned records.
 */
export interface ProvisionedRefs {
  /** project.name → project.project ID */
  projects: Record<string, number>;
  /** partner.name → res.partner ID */
  partners: Record<string, number>;
  /** category name → res.partner.category ID */
  partnerCategories: Record<string, number>;
  /** task.name → project.task ID */
  tasks: Record<string, number>;
  /** user.name → res.users ID */
  users: Record<string, number>;
}

/**
 * Minimal client interface required by all provisioners.
 *
 * Defines only the OdooClient methods that the test-harness provisioners
 * actually call. This avoids a hard dependency on a specific OdooClient version
 * and prevents type mismatches when odoo-testcontainers pins an older release
 * (different installed path → different nominal type despite same API shape).
 *
 * The full OdooClient from @marcfargas/odoo-client satisfies this interface.
 */
export interface ProvisionerClient {
  create(
    model: string,
    values: Record<string, any>,
    context?: Record<string, any>
  ): Promise<number>;
  search(model: string, domain?: any[], options?: Record<string, any>): Promise<number[]>;
  searchRead<T extends Record<string, any> = Record<string, any>>(
    model: string,
    domain?: any[],
    options?: { fields?: string[]; offset?: number; limit?: number; order?: string }
  ): Promise<T[]>;
  write(
    model: string,
    ids: number | number[],
    values: Record<string, any>,
    context?: Record<string, any>
  ): Promise<boolean>;
  modules: {
    isModuleInstalled(name: string): Promise<boolean>;
    installModule(name: string): Promise<void>;
  };
}
