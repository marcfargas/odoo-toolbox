/**
 * E2E Test: Skill Creator Workflow
 *
 * This test validates the CLI creates projects correctly:
 * 1. Use CLI to create a skills project
 * 2. Verify all files and modules are present (matching assets/)
 * 3. Run validation command
 * 4. Verify template content
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

describe('E2E: Skill Creator Workflow', () => {
  let tempWorkspace: string;
  let projectDir: string;

  const cliPath = path.resolve(__dirname, '..', 'dist', 'cli', 'cli.js');
  const assetsDir = path.resolve(__dirname, '..', 'assets');

  beforeAll(() => {
    // Create temp workspace
    tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'odoo-skills-test-'));
    projectDir = path.join(tempWorkspace, 'test-skills');
  });

  afterAll(() => {
    // Cleanup
    if (tempWorkspace && fs.existsSync(tempWorkspace)) {
      fs.rmSync(tempWorkspace, { recursive: true, force: true });
    }
  });

  describe('Step 1: Create skills project with CLI', () => {
    it('should create project with CLI', () => {
      // Run CLI to create project
      const result = execSync(`node "${cliPath}" test-skills --no-git`, {
        cwd: tempWorkspace,
        encoding: 'utf-8',
      });

      expect(result).toContain('Created project structure');
      expect(result).toContain('Installed base modules');
      expect(fs.existsSync(projectDir)).toBe(true);
    });

    it('should have all required files', () => {
      const requiredFiles = [
        'SKILL.md',
        'AGENTS.md',
        'README.md',
        'package.json',
        '.env.example',
        '.gitignore',
      ];

      for (const file of requiredFiles) {
        const filePath = path.join(projectDir, file);
        expect(fs.existsSync(filePath), `Missing: ${file}`).toBe(true);
      }
    });

    it('should have all base modules from assets', () => {
      const assetsBase = path.join(assetsDir, 'base');
      const projectBase = path.join(projectDir, 'base');

      expect(fs.existsSync(projectBase)).toBe(true);

      // Dynamically get modules from assets/base
      const assetModules = fs
        .readdirSync(assetsBase)
        .filter((f) => f.endsWith('.md'));

      expect(assetModules.length).toBeGreaterThan(0);

      for (const mod of assetModules) {
        const modPath = path.join(projectBase, mod);
        expect(fs.existsSync(modPath), `Missing: base/${mod}`).toBe(true);
      }
    });

    it('should have skills directory', () => {
      const skillsDir = path.join(projectDir, 'skills');
      expect(fs.existsSync(skillsDir)).toBe(true);
    });
  });

  describe('Step 2: Validate project with CLI', () => {
    it('should pass validation', () => {
      const result = execSync(`node "${cliPath}" validate`, {
        cwd: projectDir,
        encoding: 'utf-8',
      });

      expect(result).toContain('Validating skills');
      expect(result).toContain('valid');
      expect(result).not.toContain('Error');
    });
  });

  describe('Step 3: SKILL.md router content', () => {
    it('should have prerequisites section', () => {
      const skillMdPath = path.join(projectDir, 'SKILL.md');
      const content = fs.readFileSync(skillMdPath, 'utf-8');

      expect(content).toContain('Prerequisites');
      expect(content).toContain('connection.md');
      expect(content).toContain('field-types.md');
      expect(content).toContain('domains.md');
    });

    it('should list additional modules', () => {
      const skillMdPath = path.join(projectDir, 'SKILL.md');
      const content = fs.readFileSync(skillMdPath, 'utf-8');

      expect(content).toContain('introspection');
      expect(content).toContain('crud');
      expect(content).toContain('search');
      expect(content).toContain('properties');
      expect(content).toContain('modules');
    });

    it('should have project name substituted', () => {
      const skillMdPath = path.join(projectDir, 'SKILL.md');
      const content = fs.readFileSync(skillMdPath, 'utf-8');

      expect(content).toContain('test-skills');
      expect(content).not.toContain('{{PROJECT_NAME}}');
    });
  });

  describe('Step 4: Base module content', () => {
    it('connection.md should have connection patterns', () => {
      const connPath = path.join(projectDir, 'base', 'connection.md');
      const content = fs.readFileSync(connPath, 'utf-8');

      expect(content).toContain('OdooClient');
      expect(content).toContain('authenticate');
      expect(content).toContain('ODOO_URL');
    });

    it('field-types.md should document field types', () => {
      const ftPath = path.join(projectDir, 'base', 'field-types.md');
      const content = fs.readFileSync(ftPath, 'utf-8');

      expect(content).toContain('char');
      expect(content).toContain('many2one');
      expect(content).toContain('Read/Write');
    });

    it('domains.md should document domain syntax', () => {
      const domPath = path.join(projectDir, 'base', 'domains.md');
      const content = fs.readFileSync(domPath, 'utf-8');

      expect(content).toContain('=');
      expect(content).toContain('ilike');
      expect(content).toContain('search');
    });

    it('skill-generation.md should have workflow', () => {
      const sgPath = path.join(projectDir, 'base', 'skill-generation.md');
      const content = fs.readFileSync(sgPath, 'utf-8');

      expect(content).toContain('SKILL Format');
      expect(content).toContain('Step');
      expect(content).toContain('introspect');
    });
  });
});
