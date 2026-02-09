/**
 * Copies skills/odoo/ from repo root into this package's skills/ directory.
 * Run at build time so `npm publish` ships the actual skill files.
 */
const { cpSync, existsSync, rmSync, mkdirSync } = require('fs');
const { resolve } = require('path');

const pkgRoot = resolve(__dirname, '..');
const repoRoot = resolve(pkgRoot, '..', '..');

const src = resolve(repoRoot, 'skills', 'odoo');
const dest = resolve(pkgRoot, 'skills');

if (!existsSync(src)) {
  console.error(`ERROR: Source not found: ${src}`);
  process.exit(1);
}

if (existsSync(dest)) {
  rmSync(dest, { recursive: true });
}

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });

console.log('✓ Copied skills/odoo/ → packages/odoo-skills/skills/');
