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
const wellKnownSrc = resolve(repoRoot, '.well-known');
const wellKnownDest = resolve(pkgRoot, '.well-known');

if (!existsSync(src)) {
  console.error(`ERROR: Source not found: ${src}`);
  process.exit(1);
}

if (existsSync(dest)) {
  rmSync(dest, { recursive: true });
}
if (existsSync(wellKnownDest)) {
  rmSync(wellKnownDest, { recursive: true });
}

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });

if (existsSync(wellKnownSrc)) {
  cpSync(wellKnownSrc, wellKnownDest, { recursive: true });
  console.log('✓ Copied skills/odoo/ → packages/odoo-skills/skills/');
  console.log('✓ Copied .well-known/ → packages/odoo-skills/.well-known/');
} else {
  console.log('✓ Copied skills/odoo/ → packages/odoo-skills/skills/');
}
