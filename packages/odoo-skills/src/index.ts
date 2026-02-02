/**
 * @odoo-toolbox/skills
 *
 * Claude Code SKILLs for AI agents to interact with Odoo.
 *
 * This package provides:
 * - SKILL definitions for common Odoo operations
 * - Markdown generator for Claude Code commands
 * - Test runner for validating SKILL examples
 */

// Types
export * from './types';

// SKILL Definitions
export * from './definitions';

// Generator
export * from './generator';

// Registry
export { skillRegistry } from './registry';
