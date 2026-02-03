/**
 * Tests for MCP resource handlers (skills).
 */

import { describe, it, expect } from 'vitest';
import {
  discoverSkillResources,
  readSkillContent,
  registerResources,
} from '../src/resources/index';

describe('Skill Resources', () => {
  describe('discoverSkillResources', () => {
    it('discovers all skill files', () => {
      const resources = discoverSkillResources();

      expect(resources.length).toBeGreaterThan(0);
      expect(resources.length).toBe(13); // 9 base + 3 mail + 1 oca-modules
    });

    it('includes all expected categories', () => {
      const resources = discoverSkillResources();
      const categories = [...new Set(resources.map((r) => r.category))];

      expect(categories).toContain('base');
      expect(categories).toContain('mail');
      expect(categories).toContain('oca-modules');
    });

    it('uses correct URI format', () => {
      const resources = discoverSkillResources();

      for (const resource of resources) {
        expect(resource.uri).toMatch(/^skill:\/\/[^/]+\/.+\.md$/);
      }

      // Check specific examples
      const connectionSkill = resources.find((r) => r.name === 'connection.md');
      expect(connectionSkill?.uri).toBe('skill://base/connection.md');

      const chatterSkill = resources.find((r) => r.name === 'chatter.md');
      expect(chatterSkill?.uri).toBe('skill://mail/chatter.md');
    });

    it('includes descriptions for all skills', () => {
      const resources = discoverSkillResources();

      for (const resource of resources) {
        expect(resource.description).toBeTruthy();
        expect(typeof resource.description).toBe('string');
      }
    });

    it('includes all expected base skills', () => {
      const resources = discoverSkillResources();
      const baseSkillNames = resources.filter((r) => r.category === 'base').map((r) => r.name);

      expect(baseSkillNames).toContain('connection.md');
      expect(baseSkillNames).toContain('crud.md');
      expect(baseSkillNames).toContain('domains.md');
      expect(baseSkillNames).toContain('field-types.md');
      expect(baseSkillNames).toContain('introspection.md');
      expect(baseSkillNames).toContain('modules.md');
      expect(baseSkillNames).toContain('properties.md');
      expect(baseSkillNames).toContain('search.md');
      expect(baseSkillNames).toContain('skill-generation.md');
    });

    it('includes all expected mail skills', () => {
      const resources = discoverSkillResources();
      const mailSkillNames = resources.filter((r) => r.category === 'mail').map((r) => r.name);

      expect(mailSkillNames).toContain('activities.md');
      expect(mailSkillNames).toContain('chatter.md');
      expect(mailSkillNames).toContain('discuss.md');
    });

    it('includes all expected oca-modules skills', () => {
      const resources = discoverSkillResources();
      const ocaSkillNames = resources
        .filter((r) => r.category === 'oca-modules')
        .map((r) => r.name);

      expect(ocaSkillNames).toContain('mis-builder.md');
    });
  });

  describe('readSkillContent', () => {
    it('reads valid skill content', () => {
      const content = readSkillContent('skill://base/connection.md');

      expect(content).not.toBeNull();
      expect(content).toContain('# Connecting to Odoo');
    });

    it('reads mail skill content', () => {
      const content = readSkillContent('skill://mail/chatter.md');

      expect(content).not.toBeNull();
      expect(typeof content).toBe('string');
      expect(content!.length).toBeGreaterThan(0);
    });

    it('returns null for invalid URI format', () => {
      const content = readSkillContent('invalid-uri');

      expect(content).toBeNull();
    });

    it('returns null for non-existent skill', () => {
      const content = readSkillContent('skill://base/nonexistent.md');

      expect(content).toBeNull();
    });

    it('returns null for invalid category', () => {
      const content = readSkillContent('skill://invalid/connection.md');

      expect(content).toBeNull();
    });

    it('prevents path traversal attacks', () => {
      const content = readSkillContent('skill://base/../../../etc/passwd');

      expect(content).toBeNull();
    });
  });

  describe('registerResources', () => {
    it('exports registerResources function', () => {
      expect(typeof registerResources).toBe('function');
    });
  });
});
