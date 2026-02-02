/**
 * SKILL.md format validator
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate SKILL.md content
 */
export function validateSkillMd(content: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for skill header (# /something)
  const headerMatch = content.match(/^#\s+\/\S+/m);
  if (!headerMatch) {
    errors.push('Missing skill header (e.g., # /odoo)');
  }

  // Check for Prerequisites section
  if (!content.includes('## Prerequisites') && !content.includes('## Prerequisites (Must Read First)')) {
    warnings.push('Missing Prerequisites section');
  }

  // Check for modules/base references
  const hasBaseReferences = content.includes('base/') || content.includes('`base/');
  if (!hasBaseReferences) {
    warnings.push('No references to base/ modules found');
  }

  // Check for Quick Start section
  if (!content.includes('## Quick Start')) {
    warnings.push('Missing Quick Start section');
  }

  // Check for markdown structure (at least some headers)
  const headerCount = (content.match(/^##\s+/gm) || []).length;
  if (headerCount < 2) {
    warnings.push('Very few sections found (expected at least 2 ## headers)');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a skill module file (base/*.md or skills/*.md)
 */
export function validateModule(content: string, filename: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for title
  const titleMatch = content.match(/^#\s+.+/m);
  if (!titleMatch) {
    errors.push('Missing title (# header)');
  }

  // Check for some content
  if (content.trim().length < 100) {
    warnings.push('Module content seems very short');
  }

  // Check for code examples in pattern/skill files
  const hasCodeBlocks = content.includes('```');
  if (!hasCodeBlocks && !filename.includes('skill-generation')) {
    warnings.push('No code examples found');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
