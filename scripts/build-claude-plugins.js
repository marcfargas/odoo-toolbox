#!/usr/bin/env node
/**
 * Build Claude plugin artifacts for distribution.
 *
 * Assembles two plugins from repo sources:
 *   - dist-plugins/claude-odoo-connect/  (skills + MCP)
 *   - dist-plugins/claude-odoo-dev/      (skills + MCP + dev tools + agents)
 *
 * Shared skills from skills/odoo/ are copied into both plugins.
 * Plugin-specific files come from targets/claude-odoo-connect/ and targets/claude-odoo-dev/.
 *
 * Run: node scripts/build-claude-plugins.js
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist-plugins');
const SKILLS_SRC = path.join(ROOT, 'skills', 'odoo');

function buildPlugin(name) {
  const src = path.join(ROOT, 'targets', name);
  const out = path.join(DIST, name);

  // Clean output
  fs.rmSync(out, { recursive: true, force: true });

  // Copy plugin source (manifest, MCP config, README, dev-specific skills/agents)
  fs.cpSync(src, out, { recursive: true });

  // Copy shared Odoo skills into plugin's skills/odoo/ directory
  // These are the knowledge modules from the repo root
  const skillsDest = path.join(out, 'skills', 'odoo');
  fs.mkdirSync(skillsDest, { recursive: true });

  // Each skill subdirectory in skills/odoo/ becomes a skill in the plugin
  // We need to restructure: skills/odoo/base/*.md -> skills/odoo-base/SKILL.md etc.
  // Actually, the pi-package format has skills as flat .md files, but Claude plugins
  // need skills/<name>/SKILL.md structure. Let's create one skill per subdirectory
  // that bundles all the markdown files in that category as references.

  // Simpler approach: create a single "odoo-knowledge" skill that references all modules
  const knowledgeDir = path.join(out, 'skills', 'odoo-knowledge');
  fs.mkdirSync(path.join(knowledgeDir, 'references'), { recursive: true });

  // Copy all skill files as references
  copySkillsAsReferences(SKILLS_SRC, path.join(knowledgeDir, 'references'));

  // Generate the SKILL.md that indexes all knowledge modules
  const skillIndex = generateKnowledgeSkillMd(SKILLS_SRC);
  fs.writeFileSync(path.join(knowledgeDir, 'SKILL.md'), skillIndex);

  // Copy LICENSE from repo root
  const license = path.join(ROOT, 'LICENSE');
  if (fs.existsSync(license)) {
    fs.copyFileSync(license, path.join(out, 'LICENSE'));
  }

  console.log(`Built ${name} in dist-plugins/${name}/`);
}

function copySkillsAsReferences(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copySkillsAsReferences(srcPath, destPath);
    } else if (entry.name.endsWith('.md') && entry.name !== 'LICENSE' && entry.name !== 'SKILL.md') {
      // Skip SKILL.md (root pi-package router) and LICENSE — only copy knowledge modules
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function generateKnowledgeSkillMd(skillsDir) {
  // Discover all .md files organized by subdirectory
  const categories = {};
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const catPath = path.join(skillsDir, entry.name);
      const files = fs.readdirSync(catPath).filter((f) => f.endsWith('.md') && f !== 'LICENSE');
      if (files.length > 0) {
        categories[entry.name] = files;
      }
    } else if (entry.name === 'SKILL.md') {
      // Root SKILL.md — include as router reference
      categories['_root'] = [entry.name];
    }
  }

  let refs = '';
  for (const [cat, files] of Object.entries(categories).sort()) {
    if (cat === '_root') continue;
    const items = files.map((f) => `  - \`references/${cat}/${f}\``).join('\n');
    refs += `\n### ${cat}\n${items}\n`;
  }

  return `---
name: Odoo Knowledge Modules
description: This skill should be used when the user asks about Odoo ERP patterns, CRUD operations, domain syntax, field types, module management, accounting, attendance, timesheets, mail/chatter, translations, multi-company, or any Odoo-specific development question. Provides 5,200+ lines of battle-tested Odoo knowledge.
version: 0.5.3
---

# Odoo Knowledge Modules

Battle-tested knowledge modules for working with Odoo ERP. Each module covers a specific domain with patterns, code examples, and best practices validated against Odoo v17 in CI.

## When to Use

Activate this skill when working with any Odoo-related task: querying records, creating automations, managing modules, configuring multi-company, handling accounting, tracking attendance/timesheets, or any other Odoo domain.

## How to Use

Load the relevant reference file for the topic at hand. Each reference is a self-contained module with code examples using \`@marcfargas/odoo-client\`.

## Reference Files
${refs}
## Quick Reference

| Topic | File |
|-------|------|
| Connect to Odoo | \`references/base/connection.md\` |
| CRUD operations | \`references/base/crud.md\` |
| Search & filter | \`references/base/search.md\` |
| Domain syntax | \`references/base/domains.md\` |
| Field types | \`references/base/field-types.md\` |
| Module management | \`references/base/modules.md\` |
| Schema introspection | \`references/base/introspection.md\` |
`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

// Clean dist
fs.rmSync(DIST, { recursive: true, force: true });

buildPlugin('claude-odoo-connect');
buildPlugin('claude-odoo-dev');

console.log('\nDone. Plugins ready in dist-plugins/');
