import {
  SkillDefinition,
  SkillLevel,
  SkillCategory,
  SkillRegistry,
} from './types';

// Import all skills
import {
  connectSkill,
  introspectSkill,
  searchFieldsSkill,
  searchTranslationsSkill,
  exploreModulesSkill,
} from './definitions/elementary';

import { createLeadSkill, searchPartnersSkill } from './definitions/user';

import { installModuleSkill, managePropertiesSkill } from './definitions/admin';

/**
 * All registered skills organized by level
 */
const allSkills: SkillDefinition[] = [
  // Elementary
  connectSkill,
  introspectSkill,
  searchFieldsSkill,
  searchTranslationsSkill,
  exploreModulesSkill,

  // User
  createLeadSkill,
  searchPartnersSkill,

  // Admin
  installModuleSkill,
  managePropertiesSkill,
];

/**
 * Create a skill registry implementation
 */
function createRegistry(skills: SkillDefinition[]): SkillRegistry {
  const skillMap = new Map<string, SkillDefinition>();
  skills.forEach((s) => skillMap.set(s.id, s));

  return {
    skills,

    get(id: string): SkillDefinition | undefined {
      return skillMap.get(id);
    },

    getByLevel(level: SkillLevel): SkillDefinition[] {
      return skills.filter((s) => s.level === level);
    },

    getByCategory(category: SkillCategory): SkillDefinition[] {
      return skills.filter((s) => s.category === category);
    },
  };
}

/**
 * Global skill registry instance
 */
export const skillRegistry = createRegistry(allSkills);

/**
 * Get skills grouped by level
 */
export function getSkillsByLevel(): Record<SkillLevel, SkillDefinition[]> {
  return {
    elementary: skillRegistry.getByLevel('elementary'),
    user: skillRegistry.getByLevel('user'),
    admin: skillRegistry.getByLevel('admin'),
  };
}

/**
 * Get all skill IDs
 */
export function getAllSkillIds(): string[] {
  return skillRegistry.skills.map((s) => s.id);
}
