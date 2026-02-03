import * as fs from 'fs';
import * as path from 'path';

export interface SkillResource {
  uri: string;
  name: string;
  description: string;
  category: string;
  filePath: string;
}

const SKILL_CATEGORIES = ['base', 'mail', 'oca-modules'] as const;

const SKILL_DESCRIPTIONS: Record<string, Record<string, string>> = {
  base: {
    connection: 'How to authenticate and connect to Odoo',
    crud: 'Create, Read, Update, Delete operations',
    domains: 'Odoo domain filter syntax',
    'field-types': 'Understanding Odoo field types and read/write asymmetry',
    introspection: 'Discovering models and fields',
    modules: 'Module management operations',
    properties: 'Working with dynamic properties fields',
    search: 'Search and filtering records',
    'skill-generation': 'How to generate new skills',
  },
  mail: {
    activities: 'Managing Odoo activities',
    chatter: 'Working with messages and chatter',
    discuss: 'Odoo Discuss integration',
  },
  'oca-modules': {
    'mis-builder': 'OCA MIS Builder for financial reports',
  },
};

/**
 * Get the skills directory path.
 * Skills are located at dist/skills/ in the package.
 * Handles both production (running from dist/) and development (running from src/ via vitest).
 */
function getSkillsDir(): string {
  // Check if we're in dist/ or src/
  if (__dirname.includes('dist')) {
    // Production: running from dist/resources/
    return path.resolve(__dirname, '..', 'skills');
  } else {
    // Development/testing: running from src/resources/, skills are in dist/
    return path.resolve(__dirname, '..', '..', 'dist', 'skills');
  }
}

/**
 * Discover all available skill resources by scanning the skills directory.
 */
export function discoverSkillResources(): SkillResource[] {
  const skillsDir = getSkillsDir();
  const resources: SkillResource[] = [];

  for (const category of SKILL_CATEGORIES) {
    const categoryDir = path.join(skillsDir, category);

    if (!fs.existsSync(categoryDir)) {
      continue;
    }

    const files = fs.readdirSync(categoryDir).filter((f) => f.endsWith('.md'));

    for (const file of files) {
      const name = path.basename(file, '.md');
      resources.push({
        uri: `skill://${category}/${file}`,
        name: file,
        description: SKILL_DESCRIPTIONS[category]?.[name] || `Skill documentation for ${name}`,
        category,
        filePath: path.join(categoryDir, file),
      });
    }
  }

  return resources;
}

/**
 * Read the content of a skill file by its URI.
 * @param uri - The skill URI (e.g., "skill://base/connection.md")
 * @returns The file content, or null if not found
 */
export function readSkillContent(uri: string): string | null {
  const match = uri.match(/^skill:\/\/([^/]+)\/(.+)$/);
  if (!match) {
    return null;
  }

  const [, category, filename] = match;

  // Validate category
  if (!SKILL_CATEGORIES.includes(category as (typeof SKILL_CATEGORIES)[number])) {
    return null;
  }

  const skillsDir = getSkillsDir();
  const filePath = path.join(skillsDir, category, filename);

  // Security: ensure we're not escaping the skills directory
  const resolvedPath = path.resolve(filePath);
  const resolvedSkillsDir = path.resolve(skillsDir);
  if (!resolvedPath.startsWith(resolvedSkillsDir)) {
    return null;
  }

  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, 'utf-8');
}
