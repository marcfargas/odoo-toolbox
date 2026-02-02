/**
 * SKILL Type Definitions
 *
 * These types define the structure for Odoo SKILLs that help AI agents
 * interact with Odoo instances. SKILLs are defined as TypeScript objects
 * and generated as Markdown files for Claude Code consumption.
 */

/**
 * SKILL access level determines who should use this command
 */
export type SkillLevel = 'elementary' | 'user' | 'admin';

/**
 * SKILL category for organization
 */
export type SkillCategory =
  | 'connection' // Connecting to Odoo
  | 'introspection' // Schema discovery
  | 'crm' // CRM operations (leads, opportunities)
  | 'sales' // Sales operations (quotations, orders)
  | 'inventory' // Stock and warehouse
  | 'project' // Project management
  | 'contacts' // Partner/contact management
  | 'properties' // Dynamic properties fields
  | 'modules' // Module management
  | 'configuration'; // System configuration

/**
 * A parameter that the SKILL accepts
 */
export interface SkillParameter {
  /** Parameter name (used in code) */
  name: string;

  /** Parameter type */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';

  /** Human-readable description */
  description: string;

  /** Whether this parameter is required */
  required: boolean;

  /** Default value if not provided */
  default?: unknown;

  /** Example value for documentation */
  example?: unknown;
}

/**
 * Odoo module dependency
 */
export interface ModuleDependency {
  /** Technical module name (e.g., 'crm') */
  name: string;

  /** Human-readable name (e.g., 'CRM') */
  displayName: string;

  /** Hard requirement vs optional enhancement */
  required: boolean;
}

/**
 * Code example embedded in the SKILL
 */
export interface SkillExample {
  /** Example title */
  title: string;

  /** Brief description of what this example demonstrates */
  description: string;

  /** Inline TypeScript code for this example */
  code: string;

  /** Whether this example has an integration test */
  tested: boolean;
}

/**
 * Main SKILL definition
 */
export interface SkillDefinition {
  /** Unique identifier, becomes the command name (e.g., 'odoo-create-lead') */
  id: string;

  /** Short name for display (e.g., 'create-lead') */
  shortName: string;

  /** Human-readable title */
  title: string;

  /** Brief description (shown in command list) */
  summary: string;

  /** Detailed description with key concepts (Markdown supported) */
  description: string;

  /** Access level */
  level: SkillLevel;

  /** Category for organization */
  category: SkillCategory;

  /** Parameters the SKILL accepts */
  parameters: SkillParameter[];

  /** Odoo modules this SKILL requires/uses */
  moduleDependencies: ModuleDependency[];

  /** Models this SKILL interacts with */
  odooModels: string[];

  /** Code examples */
  examples: SkillExample[];

  /** Related SKILLs by ID */
  relatedSkills: string[];

  /** Odoo source code references (GitHub URLs) */
  odooReferences: string[];

  /** Tags for search/filtering */
  tags: string[];
}

/**
 * Registry of all available SKILLs
 */
export interface SkillRegistry {
  /** All registered SKILLs */
  skills: SkillDefinition[];

  /** Get SKILL by ID */
  get(id: string): SkillDefinition | undefined;

  /** Get all SKILLs by level */
  getByLevel(level: SkillLevel): SkillDefinition[];

  /** Get all SKILLs by category */
  getByCategory(category: SkillCategory): SkillDefinition[];
}
