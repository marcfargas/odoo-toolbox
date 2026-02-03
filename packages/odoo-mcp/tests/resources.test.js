"use strict";
/**
 * Tests for MCP resource handlers (skills).
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const index_1 = require("../src/resources/index");
(0, vitest_1.describe)('Skill Resources', () => {
    (0, vitest_1.describe)('discoverSkillResources', () => {
        (0, vitest_1.it)('discovers all skill files', () => {
            const resources = (0, index_1.discoverSkillResources)();
            (0, vitest_1.expect)(resources.length).toBeGreaterThan(0);
            (0, vitest_1.expect)(resources.length).toBe(13); // 9 base + 3 mail + 1 oca-modules
        });
        (0, vitest_1.it)('includes all expected categories', () => {
            const resources = (0, index_1.discoverSkillResources)();
            const categories = [...new Set(resources.map((r) => r.category))];
            (0, vitest_1.expect)(categories).toContain('base');
            (0, vitest_1.expect)(categories).toContain('mail');
            (0, vitest_1.expect)(categories).toContain('oca-modules');
        });
        (0, vitest_1.it)('uses correct URI format', () => {
            const resources = (0, index_1.discoverSkillResources)();
            for (const resource of resources) {
                (0, vitest_1.expect)(resource.uri).toMatch(/^skill:\/\/[^/]+\/.+\.md$/);
            }
            // Check specific examples
            const connectionSkill = resources.find((r) => r.name === 'connection.md');
            (0, vitest_1.expect)(connectionSkill?.uri).toBe('skill://base/connection.md');
            const chatterSkill = resources.find((r) => r.name === 'chatter.md');
            (0, vitest_1.expect)(chatterSkill?.uri).toBe('skill://mail/chatter.md');
        });
        (0, vitest_1.it)('includes descriptions for all skills', () => {
            const resources = (0, index_1.discoverSkillResources)();
            for (const resource of resources) {
                (0, vitest_1.expect)(resource.description).toBeTruthy();
                (0, vitest_1.expect)(typeof resource.description).toBe('string');
            }
        });
        (0, vitest_1.it)('includes all expected base skills', () => {
            const resources = (0, index_1.discoverSkillResources)();
            const baseSkillNames = resources.filter((r) => r.category === 'base').map((r) => r.name);
            (0, vitest_1.expect)(baseSkillNames).toContain('connection.md');
            (0, vitest_1.expect)(baseSkillNames).toContain('crud.md');
            (0, vitest_1.expect)(baseSkillNames).toContain('domains.md');
            (0, vitest_1.expect)(baseSkillNames).toContain('field-types.md');
            (0, vitest_1.expect)(baseSkillNames).toContain('introspection.md');
            (0, vitest_1.expect)(baseSkillNames).toContain('modules.md');
            (0, vitest_1.expect)(baseSkillNames).toContain('properties.md');
            (0, vitest_1.expect)(baseSkillNames).toContain('search.md');
            (0, vitest_1.expect)(baseSkillNames).toContain('skill-generation.md');
        });
        (0, vitest_1.it)('includes all expected mail skills', () => {
            const resources = (0, index_1.discoverSkillResources)();
            const mailSkillNames = resources.filter((r) => r.category === 'mail').map((r) => r.name);
            (0, vitest_1.expect)(mailSkillNames).toContain('activities.md');
            (0, vitest_1.expect)(mailSkillNames).toContain('chatter.md');
            (0, vitest_1.expect)(mailSkillNames).toContain('discuss.md');
        });
        (0, vitest_1.it)('includes all expected oca-modules skills', () => {
            const resources = (0, index_1.discoverSkillResources)();
            const ocaSkillNames = resources
                .filter((r) => r.category === 'oca-modules')
                .map((r) => r.name);
            (0, vitest_1.expect)(ocaSkillNames).toContain('mis-builder.md');
        });
    });
    (0, vitest_1.describe)('readSkillContent', () => {
        (0, vitest_1.it)('reads valid skill content', () => {
            const content = (0, index_1.readSkillContent)('skill://base/connection.md');
            (0, vitest_1.expect)(content).not.toBeNull();
            (0, vitest_1.expect)(content).toContain('# Connecting to Odoo');
        });
        (0, vitest_1.it)('reads mail skill content', () => {
            const content = (0, index_1.readSkillContent)('skill://mail/chatter.md');
            (0, vitest_1.expect)(content).not.toBeNull();
            (0, vitest_1.expect)(typeof content).toBe('string');
            (0, vitest_1.expect)(content.length).toBeGreaterThan(0);
        });
        (0, vitest_1.it)('returns null for invalid URI format', () => {
            const content = (0, index_1.readSkillContent)('invalid-uri');
            (0, vitest_1.expect)(content).toBeNull();
        });
        (0, vitest_1.it)('returns null for non-existent skill', () => {
            const content = (0, index_1.readSkillContent)('skill://base/nonexistent.md');
            (0, vitest_1.expect)(content).toBeNull();
        });
        (0, vitest_1.it)('returns null for invalid category', () => {
            const content = (0, index_1.readSkillContent)('skill://invalid/connection.md');
            (0, vitest_1.expect)(content).toBeNull();
        });
        (0, vitest_1.it)('prevents path traversal attacks', () => {
            const content = (0, index_1.readSkillContent)('skill://base/../../../etc/passwd');
            (0, vitest_1.expect)(content).toBeNull();
        });
    });
    (0, vitest_1.describe)('registerResources', () => {
        (0, vitest_1.it)('exports registerResources function', () => {
            (0, vitest_1.expect)(typeof index_1.registerResources).toBe('function');
        });
    });
});
//# sourceMappingURL=resources.test.js.map