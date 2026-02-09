#!/usr/bin/env node
/**
 * Copy skills/odoo/ into dist/skills/odoo/ so the package works when published to npm.
 *
 * In the monorepo, findSkillsDir() walks up from dist/cli/commands/ and finds
 * the top-level skills/odoo/. When installed from npm, that walk-up lands in
 * dist/ — so we need dist/skills/odoo/ to exist.
 */

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', '..', '..', 'skills', 'odoo');
const DEST = path.resolve(__dirname, '..', 'dist', 'skills', 'odoo');

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (!fs.existsSync(SRC)) {
  console.error(`ERROR: skills/odoo/ not found at ${SRC}`);
  process.exit(1);
}

// Clean previous copy
if (fs.existsSync(DEST)) {
  fs.rmSync(DEST, { recursive: true });
}

copyDirRecursive(SRC, DEST);

const count = fs.readdirSync(DEST, { recursive: true }).length;
console.log(`✓ Copied skills/odoo/ → dist/skills/odoo/ (${count} entries)`);
